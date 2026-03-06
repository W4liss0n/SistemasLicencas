import { Inject, Injectable } from '@nestjs/common';
import { scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { AppConfigService } from '../../../config/app-config.service';

const scrypt = promisify(scryptCallback);

export const PASSWORD_HASH_VERSION = 'scrypt_v1';

@Injectable()
export class IdentityPasswordHasherService {
  constructor(@Inject(AppConfigService) private readonly configService: AppConfigService) {}

  async verifyPassword(params: {
    password: string;
    storedHash: string;
    storedSalt: string;
    hashVersion: string;
  }): Promise<boolean> {
    if (params.hashVersion !== PASSWORD_HASH_VERSION) {
      return false;
    }

    const expected = Buffer.from(params.storedHash, 'base64');
    const actual = await this.derive(params.password, params.storedSalt);

    if (expected.length !== actual.length) {
      return false;
    }

    return timingSafeEqual(expected, actual);
  }

  private async derive(password: string, salt: string): Promise<Buffer> {
    const peppered = `${password}:${this.configService.authPasswordPepper}`;
    return (await scrypt(peppered, salt, 64)) as Buffer;
  }
}
