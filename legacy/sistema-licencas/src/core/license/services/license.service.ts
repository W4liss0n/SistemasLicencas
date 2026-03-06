import crypto from 'crypto';
import { LicenseModel } from '../models/license.model';
import { SubscriptionModel } from '../../subscription/models/subscription.model';
import { IDeviceComponent, IDeviceFingerprint, ILicense, ILicenseValidationRequest, ILicenseValidationResponse } from '../../../shared/interfaces/license.interface';
import { LicenseStatus, SubscriptionStatus } from '../../../shared/types/license.types';
import redis, { cachePatterns, cacheTTL } from '../../../data/database/config/redis.config';
import { JWTService } from '../../../security/auth/services/jwt.service';
import { FingerprintService, IFingerprintBundle } from '../../fingerprint/services/fingerprint.service';
import { getErrorMessage } from '../../../shared/constants/error-messages';

type DeviceMatchSource = 'v2_exact' | 'v1_fallback' | 'reconciled_components' | 'new_registration';

interface IResolvedDevice {
  licenseDeviceId?: string;
  matchSource: DeviceMatchSource;
  matchedHash?: string;
  deniedReason?: 'fallback_denied_after_cutoff';
}

export class LicenseService {
  /**
   * Generate a unique license key
   */
  static generateLicenseKey(): string {
    const segments: string[] = [];
    for (let i = 0; i < 4; i++) {
      const segment = crypto.randomBytes(2).toString('hex').toUpperCase();
      segments.push(segment);
    }
    return `LIC-${segments.join('-')}`;
  }

  /**
   * Create a new license (one license per subscription).
   */
  static async createLicense(subscriptionId: string): Promise<ILicense> {
    const subscription = await SubscriptionModel.findById(subscriptionId);
    if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new Error('Subscription not active');
    }

    const existingLicenses = await LicenseModel.findBySubscriptionId(subscriptionId);
    if (existingLicenses.length > 0) {
      return existingLicenses[0];
    }

    const plan = await this.getPlanDetails(subscription.plano_id);

    let licenseKey = this.generateLicenseKey();
    let attempts = 0;
    while (attempts < 5) {
      const existing = await LicenseModel.findByKey(licenseKey);
      if (!existing) {
        break;
      }
      licenseKey = this.generateLicenseKey();
      attempts++;
    }

    const license = await LicenseModel.create({
      assinatura_id: subscriptionId,
      license_key: licenseKey,
      status: LicenseStatus.ACTIVE,
      max_offline_hours: plan?.max_offline_dias ? Number(plan.max_offline_dias) * 24 : 168
    });

    return license;
  }

  /**
   * Validate a license with fingerprint migration support (v1+v2).
   */
  static async validateLicense(request: ILicenseValidationRequest, ipAddress?: string): Promise<ILicenseValidationResponse> {
    let bundle: IFingerprintBundle | undefined;

    try {
      const rawComponents = this.extractRawComponents(request.device_fingerprint);
      if (!rawComponents) {
        await this.logValidation(request.license_key, false, request.device_fingerprint, ipAddress, 'missing_fingerprint');
        return {
          valid: false,
          error: 'invalid_fingerprint',
          reason: 'Device fingerprint is required',
          message: getErrorMessage('invalid_fingerprint')
        };
      }

      const validation = FingerprintService.validateRawComponents(rawComponents);
      if (!validation.valid) {
        await this.logValidation(request.license_key, false, request.device_fingerprint, ipAddress, 'invalid_fingerprint');
        return {
          valid: false,
          error: 'invalid_fingerprint',
          reason: validation.error || 'Invalid device fingerprint components',
          message: getErrorMessage('invalid_fingerprint')
        };
      }

      bundle = FingerprintService.buildFingerprintBundle(rawComponents);
      const primaryFingerprint = bundle.primary;
      const allowV1Fallback = FingerprintService.isV1FallbackAllowed();
      const fallbackUntil = FingerprintService.getV1FallbackUntil();

      const license = await LicenseModel.findByKey(request.license_key);
      if (!license) {
        await this.logValidation(request.license_key, false, primaryFingerprint, ipAddress, 'license_not_found', bundle.hashes.primary);
        return {
          valid: false,
          error: 'license_not_found',
          reason: 'License key not found in system',
          message: getErrorMessage('license_not_found')
        };
      }

      if (license.status === LicenseStatus.BLOCKED) {
        await this.logValidation(request.license_key, false, primaryFingerprint, ipAddress, 'license_blocked', bundle.hashes.primary);
        return {
          valid: false,
          error: 'license_blocked',
          reason: 'License has been blocked due to security violations',
          message: getErrorMessage('license_blocked')
        };
      }

      if (license.status === LicenseStatus.INACTIVE) {
        await this.logValidation(request.license_key, false, primaryFingerprint, ipAddress, 'license_inactive', bundle.hashes.primary);
        return {
          valid: false,
          error: 'license_inactive',
          reason: 'License is inactive',
          message: getErrorMessage('license_inactive')
        };
      }

      const subscription = await SubscriptionModel.findById(license.assinatura_id);
      if (!subscription) {
        await this.logValidation(request.license_key, false, primaryFingerprint, ipAddress, 'subscription_not_found', bundle.hashes.primary);
        return {
          valid: false,
          error: 'subscription_not_found',
          reason: 'Associated subscription not found',
          message: getErrorMessage('subscription_not_found')
        };
      }

      if (subscription.status !== SubscriptionStatus.ACTIVE) {
        await this.logValidation(request.license_key, false, primaryFingerprint, ipAddress, 'subscription_inactive', bundle.hashes.primary);
        return {
          valid: false,
          error: 'subscription_inactive',
          reason: `Subscription is ${subscription.status}`,
          message: getErrorMessage('subscription_inactive')
        };
      }

      const now = new Date();
      const expirationDate = new Date(subscription.data_fim);
      if (now > expirationDate) {
        await this.logValidation(request.license_key, false, primaryFingerprint, ipAddress, 'subscription_expired', bundle.hashes.primary);
        return {
          valid: false,
          error: 'subscription_expired',
          reason: 'Subscription has expired',
          message: getErrorMessage('subscription_expired')
        };
      }

      if (request.program_id) {
        const isProgramIncluded = await this.isProgramIncludedInPlan(subscription.plano_id, request.program_id);
        if (!isProgramIncluded) {
          await this.logValidation(request.license_key, false, primaryFingerprint, ipAddress, 'program_not_included', bundle.hashes.primary);
          return {
            valid: false,
            error: 'program_not_included',
            reason: 'This program is not included in your subscription plan',
            message: getErrorMessage('program_not_included')
          };
        }
      }

      const resolvedDevice = await this.resolveDeviceForValidation(
        request.license_key,
        bundle,
        allowV1Fallback,
        ipAddress
      );

      const hasExistingDevice = Boolean(resolvedDevice.licenseDeviceId);
      if (resolvedDevice.deniedReason === 'fallback_denied_after_cutoff') {
        await this.logValidation(
          request.license_key,
          false,
          primaryFingerprint,
          ipAddress,
          'fallback_denied_after_cutoff',
          resolvedDevice.matchedHash || bundle.hashes.v1
        );

        return {
          valid: false,
          error: 'fingerprint_mismatch',
          reason: 'Legacy v1 fallback is no longer allowed after cutoff date. Reconnect with a v2-capable client.',
          message: getErrorMessage('fingerprint_mismatch')
        };
      }

      const deviceCheck = await this.checkDeviceLimit(request.license_key, subscription as any, hasExistingDevice);
      if (!deviceCheck.allowed) {
        await this.logValidation(request.license_key, false, primaryFingerprint, ipAddress, 'max_devices_reached', bundle.hashes.primary);
        return {
          valid: false,
          error: 'max_devices_reached',
          reason: deviceCheck.reason || `Maximum number of devices (${deviceCheck.maxDevices}) reached for this license`,
          message: getErrorMessage('max_devices_reached'),
          max_devices: deviceCheck.maxDevices,
          current_devices: deviceCheck.currentDevices
        };
      }

      if (resolvedDevice.licenseDeviceId) {
        await LicenseModel.updateDeviceLastSeenById(
          resolvedDevice.licenseDeviceId,
          ipAddress,
          resolvedDevice.matchSource
        );
      } else {
        const deviceId = await this.registerDeviceForLicense(
          request.license_key,
          bundle,
          ipAddress,
          'new_registration'
        );
        resolvedDevice.licenseDeviceId = deviceId;
        resolvedDevice.matchSource = 'new_registration';
      }

      if (!license.device_fingerprint) {
        await LicenseModel.updateByKey(license.license_key, {
          device_fingerprint: primaryFingerprint
        });
      }

      await LicenseModel.recordAccess(request.license_key, ipAddress || '0.0.0.0');
      await this.logValidation(
        request.license_key,
        true,
        primaryFingerprint,
        ipAddress,
        resolvedDevice.matchSource,
        resolvedDevice.matchedHash || bundle.hashes.primary
      );

      await this.resetOfflineValidationCounter(request.license_key);
      const nonce = await this.getAndIncrementNonce(request.license_key);

      const offlineDays = Number((subscription as any).max_offline_dias) || 7;
      const offlineHours = offlineDays * 24;
      const validUntil = new Date(Date.now() + offlineHours * 60 * 60 * 1000);

      const pool = require('../../../data/database/config/postgres.config').default;
      let clientData: any = {};
      try {
        const clientResult = await pool.query(
          `SELECT c.id, c.usuario, c.nome, c.email, p.nome as plano_nome
           FROM assinaturas a
           INNER JOIN clientes c ON a.cliente_id = c.id
           LEFT JOIN planos p ON c.plano_id = p.id
           WHERE a.id = $1`,
          [subscription.id]
        );

        if (clientResult.rows.length > 0) {
          const client = clientResult.rows[0];
          clientData = {
            client_id: client.id,
            client_username: client.usuario,
            client_name: client.nome,
            client_email: client.email,
            client_plan: client.plano_nome || 'Standard'
          };
        }
      } catch (clientError) {
        console.error('Error fetching client data for offline token:', clientError);
      }

      const acceptedHashes = [bundle.hashes.primary];
      if (allowV1Fallback && bundle.hashes.v1) {
        acceptedHashes.push(bundle.hashes.v1);
      }

      const offlineToken = JWTService.generateOfflineToken({
        license_key: request.license_key,
        fingerprint_hash: bundle.hashes.primary,
        accepted_fingerprint_hashes: acceptedHashes,
        fingerprint_algorithm: 'stable_v2',
        valid_until: validUntil.toISOString(),
        max_offline_validations: parseInt(process.env.MAX_OFFLINE_VALIDATIONS || '100', 10),
        nonce,
        issued_at: new Date().toISOString(),
        license_expires_at: expirationDate.toISOString(),
        ...clientData
      });

      const responseFingerprint: IDeviceFingerprint = {
        ...primaryFingerprint,
        hash: bundle.hashes.primary,
        primary_hash: bundle.hashes.primary,
        hashes: bundle.hashes,
        fallback_until: fallbackUntil
      };

      const response: ILicenseValidationResponse = {
        valid: true,
        license_info: {
          license_key: request.license_key,
          expiration: expirationDate.toISOString(),
          plan_name: (subscription as any).plano_nome || 'Standard',
          features: [],
          max_offline_hours: offlineHours
        },
        offline_token: offlineToken,
        fingerprint: responseFingerprint,
        fallback_until: fallbackUntil,
        public_key: JWTService.getPublicKey(),
        public_key_kid: JWTService.getPublicKeyId(),
        cache_data: {
          version: '2.0',
          encrypted_payload: await this.generateCacheData(license, subscription),
          signature: await this.generateSignature(request.license_key),
          expires_at: validUntil.toISOString()
        },
        security: {
          risk_score: 0.1,
          warnings: [],
          next_heartbeat: 3600
        }
      };

      await redis.setex(
        cachePatterns.licenseValidation(request.license_key),
        cacheTTL.licenseValidation,
        JSON.stringify(response)
      );

      return response;
    } catch (error) {
      console.error('License validation error:', error);
      await this.logValidation(
        request.license_key,
        false,
        bundle?.primary || request.device_fingerprint,
        ipAddress,
        'validation_error',
        bundle?.hashes.primary
      );
      return {
        valid: false,
        error: 'validation_error',
        reason: 'An error occurred during validation',
        message: getErrorMessage('validation_error')
      };
    }
  }

  private static async generateCacheData(license: ILicense, subscription: any): Promise<string> {
    const payload = {
      license_key: license.license_key,
      subscription_id: subscription.id,
      expires_at: subscription.data_fim,
      max_offline_hours: license.max_offline_hours,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex')
    };

    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  private static async generateSignature(data: string): Promise<string> {
    const secret = process.env.CACHE_SIGNATURE_KEY || 'default_signature_key';
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  }

  private static async getPlanDetails(planId: string): Promise<any> {
    try {
      const pool = require('../../../data/database/config/postgres.config').default;
      const result = await pool.query(
        'SELECT max_dispositivos, max_offline_dias FROM planos WHERE id = $1',
        [planId]
      );

      if (result.rows.length > 0) {
        return {
          max_licencas: result.rows[0].max_dispositivos || 1,
          max_offline_dias: Number(result.rows[0].max_offline_dias) || 7,
          features: []
        };
      }

      return {
        max_licencas: 1,
        max_offline_dias: 7,
        features: []
      };
    } catch (error) {
      console.error('Error fetching plan details:', error);
      return {
        max_licencas: 1,
        max_offline_dias: 7,
        features: []
      };
    }
  }

  private static async isProgramIncludedInPlan(planId: string, programId: string): Promise<boolean> {
    try {
      const pool = require('../../../data/database/config/postgres.config').default;

      const text = `
        SELECT COUNT(*) as count
        FROM plano_programas
        WHERE plano_id = $1 AND programa_id = $2
      `;

      const result = await pool.query(text, [planId, programId]);
      return parseInt(result.rows[0].count, 10) > 0;
    } catch (error) {
      console.error('Error checking program in plan:', error);
      return false;
    }
  }

  /**
   * Transfer license to new device and refresh offline material.
   */
  static async transferLicense(licenseKey: string, newFingerprint: any, ipAddress?: string): Promise<any> {
    const license = await LicenseModel.findByKey(licenseKey);
    if (!license) {
      throw new Error('License not found');
    }

    if (license.status === LicenseStatus.BLOCKED) {
      throw new Error('Cannot transfer blocked license');
    }

    const pool = require('../../../data/database/config/postgres.config').default;
    const transferCountResult = await pool.query(
      'SELECT count_monthly_transfers($1) as count',
      [licenseKey]
    );

    const monthlyTransfers = parseInt(transferCountResult.rows[0].count, 10);
    const maxTransfersPerMonth = 3;
    if (monthlyTransfers >= maxTransfersPerMonth) {
      throw new Error(`Monthly transfer limit reached (${maxTransfersPerMonth}/month). Please contact support.`);
    }

    const validationResult = await this.validateLicense({
      license_key: licenseKey,
      device_fingerprint: newFingerprint,
      program_version: '1.0.0',
      os_info: 'transfer'
    }, ipAddress);

    if (!validationResult.valid) {
      throw new Error(validationResult.reason || 'Transfer validation failed');
    }

    const oldFingerprint = license.device_fingerprint;
    const newPrimaryHash = validationResult.fingerprint?.primary_hash || validationResult.fingerprint?.hash || null;

    await pool.query(
      `INSERT INTO license_transfers (license_key, old_fingerprint_hash, new_fingerprint_hash,
        old_device_info, new_device_info, ip_address, reason)
       VALUES ($1, $2, $3, $4, $5, $6, 'user_requested')`,
      [
        licenseKey,
        oldFingerprint?.hash || null,
        newPrimaryHash,
        oldFingerprint || null,
        validationResult.fingerprint || null,
        ipAddress || null
      ]
    );

    await pool.query(
      `UPDATE licencas
       SET transfer_count = COALESCE(transfer_count, 0) + 1,
           last_transfer_at = CURRENT_TIMESTAMP
       WHERE license_key = $1`,
      [licenseKey]
    );

    const updatedLicense = await LicenseModel.updateByKey(licenseKey, {
      device_fingerprint: validationResult.fingerprint
    });

    await this.clearLicenseCache(licenseKey);

    return {
      ...validationResult,
      license: updatedLicense
    };
  }

  private static async clearLicenseCache(licenseKey: string): Promise<void> {
    const cacheKey = cachePatterns.licenseValidation(licenseKey);
    await redis.del(cacheKey);
  }

  private static async checkDeviceLimit(
    licenseKey: string,
    subscription: any,
    hasExistingDevice: boolean
  ): Promise<{
    allowed: boolean;
    maxDevices: number;
    currentDevices: number;
    reason?: string;
  }> {
    try {
      const maxDevices = subscription.max_dispositivos || 1;
      const currentDevices = await LicenseModel.getActiveDevicesCount(licenseKey);

      if (hasExistingDevice) {
        if (currentDevices > maxDevices) {
          return {
            allowed: false,
            maxDevices,
            currentDevices,
            reason: `Plan was downgraded to ${maxDevices} device(s). Currently ${currentDevices} devices are active. Please deactivate ${currentDevices - maxDevices} device(s) to continue using this one.`
          };
        }

        return {
          allowed: true,
          maxDevices,
          currentDevices
        };
      }

      if (currentDevices >= maxDevices) {
        return {
          allowed: false,
          maxDevices,
          currentDevices,
          reason: `License has reached the maximum number of devices (${maxDevices}). Please deactivate a device before activating a new one.`
        };
      }

      return {
        allowed: true,
        maxDevices,
        currentDevices
      };
    } catch (error) {
      console.error('[DEVICE_LIMIT] Error checking device limit:', error);
      return {
        allowed: false,
        maxDevices: 1,
        currentDevices: 0,
        reason: 'Error checking device limit - please try again'
      };
    }
  }

  private static async registerDeviceForLicense(
    licenseKey: string,
    bundle: IFingerprintBundle,
    ipAddress?: string,
    matchSource: DeviceMatchSource = 'new_registration'
  ): Promise<string> {
    const fallbackUntil = FingerprintService.getV1FallbackUntil() || null;

    const v2FingerprintId = await LicenseModel.getOrCreateFingerprint(
      bundle.hashes.v2,
      bundle.v2.components,
      bundle.v2.algorithm || 'stable_v2'
    );

    const licenseDeviceId = await LicenseModel.registerDevice(
      licenseKey,
      v2FingerprintId,
      undefined,
      ipAddress,
      matchSource
    );

    if (bundle.hashes.v1 && bundle.hashes.v1 !== bundle.hashes.v2) {
      const v1FingerprintId = await LicenseModel.getOrCreateFingerprint(
        bundle.hashes.v1,
        bundle.v1.components,
        bundle.v1.algorithm || 'weighted_v1'
      );

      await LicenseModel.addFingerprintAlias(
        licenseDeviceId,
        v1FingerprintId,
        'v1_fallback',
        fallbackUntil
      );
    }

    return licenseDeviceId;
  }

  private static async resolveDeviceForValidation(
    licenseKey: string,
    bundle: IFingerprintBundle,
    allowV1Fallback: boolean,
    ipAddress?: string
  ): Promise<IResolvedDevice> {
    const exactMatch = await LicenseModel.findActiveDeviceMatch(
      licenseKey,
      { v1: bundle.hashes.v1, v2: bundle.hashes.v2 },
      allowV1Fallback
    );

    if (exactMatch.matched && exactMatch.licenseDeviceId) {
      if (exactMatch.matchSource === 'v2_exact') {
        return {
          licenseDeviceId: exactMatch.licenseDeviceId,
          matchSource: 'v2_exact',
          matchedHash: exactMatch.matchedHash
        };
      }

      await this.promoteMatchedDeviceToV2(
        exactMatch.licenseDeviceId,
        exactMatch.primaryFingerprintId,
        exactMatch.matchedFingerprintId,
        bundle,
        'v1_fallback',
        ipAddress
      );

      return {
        licenseDeviceId: exactMatch.licenseDeviceId,
        matchSource: 'v1_fallback',
        matchedHash: exactMatch.matchedHash
      };
    }

    if (!allowV1Fallback && bundle.hashes.v1) {
      const legacyOnlyMatch = await LicenseModel.findActiveDeviceMatch(
        licenseKey,
        { v1: bundle.hashes.v1, v2: bundle.hashes.v2 },
        true
      );

      if (legacyOnlyMatch.matched && legacyOnlyMatch.matchSource === 'v1_fallback') {
        return {
          licenseDeviceId: legacyOnlyMatch.licenseDeviceId,
          matchSource: 'new_registration',
          matchedHash: legacyOnlyMatch.matchedHash,
          deniedReason: 'fallback_denied_after_cutoff'
        };
      }
    }

    if (allowV1Fallback && this.isReconciliationEnabled()) {
      const reconciled = await this.tryReconcileDeviceByStableComponents(licenseKey, bundle, ipAddress);
      if (reconciled) {
        return reconciled;
      }
    }

    return {
      matchSource: 'new_registration'
    };
  }

  private static async promoteMatchedDeviceToV2(
    licenseDeviceId: string,
    currentPrimaryFingerprintId: string | undefined,
    matchedFingerprintId: string | undefined,
    bundle: IFingerprintBundle,
    matchSource: 'v1_fallback' | 'reconciled_components',
    ipAddress?: string
  ): Promise<void> {
    const fallbackUntil = FingerprintService.getV1FallbackUntil() || null;

    const v2FingerprintId = await LicenseModel.getOrCreateFingerprint(
      bundle.hashes.v2,
      bundle.v2.components,
      bundle.v2.algorithm || 'stable_v2'
    );

    if (currentPrimaryFingerprintId && currentPrimaryFingerprintId !== v2FingerprintId) {
      await LicenseModel.addFingerprintAlias(
        licenseDeviceId,
        currentPrimaryFingerprintId,
        'legacy_primary',
        fallbackUntil
      );
    }

    if (matchedFingerprintId && matchedFingerprintId !== v2FingerprintId) {
      await LicenseModel.addFingerprintAlias(
        licenseDeviceId,
        matchedFingerprintId,
        'v1_fallback',
        fallbackUntil
      );
    }

    if (bundle.hashes.v1 && bundle.hashes.v1 !== bundle.hashes.v2) {
      const v1FingerprintId = await LicenseModel.getOrCreateFingerprint(
        bundle.hashes.v1,
        bundle.v1.components,
        bundle.v1.algorithm || 'weighted_v1'
      );

      if (v1FingerprintId !== v2FingerprintId) {
        await LicenseModel.addFingerprintAlias(
          licenseDeviceId,
          v1FingerprintId,
          'v1_fallback',
          fallbackUntil
        );
      }
    }

    await LicenseModel.promotePrimaryFingerprint(
      licenseDeviceId,
      v2FingerprintId,
      matchSource,
      ipAddress
    );
  }

  private static async tryReconcileDeviceByStableComponents(
    licenseKey: string,
    bundle: IFingerprintBundle,
    ipAddress?: string
  ): Promise<IResolvedDevice | null> {
    const candidates = await LicenseModel.getActiveDevicesForReconciliation(licenseKey);
    let bestCandidate: {
      score: number;
      licenseDeviceId: string;
      primaryFingerprintId?: string;
      matchedFingerprintId?: string;
      matchedHash?: string;
    } | null = null;

    for (const device of candidates) {
      const primaryStored = this.buildStoredFingerprint(
        device.primary_hash,
        device.primary_components,
        device.primary_algorithm
      );

      const primaryResult = FingerprintService.matchByStableComponents(primaryStored, bundle.v2);
      if (primaryResult.match && (!bestCandidate || primaryResult.score > bestCandidate.score)) {
        bestCandidate = {
          score: primaryResult.score,
          licenseDeviceId: device.license_device_id,
          primaryFingerprintId: device.primary_fingerprint_id,
          matchedFingerprintId: device.primary_fingerprint_id,
          matchedHash: device.primary_hash
        };
      }

      const aliases = Array.isArray(device.aliases) ? device.aliases : [];
      for (const alias of aliases) {
        if (!alias || !alias.fingerprint_hash) {
          continue;
        }

        const aliasStored = this.buildStoredFingerprint(
          alias.fingerprint_hash,
          alias.components,
          alias.algorithm_version
        );

        const aliasResult = FingerprintService.matchByStableComponents(aliasStored, bundle.v2);
        if (aliasResult.match && (!bestCandidate || aliasResult.score > bestCandidate.score)) {
          bestCandidate = {
            score: aliasResult.score,
            licenseDeviceId: device.license_device_id,
            primaryFingerprintId: device.primary_fingerprint_id,
            matchedHash: alias.fingerprint_hash
          };
        }
      }
    }

    if (!bestCandidate) {
      return null;
    }

    await this.promoteMatchedDeviceToV2(
      bestCandidate.licenseDeviceId,
      bestCandidate.primaryFingerprintId,
      bestCandidate.matchedFingerprintId,
      bundle,
      'reconciled_components',
      ipAddress
    );

    return {
      licenseDeviceId: bestCandidate.licenseDeviceId,
      matchSource: 'reconciled_components',
      matchedHash: bestCandidate.matchedHash
    };
  }

  private static buildStoredFingerprint(hash: string, components: any, algorithmVersion: string): IDeviceFingerprint {
    const formattedComponents: Record<string, IDeviceComponent> = {};
    const weights = FingerprintService.getWeights();

    for (const [key, value] of Object.entries(components || {})) {
      if (value && typeof value === 'object' && 'value' in (value as any)) {
        const typedValue = value as any;
        formattedComponents[key] = {
          value: String(typedValue.value),
          weight: typeof typedValue.weight === 'number' ? typedValue.weight : (weights[key] ?? 0.1),
          stable: typeof typedValue.stable === 'boolean' ? typedValue.stable : (key === 'machine_id' || key === 'disk_serial')
        };
        continue;
      }

      formattedComponents[key] = {
        value: String(value),
        weight: weights[key] ?? 0.1,
        stable: key === 'machine_id' || key === 'disk_serial'
      };
    }

    return {
      hash,
      primary_hash: hash,
      algorithm: algorithmVersion || 'stored',
      components: formattedComponents
    };
  }

  private static isReconciliationEnabled(): boolean {
    return process.env.FINGERPRINT_RECONCILIATION_ENABLED !== 'false';
  }

  private static extractRawComponents(fingerprint: any): Record<string, string> | null {
    if (!fingerprint || typeof fingerprint !== 'object') {
      return null;
    }

    if (fingerprint.raw_components && typeof fingerprint.raw_components === 'object') {
      return this.extractFromFlatObject(fingerprint.raw_components);
    }

    if (fingerprint.components && typeof fingerprint.components === 'object') {
      const fromComponents: Record<string, string> = {};
      for (const [key, value] of Object.entries(fingerprint.components)) {
        if (value && typeof value === 'object' && 'value' in (value as any)) {
          fromComponents[key] = String((value as any).value);
        } else if (typeof value === 'string' || typeof value === 'number') {
          fromComponents[key] = String(value);
        }
      }
      if (Object.keys(fromComponents).length > 0) {
        return fromComponents;
      }
    }

    const direct = this.extractFromFlatObject(fingerprint);
    return Object.keys(direct).length > 0 ? direct : null;
  }

  private static extractFromFlatObject(input: Record<string, unknown>): Record<string, string> {
    const allowedKeys = ['machine_id', 'disk_serial', 'mac_address', 'hostname', 'platform'];
    const result: Record<string, string> = {};

    for (const key of allowedKeys) {
      const value = input[key];
      if (typeof value === 'string' || typeof value === 'number') {
        result[key] = String(value);
      }
    }

    return result;
  }

  private static async logValidation(
    licenseKey: string,
    validationResult: boolean,
    fingerprint: any,
    ipAddress?: string,
    failureReason?: string,
    resolvedHash?: string
  ): Promise<void> {
    try {
      const pool = require('../../../data/database/config/postgres.config').default;

      let fingerprintId: string | null = null;
      let fingerprintHash = resolvedHash || null;
      let componentsToStore: any = null;
      let algorithmVersion = 'stable_v2';

      if (fingerprint && !fingerprintHash) {
        fingerprintHash = fingerprint.hashes?.primary || fingerprint.primary_hash || fingerprint.hash || null;
      }

      if (!fingerprintHash && fingerprint) {
        const extracted = this.extractRawComponents(fingerprint);
        if (extracted) {
          const bundle = FingerprintService.buildFingerprintBundle(extracted);
          fingerprintHash = bundle.hashes.primary;
          componentsToStore = bundle.primary.components;
          algorithmVersion = bundle.primary.algorithm || algorithmVersion;
        }
      }

      if (!componentsToStore && fingerprint) {
        componentsToStore = fingerprint.components || this.extractRawComponents(fingerprint);
        algorithmVersion = fingerprint.algorithm || algorithmVersion;
      }

      if (fingerprintHash) {
        fingerprintId = await LicenseModel.getOrCreateFingerprint(
          fingerprintHash,
          componentsToStore || {},
          algorithmVersion
        );
      }

      let riskScore = 0.1;
      if (!validationResult) {
        switch (failureReason) {
          case 'fingerprint_mismatch':
            riskScore = 0.8;
            break;
          case 'license_blocked':
            riskScore = 1.0;
            break;
          case 'subscription_expired':
            riskScore = 0.3;
            break;
          case 'fallback_denied_after_cutoff':
            riskScore = 0.2;
            break;
          case 'license_not_found':
            riskScore = 0.9;
            break;
          default:
            riskScore = 0.5;
        }
      }

      await pool.query(
        `INSERT INTO validation_history (
          license_key, validation_result, device_fingerprint_id,
          ip_address, risk_score, validation_details
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          licenseKey,
          validationResult,
          fingerprintId,
          ipAddress,
          riskScore,
          { reason: failureReason, hash: fingerprintHash, timestamp: new Date().toISOString() }
        ]
      );

      if (!validationResult) {
        await this.checkSuspiciousActivity(licenseKey, ipAddress, failureReason);
      }
    } catch (error) {
      console.error('Error logging validation:', error);
    }
  }

  private static async checkSuspiciousActivity(
    licenseKey: string,
    ipAddress?: string,
    failureReason?: string
  ): Promise<void> {
    try {
      const pool = require('../../../data/database/config/postgres.config').default;

      const legitimateFailures = [
        'max_devices_reached',
        'validation_error',
        'program_not_included',
        'subscription_expired',
        'subscription_inactive',
        'subscription_not_found',
        'device_not_registered',
        'fallback_denied_after_cutoff'
      ];

      const recentFailures = await pool.query(
        `SELECT COUNT(*) as count
         FROM validation_history
         WHERE license_key = $1
         AND validation_result = false
         AND created_at > NOW() - INTERVAL '1 hour'
         AND validation_details->>'reason' NOT IN (${legitimateFailures.map((_, i) => `$${i + 2}`).join(',')})`,
        [licenseKey, ...legitimateFailures]
      );

      const failureCount = parseInt(recentFailures.rows[0].count, 10);
      const suspiciousThreshold = 30;

      if (failureCount >= suspiciousThreshold) {
        await this.blockLicense(licenseKey, 'Excessive suspicious validation failures');
        await pool.query(
          `INSERT INTO security_events (
            license_key, event_type, severity, risk_score, details, ip_address, automated_action
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            licenseKey,
            'brute_force',
            'high',
            0.9,
            {
              failure_count: failureCount,
              reason: failureReason,
              threshold: suspiciousThreshold,
              note: 'Only suspicious failures counted (excludes legitimate errors)'
            },
            ipAddress,
            'permanent_block'
          ]
        );
      }
    } catch (error) {
      console.error('Error checking suspicious activity:', error);
    }
  }

  /**
   * Deactivate current device (supports both v2 primary hash and v1 aliases).
   */
  static async clearDeviceFingerprint(licenseKey: string, currentFingerprint?: any): Promise<void> {
    const license = await LicenseModel.findByKey(licenseKey);
    if (!license) {
      throw new Error('License not found');
    }

    if (currentFingerprint) {
      const rawComponents = this.extractRawComponents(currentFingerprint);
      if (!rawComponents) {
        throw new Error('Invalid fingerprint payload');
      }

      const bundle = FingerprintService.buildFingerprintBundle(rawComponents);
      const hashesToTry = [bundle.hashes.v2, bundle.hashes.v1].filter((hash): hash is string => Boolean(hash));

      let deactivated = false;
      for (const hash of hashesToTry) {
        const isRegistered = await LicenseModel.isDeviceRegistered(licenseKey, hash);
        if (!isRegistered) {
          continue;
        }

        await LicenseModel.deactivateDeviceByAnyHash(licenseKey, hash);
        deactivated = true;
        break;
      }

      if (!deactivated) {
        throw new Error('Device fingerprint does not match any device registered for this license.');
      }
    }

    await LicenseModel.updateByKey(licenseKey, {
      device_fingerprint: undefined
    });

    await this.clearLicenseCache(licenseKey);
  }

  static async blockLicense(licenseKey: string, reason: string): Promise<void> {
    await LicenseModel.block(licenseKey);
    await this.clearLicenseCache(licenseKey);

    const pool = require('../../../data/database/config/postgres.config').default;
    await pool.query(
      `INSERT INTO security_events (license_key, event_type, severity, risk_score, details, automated_action)
       VALUES ($1, 'license_blocked', 'high', 1.0, $2, 'permanent_block')`,
      [licenseKey, { reason }]
    );
  }

  static async unblockLicense(licenseKey: string, adminId?: string): Promise<void> {
    const license = await LicenseModel.findByKey(licenseKey);
    if (!license) {
      throw new Error('License not found');
    }

    if (license.status !== LicenseStatus.BLOCKED) {
      throw new Error('License is not blocked');
    }

    await LicenseModel.updateByKey(licenseKey, {
      status: LicenseStatus.ACTIVE
    });

    await this.clearLicenseCache(licenseKey);

    const pool = require('../../../data/database/config/postgres.config').default;
    await pool.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, performed_by, old_values, new_values)
       VALUES ('license', $1, 'unblock', $2, $3, $4)`,
      [
        license.id,
        adminId || 'system',
        { status: 'blocked' },
        { status: 'active' }
      ]
    );
  }

  private static async getAndIncrementNonce(licenseKey: string): Promise<number> {
    const nonceKey = `license:nonce:${licenseKey}`;
    const nonce = await redis.incr(nonceKey);
    await redis.expire(nonceKey, 30 * 24 * 60 * 60);
    return nonce;
  }

  static async incrementOfflineValidationCounter(licenseKey: string): Promise<number> {
    const counterKey = `license:offline_validations:${licenseKey}`;
    const count = await redis.incr(counterKey);
    const maxOfflineDays = parseInt(process.env.MAX_OFFLINE_DAYS || '7', 10);
    await redis.expire(counterKey, maxOfflineDays * 24 * 60 * 60);
    return count;
  }

  static async resetOfflineValidationCounter(licenseKey: string): Promise<void> {
    const counterKey = `license:offline_validations:${licenseKey}`;
    await redis.del(counterKey);
  }

  static async validateOfflineToken(token: string, currentFingerprint: any): Promise<ILicenseValidationResponse> {
    try {
      const payload = JWTService.verifyOfflineToken(token);

      let currentFingerprintHash: string | null = null;
      if (currentFingerprint?.hashes?.v2) {
        currentFingerprintHash = currentFingerprint.hashes.v2;
      } else if (currentFingerprint?.primary_hash) {
        currentFingerprintHash = currentFingerprint.primary_hash;
      } else if (currentFingerprint?.hash) {
        currentFingerprintHash = currentFingerprint.hash;
      } else {
        const rawComponents = this.extractRawComponents(currentFingerprint);
        if (rawComponents) {
          currentFingerprintHash = FingerprintService.buildFingerprintBundle(rawComponents).hashes.v2;
        }
      }

      const acceptedHashes = payload.accepted_fingerprint_hashes || [payload.fingerprint_hash];
      if (!currentFingerprintHash || !acceptedHashes.includes(currentFingerprintHash)) {
        return {
          valid: false,
          error: 'fingerprint_mismatch',
          reason: 'Device fingerprint does not match offline token',
          message: getErrorMessage('fingerprint_mismatch')
        };
      }

      const validUntil = new Date(payload.valid_until);
      if (new Date() > validUntil) {
        return {
          valid: false,
          error: 'offline_token_expired',
          reason: 'Offline validation period has expired. Please connect to the internet.',
          message: getErrorMessage('offline_token_expired')
        };
      }

      return {
        valid: true,
        license_info: {
          license_key: payload.license_key,
          expiration: payload.valid_until,
          plan_name: 'Offline Mode',
          features: [],
          max_offline_hours: 168
        },
        offline_mode: true,
        security: {
          risk_score: 0.2,
          warnings: ['Operating in offline mode'],
          next_heartbeat: 3600
        }
      };
    } catch (error) {
      return {
        valid: false,
        error: 'invalid_offline_token',
        reason: error instanceof Error ? error.message : 'Invalid offline token',
        message: getErrorMessage('invalid_offline_token')
      };
    }
  }

  /**
   * Deactivate all devices for a license (plan downgrade helper).
   */
  static async deactivateAllDevices(licenseKey: string): Promise<{ deactivated: number; devices: string[] }> {
    try {
      const pool = require('../../../data/database/config/postgres.config').default;

      const devicesResult = await pool.query(
        `SELECT ld.id, df.fingerprint_hash, df.components
         FROM license_devices ld
         INNER JOIN device_fingerprints df ON ld.device_fingerprint_id = df.id
         WHERE ld.license_key = $1 AND ld.is_active = TRUE`,
        [licenseKey]
      );

      const activeDevices = devicesResult.rows;
      const deactivatedDevices: string[] = [];

      for (const device of activeDevices) {
        await LicenseModel.deactivateDevice(licenseKey, device.fingerprint_hash);
        const deviceName = device.components?.hostname?.value || 'Unknown Device';
        deactivatedDevices.push(deviceName);
        console.log(`[PLAN_DOWNGRADE] Deactivated device ${deviceName} (${device.fingerprint_hash.substring(0, 8)}...) for license ${licenseKey}`);
      }

      await this.clearLicenseCache(licenseKey);

      console.log(`[PLAN_DOWNGRADE] Deactivated ${activeDevices.length} device(s) for license ${licenseKey}. First device to login will be reactivated.`);

      return {
        deactivated: activeDevices.length,
        devices: deactivatedDevices
      };
    } catch (error) {
      console.error('Error deactivating all devices:', error);
      throw error;
    }
  }

  /**
   * Handle plan change for a subscription.
   */
  static async handlePlanChange(subscriptionId: string, newMaxDevices: number, oldMaxDevices: number): Promise<void> {
    try {
      const pool = require('../../../data/database/config/postgres.config').default;

      if (newMaxDevices >= oldMaxDevices) {
        console.log(`[PLAN_CHANGE] Plan upgraded or unchanged for subscription ${subscriptionId}. No action needed.`);
        return;
      }

      console.log(`[PLAN_CHANGE] Plan downgraded from ${oldMaxDevices} to ${newMaxDevices} devices for subscription ${subscriptionId}`);

      const licensesResult = await pool.query(
        'SELECT license_key FROM licencas WHERE assinatura_id = $1',
        [subscriptionId]
      );

      const licenses = licensesResult.rows;
      let totalDeactivated = 0;

      for (const license of licenses) {
        const result = await this.deactivateAllDevices(license.license_key);
        totalDeactivated += result.deactivated;
      }

      console.log(`[PLAN_CHANGE] Total devices deactivated: ${totalDeactivated}. Users must login again to reactivate their chosen device(s).`);
    } catch (error) {
      console.error('Error handling plan change:', error);
      throw error;
    }
  }
}
