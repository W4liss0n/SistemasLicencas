import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

export const redis = new Redis(redisConfig);

redis.on('connect', () => {
  console.log('Redis client connected');
});

redis.on('error', (err) => {
  console.error('Redis client error:', err);
});

redis.on('ready', () => {
  console.log('Redis client ready');
});

export const cachePatterns = {
  licenseValidation: (key: string) => `license:${key}:validation`,
  fingerprintCache: (hash: string) => `fingerprint:${hash}:data`,
  rateLimit: (identifier: string, window: string) => `ratelimit:${identifier}:${window}`,
  fraudScore: (license: string) => `fraud:${license}:score`,
  geoLocation: (ip: string) => `geo:${ip}:location`,
  cacheSync: (programId: string, licenseKey: string) => `cache:${programId}:${licenseKey}`,
} as const;

export const cacheTTL = {
  licenseValidation: parseInt(process.env.CACHE_LICENSE_TTL || '3600'),
  fingerprintCache: parseInt(process.env.CACHE_FINGERPRINT_TTL || '86400'),
  rateLimit: 3600,
  fraudScore: 1800,
  geoLocation: 604800,
  cacheSync: 604800,
} as const;

export default redis;