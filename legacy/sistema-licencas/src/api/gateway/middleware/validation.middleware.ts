import { Request, Response, NextFunction } from 'express';

interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
}

const validationSchemas: Record<string, ValidationRule[]> = {
  licenseValidation: [
    {
      field: 'license_key',
      required: true,
      type: 'string',
      pattern: /^LIC-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/
    },
    {
      field: 'device_fingerprint',
      required: true,
      type: 'object',
      custom: (value) => {
        // New format: raw components sent directly by client
        // Server will build the fingerprint with server-side algorithm
        if (!value.machine_id || typeof value.machine_id !== 'string') {
          return 'machine_id is required in device fingerprint';
        }
        // disk_serial and mac_address are optional (for flexibility)
        return true;
      }
    },
    {
      field: 'program_version',
      required: true,
      type: 'string'
    },
    {
      field: 'os_info',
      required: false,
      type: 'string'
    }
  ],
  licenseActivation: [
    {
      field: 'license_key',
      required: true,
      type: 'string',
      pattern: /^LIC-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/
    },
    {
      field: 'device_fingerprint',
      required: true,
      type: 'object'
    }
  ],
  licenseHeartbeat: [
    {
      field: 'license_key',
      required: true,
      type: 'string'
    }
  ],
  licenseDeactivation: [
    {
      field: 'license_key',
      required: true,
      type: 'string'
    }
  ],
  licenseTransfer: [
    {
      field: 'license_key',
      required: true,
      type: 'string'
    },
    {
      field: 'new_device_fingerprint',
      required: true,
      type: 'object'
    }
  ]
};

export const validateRequest = (schemaName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const schema = validationSchemas[schemaName];

    if (!schema) {
      console.error(`Validation schema '${schemaName}' not found`);
      return next();
    }

    const errors: string[] = [];

    for (const rule of schema) {
      const value = getFieldValue(req.body, rule.field);

      // Check required
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`Field '${rule.field}' is required`);
        continue;
      }

      // Skip validation if field is not required and not present
      if (!rule.required && (value === undefined || value === null)) {
        continue;
      }

      // Check type
      if (rule.type && typeof value !== rule.type) {
        errors.push(`Field '${rule.field}' must be of type ${rule.type}`);
        continue;
      }

      // Check string length
      if (rule.type === 'string' && typeof value === 'string') {
        if (rule.minLength && value.length < rule.minLength) {
          errors.push(`Field '${rule.field}' must be at least ${rule.minLength} characters`);
        }
        if (rule.maxLength && value.length > rule.maxLength) {
          errors.push(`Field '${rule.field}' must be at most ${rule.maxLength} characters`);
        }
      }

      // Check pattern
      if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
        errors.push(`Field '${rule.field}' has invalid format`);
      }

      // Custom validation
      if (rule.custom) {
        const result = rule.custom(value);
        if (result !== true) {
          errors.push(typeof result === 'string' ? result : `Field '${rule.field}' validation failed`);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors
      });
    }

    next();
  };
};

/**
 * Get nested field value from object
 */
function getFieldValue(obj: any, path: string): any {
  const keys = path.split('.');
  let value = obj;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }

  return value;
}