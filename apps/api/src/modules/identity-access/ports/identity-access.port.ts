export type IdentityAccessFailureCode = 'invalid_credentials' | 'unauthorized_program';

export interface IdentityAccessFailure {
  ok: false;
  code: IdentityAccessFailureCode;
  detail: string;
}

export interface AuthenticateProgramClientInput {
  programId: string;
  identifier: string;
  password: string;
}

export interface AuthenticateProgramClientSuccess {
  ok: true;
  accessToken: string;
  issuedAt: string;
  expiresAt: string;
}

export type AuthenticateProgramClientResult =
  | AuthenticateProgramClientSuccess
  | IdentityAccessFailure;

export const IDENTITY_ACCESS_PORT = Symbol('IDENTITY_ACCESS_PORT');

export interface IdentityAccessPort {
  authenticateProgramClient(
    input: AuthenticateProgramClientInput
  ): Promise<AuthenticateProgramClientResult>;
}
