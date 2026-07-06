// Ende-zu-Ende-Verschlüsselung für den Sync-Ordner (optional).
//
// Format jeder verschlüsselten Datei:
//   "KLVRENC1" (8 Byte Magic) + IV (12 Byte) + AES-256-GCM-Ciphertext
//
// Der Schlüssel wird per PBKDF2-SHA256 (310.000 Iterationen) aus der
// Passphrase abgeleitet. Das Salt liegt als Klartext in meta/encryption.json
// im Sync-Ordner; meta/keycheck erlaubt die Passphrasen-Prüfung beim Verbinden.

const MAGIC = new TextEncoder().encode('KLVRENC1');
const PBKDF2_ITERATIONS = 310_000;
const KEYCHECK_PLAINTEXT = 'klevr-sync-keycheck-v1';

export interface EncryptionContext {
  key: CryptoKey;
}

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function generateSalt(): Uint8Array {
  return randomBytes(16);
}

export async function encryptBytes(ctx: EncryptionContext, plain: Uint8Array): Promise<Uint8Array> {
  const iv = randomBytes(12);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, ctx.key, plain as BufferSource),
  );
  const out = new Uint8Array(MAGIC.length + iv.length + cipher.length);
  out.set(MAGIC, 0);
  out.set(iv, MAGIC.length);
  out.set(cipher, MAGIC.length + iv.length);
  return out;
}

export function isEncrypted(data: Uint8Array): boolean {
  if (data.length < MAGIC.length) return false;
  for (let i = 0; i < MAGIC.length; i++) {
    if (data[i] !== MAGIC[i]) return false;
  }
  return true;
}

export async function decryptBytes(ctx: EncryptionContext, data: Uint8Array): Promise<Uint8Array> {
  if (!isEncrypted(data)) {
    throw new Error('Datei ist nicht verschlüsselt oder beschädigt');
  }
  const iv = data.subarray(MAGIC.length, MAGIC.length + 12);
  const cipher = data.subarray(MAGIC.length + 12);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      ctx.key,
      cipher as BufferSource,
    );
    return new Uint8Array(plain);
  } catch {
    throw new Error('Entschlüsselung fehlgeschlagen – falsche Passphrase oder beschädigte Datei');
  }
}

/** Erzeugt den Inhalt der keycheck-Datei. */
export async function buildKeycheck(ctx: EncryptionContext): Promise<Uint8Array> {
  return encryptBytes(ctx, new TextEncoder().encode(KEYCHECK_PLAINTEXT));
}

/** Prüft die Passphrase gegen eine vorhandene keycheck-Datei. */
export async function verifyKeycheck(ctx: EncryptionContext, data: Uint8Array): Promise<boolean> {
  try {
    const plain = await decryptBytes(ctx, data);
    return new TextDecoder().decode(plain) === KEYCHECK_PLAINTEXT;
  } catch {
    return false;
  }
}

/** SHA-256 als Hex-String (für Blob-Adressen und Integritätsprüfung). */
export async function sha256Hex(data: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', data as BufferSource);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
