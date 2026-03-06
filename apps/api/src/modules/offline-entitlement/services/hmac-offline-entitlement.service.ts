import { Inject, Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { SignJWT, exportJWK, importPKCS8, importSPKI, type JWK } from 'jose';
import { AppConfigService } from '../../../config/app-config.service';
import {
  IssueOfflineSessionTokenInput,
  IssueOfflineTokenInput,
  OfflineEntitlementPort,
  type OfflineSessionJwks
} from '../ports/offline-entitlement.port';

@Injectable()
export class HmacOfflineEntitlementService implements OfflineEntitlementPort {
  private signingKeyPromise?: Promise<CryptoKey>;
  private jwkPromise?: Promise<JWK>;

  constructor(@Inject(AppConfigService) private readonly configService: AppConfigService) {}

  issueOfflineToken(input: IssueOfflineTokenInput): string {
    const issuedAt = input.issuedAt ?? new Date();

    return createHmac('sha256', this.configService.jwtSecret)
      .update(`${input.licenseKey}:${input.fingerprintHash}:${issuedAt.toISOString()}`)
      .digest('hex');
  }

  async issueOfflineSessionToken(
    input: IssueOfflineSessionTokenInput
  ): Promise<{ token: string; expiresAt: string }> {
    const issuedAt = input.issuedAt ?? new Date();
    const expiresAt = new Date(
      issuedAt.getTime() + (input.maxOfflineHours ?? this.configService.offlineMaxHours) * 60 * 60 * 1000
    );

    const signingKey = await this.getSigningKey();
    const token = await new SignJWT({
      type: 'offline_session',
      sid: input.sessionId,
      program_id: input.programId,
      fp_hash: input.fingerprintHash,
      entitlements: input.entitlements
    })
      .setProtectedHeader({
        alg: 'RS256',
        kid: this.configService.offlineJwtKid,
        typ: 'JWT'
      })
      .setIssuer('sistema-licencas-v2')
      .setAudience(`program:${input.programId}`)
      .setSubject(input.userId)
      .setIssuedAt(Math.floor(issuedAt.getTime() / 1000))
      .setNotBefore(Math.floor(issuedAt.getTime() / 1000))
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(signingKey);

    return {
      token,
      expiresAt: expiresAt.toISOString()
    };
  }

  async getOfflineSessionJwks(): Promise<OfflineSessionJwks> {
    const jwk = await this.getPublicJwk();
    return {
      keys: [
        {
          ...jwk,
          use: 'sig',
          alg: 'RS256',
          kid: this.configService.offlineJwtKid
        }
      ]
    };
  }

  private async getSigningKey(): Promise<CryptoKey> {
    if (!this.signingKeyPromise) {
      const privatePem = this.configService.offlineJwtPrivateKeyPem;
      if (!privatePem) {
        throw new Error('OFFLINE_JWT_PRIVATE_KEY_PEM is required');
      }
      this.signingKeyPromise = importPKCS8(privatePem, 'RS256');
    }

    return this.signingKeyPromise;
  }

  private async getPublicJwk(): Promise<JWK> {
    if (!this.jwkPromise) {
      const publicPem = this.configService.offlineJwtPublicKeyPem;
      if (!publicPem) {
        throw new Error('OFFLINE_JWT_PUBLIC_KEY_PEM is required');
      }

      this.jwkPromise = importSPKI(publicPem, 'RS256').then((key) => exportJWK(key));
    }

    return this.jwkPromise;
  }
}
