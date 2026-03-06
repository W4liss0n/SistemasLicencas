import { Request, Response, NextFunction } from 'express';
import redis, { cachePatterns } from '../../../data/database/config/redis.config';

interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

const DEFAULT_OPTIONS: RateLimitOptions = {
  windowMs: parseInt(process.env.DEFAULT_RATE_LIMIT_WINDOW_MS || '3600000'), // 1 hour
  maxRequests: parseInt(process.env.DEFAULT_RATE_LIMIT_MAX_REQUESTS || '1000'),
  message: 'Too many requests, please try again later'
};

export const createRateLimiter = (options: RateLimitOptions = {}) => {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Generate key for rate limiting
      const key = config.keyGenerator
        ? config.keyGenerator(req)
        : req.ip || 'unknown';

      const rateLimitKey = cachePatterns.rateLimit(
        key,
        Math.floor(Date.now() / config.windowMs!).toString()
      );

      // Get current count
      const currentCount = await redis.get(rateLimitKey);
      const count = currentCount ? parseInt(currentCount) : 0;

      if (count >= config.maxRequests!) {
        // Add rate limit headers
        res.setHeader('X-RateLimit-Limit', config.maxRequests!.toString());
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader(
          'X-RateLimit-Reset',
          new Date(
            Math.ceil(Date.now() / config.windowMs!) * config.windowMs!
          ).toISOString()
        );

        return res.status(429).json({
          error: config.message,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil(config.windowMs! / 1000)
        });
      }

      // Increment counter
      const pipeline = redis.pipeline();
      pipeline.incr(rateLimitKey);
      pipeline.expire(rateLimitKey, Math.ceil(config.windowMs! / 1000));
      await pipeline.exec();

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', config.maxRequests!.toString());
      res.setHeader(
        'X-RateLimit-Remaining',
        (config.maxRequests! - count - 1).toString()
      );
      res.setHeader(
        'X-RateLimit-Reset',
        new Date(
          Math.ceil(Date.now() / config.windowMs!) * config.windowMs!
        ).toISOString()
      );

      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Don't block request if rate limiting fails
      next();
    }
  };
};

// Default rate limiter for API endpoints
export const rateLimiter = createRateLimiter({
  keyGenerator: (req: Request) => {
    // Prefer identifiers tied to the user/license to avoid shared IP buckets
    const bodyKey =
      (req.body && (req.body.license_key || req.body.username || req.body.email)) ||
      (req.headers['x-program-id'] as string);
    return bodyKey || req.ip || 'unknown';
  }
});

// Strict rate limiter for sensitive endpoints
export const strictRateLimiter = createRateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 10,
  message: 'Too many requests to this endpoint'
});

// Burst rate limiter for high-traffic endpoints
export const burstRateLimiter = createRateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 60,
  message: 'Burst limit exceeded'
});
