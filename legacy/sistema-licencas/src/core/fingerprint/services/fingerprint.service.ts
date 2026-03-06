import crypto from 'crypto';
import { IDeviceComponent, IDeviceFingerprint, IFingerprintHashes } from '../../../shared/interfaces/license.interface';

export interface IFingerprintBundle {
  v1: IDeviceFingerprint;
  v2: IDeviceFingerprint;
  primary: IDeviceFingerprint;
  fallback?: IDeviceFingerprint;
  hashes: IFingerprintHashes;
}

/**
 * Fingerprint Service
 * Centralized server-side fingerprint calculation and matching.
 */
export class FingerprintService {
  private static readonly DEFAULT_WEIGHTS: Record<string, number> = {
    machine_id: 0.5,
    disk_serial: 0.3,
    mac_address: 0.2,
    hostname: 0.1,
    platform: 0.1
  };

  private static readonly STABILITY: Record<string, boolean> = {
    machine_id: true,
    disk_serial: true,
    mac_address: false,
    hostname: false,
    platform: true
  };

  private static readonly STABLE_COMPONENT_WEIGHTS: Record<string, number> = {
    machine_id: 0.6,
    disk_serial: 0.4
  };

  private static readonly UNKNOWN = 'UNKNOWN';

  /**
   * Legacy hash format used by weighted_v1.
   * Kept exactly as-is for backward compatibility.
   */
  static calculateHashV1(components: Record<string, string>): string {
    const values = [
      components.machine_id || '',
      components.disk_serial || '',
      components.mac_address || ''
    ].join(':');

    return crypto.createHash('sha256').update(values).digest('hex');
  }

  /**
   * Backward-compatible alias for old call sites.
   */
  static calculateHash(components: Record<string, string>): string {
    return this.calculateHashV1(components);
  }

  /**
   * v2 stable-first hash:
   * sha256("v2|<machine_id_norm>|<disk_serial_norm>")
   */
  static calculateHashV2(components: Record<string, string>): string {
    const machineIdNorm = this.normalizeStable(components.machine_id);
    const diskSerialNorm = this.normalizeStable(components.disk_serial);
    const payload = `v2|${machineIdNorm}|${diskSerialNorm}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Returns both v1 and v2 fingerprints.
   * Primary is always v2 when v2 is enabled.
   */
  static buildFingerprintBundle(rawComponents: Record<string, string>): IFingerprintBundle {
    const sanitized = this.sanitizeRawComponents(rawComponents);

    const v1Hash = this.calculateHashV1(sanitized);
    const v2Hash = this.calculateHashV2(sanitized);
    const hashes: IFingerprintHashes = {
      v1: v1Hash,
      v2: v2Hash,
      primary: v2Hash
    };

    const fallbackUntil = this.getV1FallbackUntil();

    const v1Fingerprint = this.buildFingerprintObject({
      rawComponents: sanitized,
      hash: v1Hash,
      algorithm: 'weighted_v1',
      hashes: {
        v1: v1Hash,
        v2: v2Hash,
        primary: v1Hash
      },
      fallbackUntil
    });

    const v2Fingerprint = this.buildFingerprintObject({
      rawComponents: sanitized,
      hash: v2Hash,
      algorithm: 'stable_v2',
      hashes,
      fallbackUntil
    });

    const fallback = this.isV1FallbackAllowed() ? v1Fingerprint : undefined;

    return {
      v1: v1Fingerprint,
      v2: v2Fingerprint,
      primary: v2Fingerprint,
      fallback,
      hashes
    };
  }

  /**
   * Current default for main flow is v2.
   */
  static buildFingerprint(rawComponents: Record<string, string>): IDeviceFingerprint {
    return this.buildFingerprintBundle(rawComponents).primary;
  }

  /**
   * Match two fingerprints using weighted algorithm.
   */
  static matchFingerprints(
    stored: IDeviceFingerprint,
    current: IDeviceFingerprint,
    threshold?: number
  ): { match: boolean; score: number; reason?: string } {
    const matchThreshold = threshold || parseFloat(process.env.FINGERPRINT_MATCH_THRESHOLD || '0.6');

    if (stored.hash && current.hash && stored.hash === current.hash) {
      return { match: true, score: 1.0 };
    }

    let totalWeight = 0;
    let matchedWeight = 0;
    const mismatches: string[] = [];

    for (const [component, storedData] of Object.entries(stored.components)) {
      if (!storedData) {
        continue;
      }

      const currentData = current.components[component];
      totalWeight += storedData.weight;

      if (!currentData) {
        mismatches.push(`${component} (missing)`);
        continue;
      }

      if (storedData.value === currentData.value) {
        matchedWeight += storedData.weight;
      } else {
        mismatches.push(`${component} (changed)`);
      }
    }

    const matchScore = totalWeight > 0 ? matchedWeight / totalWeight : 0;

    if (matchScore >= matchThreshold) {
      return { match: true, score: matchScore };
    }

    return {
      match: false,
      score: matchScore,
      reason: `Device fingerprint mismatch: ${(matchScore * 100).toFixed(1)}% match (threshold: ${(matchThreshold * 100)}%). Mismatches: ${mismatches.join(', ')}`
    };
  }

  /**
   * Stable-components reconciliation for v1->v2 migration.
   * Compares machine_id and disk_serial only.
   */
  static matchByStableComponents(
    stored: IDeviceFingerprint,
    current: IDeviceFingerprint,
    threshold?: number,
    minGap?: number
  ): { match: boolean; score: number; reason?: string } {
    const effectiveThreshold = threshold ?? parseFloat(process.env.FINGERPRINT_RECONCILIATION_THRESHOLD || '0.80');
    const effectiveMinGap = minGap ?? parseFloat(process.env.FINGERPRINT_RECONCILIATION_MIN_GAP || '0.15');

    let totalWeight = 0;
    let matchedWeight = 0;
    const reasons: string[] = [];

    for (const [component, weight] of Object.entries(this.STABLE_COMPONENT_WEIGHTS)) {
      const storedValue = this.extractComponentValue(stored, component);
      const currentValue = this.extractComponentValue(current, component);

      if (!storedValue || !currentValue) {
        continue;
      }

      totalWeight += weight;
      if (storedValue === currentValue) {
        matchedWeight += weight;
      } else {
        reasons.push(`${component} mismatch`);
      }
    }

    if (totalWeight === 0) {
      return {
        match: false,
        score: 0,
        reason: 'Stable components not available for reconciliation'
      };
    }

    const score = matchedWeight / totalWeight;
    const margin = score - effectiveThreshold;
    const match = score >= effectiveThreshold && margin >= effectiveMinGap;

    if (match) {
      return { match: true, score };
    }

    return {
      match: false,
      score,
      reason: `Stable reconciliation failed: ${(score * 100).toFixed(1)}% (threshold ${(effectiveThreshold * 100).toFixed(1)}%, margin ${(margin * 100).toFixed(1)}%). ${reasons.join(', ')}`
    };
  }

  /**
   * Whether v1 fallback is still accepted.
   */
  static isV1FallbackAllowed(now: Date = new Date()): boolean {
    const fallbackUntilRaw = process.env.FINGERPRINT_V1_FALLBACK_UNTIL_UTC;
    if (!fallbackUntilRaw) {
      return true;
    }

    const fallbackUntil = new Date(fallbackUntilRaw);
    if (Number.isNaN(fallbackUntil.getTime())) {
      return true;
    }

    return now.getTime() <= fallbackUntil.getTime();
  }

  static getV1FallbackUntil(): string | undefined {
    const fallbackUntilRaw = process.env.FINGERPRINT_V1_FALLBACK_UNTIL_UTC;
    if (!fallbackUntilRaw) {
      return undefined;
    }

    const fallbackUntil = new Date(fallbackUntilRaw);
    if (Number.isNaN(fallbackUntil.getTime())) {
      return undefined;
    }

    return fallbackUntil.toISOString();
  }

  /**
   * Validate raw components from client.
   */
  static validateRawComponents(raw: Record<string, string>): { valid: boolean; error?: string } {
    if (!raw.machine_id && !raw.disk_serial) {
      return {
        valid: false,
        error: 'Missing required stable components (machine_id or disk_serial)'
      };
    }

    for (const [key, value] of Object.entries(raw)) {
      if (typeof value !== 'string') {
        return {
          valid: false,
          error: `Invalid component value for ${key}`
        };
      }
    }

    return { valid: true };
  }

  static getWeights(): Record<string, number> {
    return { ...this.DEFAULT_WEIGHTS };
  }

  static updateThreshold(newThreshold: number): void {
    if (newThreshold < 0 || newThreshold > 1) {
      throw new Error('Threshold must be between 0 and 1');
    }
    process.env.FINGERPRINT_MATCH_THRESHOLD = newThreshold.toString();
  }

  private static buildFingerprintObject(params: {
    rawComponents: Record<string, string>;
    hash: string;
    algorithm: string;
    hashes?: IFingerprintHashes;
    fallbackUntil?: string;
  }): IDeviceFingerprint {
    const components: Record<string, IDeviceComponent> = {};
    for (const [key, value] of Object.entries(params.rawComponents)) {
      components[key] = {
        value,
        weight: this.DEFAULT_WEIGHTS[key] ?? 0.1,
        stable: this.STABILITY[key] ?? false
      };
    }

    return {
      hash: params.hash,
      primary_hash: params.hashes?.primary || params.hash,
      hashes: params.hashes,
      fallback_until: params.fallbackUntil,
      algorithm: params.algorithm,
      components,
      generated_at: new Date().toISOString(),
      raw_components: params.rawComponents
    };
  }

  private static sanitizeRawComponents(raw: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw || {})) {
      sanitized[key] = this.sanitizeValue(value);
    }
    return sanitized;
  }

  private static sanitizeValue(value: unknown): string {
    if (typeof value !== 'string') {
      return this.UNKNOWN;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : this.UNKNOWN;
  }

  private static normalizeStable(value: string | undefined): string {
    const sanitized = this.sanitizeValue(value);
    return sanitized
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
  }

  private static extractComponentValue(fingerprint: IDeviceFingerprint, component: string): string | null {
    const componentData = fingerprint.components?.[component];
    if (componentData?.value) {
      return this.normalizeStable(componentData.value);
    }

    const rawValue = fingerprint.raw_components?.[component];
    if (rawValue) {
      return this.normalizeStable(rawValue);
    }

    return null;
  }
}
