import { Inject, Injectable } from '@nestjs/common';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { AppConfigService } from '../../../config/app-config.service';

const scrypt = promisify(scryptCallback);

const PASSWORD_HASH_VERSION = 'scrypt_v1';

@Injectable()
export class EndUserPasswordService {
  constructor(@Inject(AppConfigService) private readonly configService: AppConfigService) {}

  async hashPassword(password: string): Promise<{
    hash: string;
    salt: string;
    hashVersion: string;
  }> {
    const salt = randomBytes(16).toString('hex');
    const hash = (await this.derive(password, salt)).toString('base64');

    return {
      hash,
      salt,
      hashVersion: PASSWORD_HASH_VERSION
    };
  }

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
