import { LicenseStatus, SubscriptionStatus } from '../types/license.types';

export interface ILicense {
  id: string;
  assinatura_id: string;
  programa_id: string;
  license_key: string;
  device_fingerprint?: IDeviceFingerprint;
  status: LicenseStatus;
  max_offline_hours: number;
  ultimo_acesso?: Date;
  ultimo_ip?: string;
  created_at: Date;
  updated_at?: Date;
}

export interface IDeviceComponent {
  value: string;
  weight: number;
  stable: boolean;
}

export interface IFingerprintHashes {
  v1?: string;
  v2: string;
  primary: string;
}

export interface IDeviceFingerprint {
  hash?: string;
  primary_hash?: string;
  fallback_until?: string;
  hashes?: IFingerprintHashes;
  components: {
    motherboard_serial?: IDeviceComponent;
    disk_serial?: IDeviceComponent;
    mac_address?: IDeviceComponent;
    cpu_signature?: IDeviceComponent;
    memory_slots?: IDeviceComponent;
    [key: string]: IDeviceComponent | undefined;
  };
  algorithm: string;
  total_weight?: number;
  generated_at?: string;
  raw_components?: Record<string, string>; // NEW: For client to send raw data
}

export interface ILicenseValidationRequest {
  license_key: string;
  /**
   * SECURITY: Client must send ONLY raw components (machine_id, disk_serial, etc.)
   * Server will process and generate hash/weights/algorithm server-side
   * Never trust hash/algorithm sent by client
   */
  device_fingerprint: IDeviceFingerprint | Record<string, string>;
  program_version: string;
  os_info: string;
  program_id?: string;
}

export interface ILicenseValidationResponse {
  valid: boolean;
  license_info?: {
    license_key: string;
    expiration: string;
    plan_name: string;
    features: string[];
    max_offline_hours: number;
  };
  offline_token?: string;
  offline_mode?: boolean;
  fingerprint?: IDeviceFingerprint;  // NEW: Server-processed fingerprint
  fallback_until?: string;
  public_key?: string;  // NEW: RSA public key for JWT verification
  public_key_kid?: string;
  cache_data?: {
    version: string;
    encrypted_payload: string;
    signature: string;
    expires_at: string;
  };
  security?: {
    risk_score: number;
    warnings: string[];
    next_heartbeat: number;
    flags?: ISecurityFlag[];
  };
  error?: string;
  reason?: string;
  message?: string;
  max_devices?: number;
  current_devices?: number;
}

export interface ISecurityFlag {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: string;
  timestamp?: string;
}

export interface ISubscription {
  id: string;
  cliente_id: string;
  plano_id: string;
  plano_nome?: string;
  max_offline_dias?: number;
  data_inicio: Date;
  data_fim: Date;
  auto_renovar: boolean;
  status: SubscriptionStatus;
  metadata?: any;
  created_at: Date;
  updated_at: Date;
}

export interface ICacheData {
  version: string;
  data: string;
  signature: string;
  algorithm: string;
  iv: string;
}

export interface ICachePayload {
  license_info: any;
  server_timestamp: number;
  cache_created: number;
  checksum_data: string;
  nonce: string;
  permissions: string[];
  offline_period: number;
}
