#!/usr/bin/env node
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Generate RSA key pair for offline token signing
 *
 * This script generates:
 * - RSA-2048 private key (PKCS8 format)
 * - RSA-2048 public key (SPKI format)
 *
 * Keys are saved to:
 * - keys/private.pem (KEEP SECRET!)
 * - keys/public.pem (can be distributed)
 *
 * Also outputs environment variable format for .env file
 */

console.log('🔐 Generating RSA Key Pair for Offline Token Signing...\n');

// Create keys directory if it doesn't exist
const keysDir = path.join(__dirname, '..', 'keys');
if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir, { recursive: true });
  console.log(`✓ Created directory: ${keysDir}`);
}

// Generate RSA key pair (2048 bits)
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

// Save keys to files
const privateKeyPath = path.join(keysDir, 'private.pem');
const publicKeyPath = path.join(keysDir, 'public.pem');

fs.writeFileSync(privateKeyPath, privateKey, { mode: 0o600 }); // Read/write for owner only
fs.writeFileSync(publicKeyPath, publicKey);

console.log(`✓ Private key saved to: ${privateKeyPath}`);
console.log(`✓ Public key saved to: ${publicKeyPath}\n`);

// Output environment variable format
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📋 Add these lines to your .env file:\n');

const privateKeyEnv = privateKey.replace(/\n/g, '\\n');
const publicKeyEnv = publicKey.replace(/\n/g, '\\n');

console.log('RSA_PRIVATE_KEY="' + privateKeyEnv + '"');
console.log('\nRSA_PUBLIC_KEY="' + publicKeyEnv + '"\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

console.log('\n⚠️  SECURITY WARNINGS:');
console.log('  1. NEVER commit private.pem or RSA_PRIVATE_KEY to version control!');
console.log('  2. Add "keys/*.pem" to your .gitignore file');
console.log('  3. Keep RSA_PRIVATE_KEY secret - it signs all offline tokens');
console.log('  4. RSA_PUBLIC_KEY can be safely distributed to clients\n');

// Check if .gitignore exists and update it
const gitignorePath = path.join(__dirname, '..', '.gitignore');
if (fs.existsSync(gitignorePath)) {
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
  if (!gitignoreContent.includes('keys/')) {
    fs.appendFileSync(gitignorePath, '\n# RSA Keys\nkeys/*.pem\n');
    console.log('✓ Updated .gitignore to exclude RSA keys\n');
  }
} else {
  fs.writeFileSync(gitignorePath, '# RSA Keys\nkeys/*.pem\n');
  console.log('✓ Created .gitignore with RSA key exclusions\n');
}

console.log('✅ RSA key pair generation complete!\n');
