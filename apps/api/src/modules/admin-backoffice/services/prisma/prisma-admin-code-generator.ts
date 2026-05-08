import { randomBytes } from 'node:crypto';

export function generateProgramCode(name: string): string {
  return generateCode(name);
}

export function generatePlanCode(name: string): string {
  return generateCode(name);
}

export function generateLicenseKey(programCode: string): string {
  const normalizedProgram =
    programCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6) || 'GEN';
  const randomPart = randomBytes(6).toString('hex').toUpperCase();
  return `LIC-${normalizedProgram}-${randomPart}`;
}

function generateCode(name: string): string {
  const slug = slugifyForCode(name).slice(0, 30);
  const suffix = randomBytes(2).toString('hex');
  return `${slug}-${suffix}`;
}

function slugifyForCode(value: string): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized.length > 0 ? normalized : 'item';
}
