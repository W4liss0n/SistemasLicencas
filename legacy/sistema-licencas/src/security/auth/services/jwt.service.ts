import jwt from 'jsonwebtoken';
import crypto from 'crypto';

interface JWTPayload {
  id: string;
  email?: string;
  role?: string;
  type: 'client' | 'admin' | 'api';
}

interface OfflineTokenPayload {
  license_key: string;
  fingerprint_hash: string;
  accepted_fingerprint_hashes?: string[];
  fingerprint_algorithm?: string;
  valid_until: string;
  soft_check_after?: string;  // NEW: Soft check timestamp
  max_offline_validations?: number;  // NEW: Validation limit
  nonce: number;
  issued_at: string;
  // Client data for offline display
  license_expires_at?: string;  // License expiration (not JWT expiration!)
  client_username?: string;
  client_name?: string;
  client_email?: string;
  client_plan?: string;
  client_id?: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class JWTService {
  private static readonly ACCESS_SECRET = process.env.JWT_SECRET || 'default_access_secret';
  private static readonly REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'default_refresh_secret';
  private static readonly ACCESS_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'];
  private static readonly REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN || '30d') as jwt.SignOptions['expiresIn'];

  // RSA key pair for offline tokens (generated once)
  private static rsaKeyPair: { publicKey: string; privateKey: string } | null = null;
  private static rsaKeyId: string | null = null;

  /**
   * Initialize or get RSA key pair for offline tokens
   */
  private static getRSAKeyPair(): { publicKey: string; privateKey: string } {
    if (!this.rsaKeyPair) {
      const envPrivateKey = process.env.RSA_PRIVATE_KEY;
      const envPublicKey = process.env.RSA_PUBLIC_KEY;

      if (!envPrivateKey || !envPublicKey) {
        throw new Error('RSA keys not configured. Set RSA_PRIVATE_KEY and RSA_PUBLIC_KEY in environment variables.');
      }

      this.rsaKeyPair = {
        publicKey: envPublicKey.replace(/\n/g, '\n'),
        privateKey: envPrivateKey.replace(/\n/g, '\n')
      };

      const fingerprint = crypto.createHash('sha256')
        .update(this.rsaKeyPair.publicKey)
        .digest('hex')
        .slice(0, 12);

      this.rsaKeyId = process.env.RSA_KEY_ID || `rsa-${fingerprint}`;
      console.log('RSA key pair loaded (fingerprint):', fingerprint, 'kid:', this.rsaKeyId);
    }

    return this.rsaKeyPair;
  }

  /**
   * Get public key for client-side JWT verification
   */
  static getPublicKey(): string {
    return this.getRSAKeyPair().publicKey;
  }

  /**
   * Get active RSA key id used in JWT header (kid)
   */
  static getPublicKeyId(): string {
    this.getRSAKeyPair();
    return this.rsaKeyId || 'rsa-unknown';
  }

  /**
   * Generate JWT token pair
   */
  static generateTokenPair(payload: JWTPayload): TokenPair {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    return {
      accessToken,
      refreshToken
    };
  }

  /**
   * Generate access token
   */
  static generateAccessToken(payload: JWTPayload): string {
    return jwt.sign(
      {
        ...payload,
        tokenType: 'access'
      },
      this.ACCESS_SECRET,
      {
        expiresIn: this.ACCESS_EXPIRES_IN,
        issuer: 'sistema-licencas',
        audience: 'api'
      }
    );
  }

  /**
   * Generate refresh token
   */
  static generateRefreshToken(payload: JWTPayload): string {
    return jwt.sign(
      {
        ...payload,
        tokenType: 'refresh'
      },
      this.REFRESH_SECRET,
      {
        expiresIn: this.REFRESH_EXPIRES_IN,
        issuer: 'sistema-licencas',
        audience: 'api'
      }
    );
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.ACCESS_SECRET, {
        issuer: 'sistema-licencas',
        audience: 'api'
      }) as any;

      if (decoded.tokenType !== 'access') {
        throw new Error('Invalid token type');
      }

      return {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        type: decoded.type
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      throw error;
    }
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.REFRESH_SECRET, {
        issuer: 'sistema-licencas',
        audience: 'api'
      }) as any;

      if (decoded.tokenType !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        type: decoded.type
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token');
      }
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  static refreshAccessToken(refreshToken: string): TokenPair {
    const payload = this.verifyRefreshToken(refreshToken);
    return this.generateTokenPair(payload);
  }

  /**
   * Decode token without verification (for debugging)
   */
  static decodeToken(token: string): any {
    return jwt.decode(token);
  }

  /**
   * Get token expiration time
   */
  static getTokenExpiration(token: string): Date | null {
    const decoded = this.decodeToken(token);
    if (decoded && decoded.exp) {
      return new Date(decoded.exp * 1000);
    }
    return null;
  }

  /**
   * Generate offline license token with RSA signature
   * This token allows offline validation for a specified duration
   * Uses RS256 algorithm for enhanced security
   */
  static generateOfflineToken(payload: OfflineTokenPayload): string {
    // Get RSA private key for signing
    const { privateKey } = this.getRSAKeyPair();

    // Calculate expiration in seconds from valid_until
    const validUntil = new Date(payload.valid_until);
    const expiresInSeconds = Math.floor((validUntil.getTime() - Date.now()) / 1000);

    // Calculate soft check time (50% of offline period by default)
    const softCheckPercentage = parseFloat(process.env.OFFLINE_SOFT_CHECK_PERCENTAGE || '0.5');
    const softCheckTime = new Date(Date.now() + (expiresInSeconds * softCheckPercentage * 1000));

    // Get max offline validations from env (default 100)
    const maxOfflineValidations = parseInt(process.env.MAX_OFFLINE_VALIDATIONS || '100');

    // Sign with RSA private key (RS256)
    return jwt.sign(
      {
        license_key: payload.license_key,
        fingerprint_hash: payload.fingerprint_hash,
        accepted_fingerprint_hashes: payload.accepted_fingerprint_hashes,
        fingerprint_algorithm: payload.fingerprint_algorithm,
        valid_until: payload.valid_until,
        nonce: payload.nonce,
        issued_at: payload.issued_at,
        soft_check_after: softCheckTime.toISOString(),
        max_offline_validations: maxOfflineValidations,
        tokenType: 'offline_license',
        // Client data (optional)
        license_expires_at: payload.license_expires_at,
        client_username: payload.client_username,
        client_name: payload.client_name,
        client_email: payload.client_email,
        client_plan: payload.client_plan,
        client_id: payload.client_id
      },
      privateKey,
      {
        algorithm: 'RS256' as const,
        expiresIn: Math.max(1, expiresInSeconds),
        keyid: this.getPublicKeyId(),
        issuer: 'sistema-licencas',
        audience: 'license-client'
      }
    );
  }

  /**
   * Verify offline license token with RSA signature
   */
  static verifyOfflineToken(token: string): OfflineTokenPayload {
    try {
      // Get RSA public key for verification
      const { publicKey } = this.getRSAKeyPair();

      const decoded = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],  // RSA verification
        issuer: 'sistema-licencas',
        audience: 'license-client'
      }) as any;

      if (decoded.tokenType !== 'offline_license') {
        throw new Error('Invalid token type');
      }

      return {
        license_key: decoded.license_key,
        fingerprint_hash: decoded.fingerprint_hash,
        accepted_fingerprint_hashes: decoded.accepted_fingerprint_hashes,
        fingerprint_algorithm: decoded.fingerprint_algorithm,
        valid_until: decoded.valid_until,
        soft_check_after: decoded.soft_check_after,
        max_offline_validations: decoded.max_offline_validations,
        nonce: decoded.nonce,
        issued_at: decoded.issued_at,
        // Client data (optional)
        license_expires_at: decoded.license_expires_at,
        client_username: decoded.client_username,
        client_name: decoded.client_name,
        client_email: decoded.client_email,
        client_plan: decoded.client_plan,
        client_id: decoded.client_id
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Offline token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid offline token');
      }
      throw error;
    }
  }
}
