const ITERATIONS = 100_000
const KEY_LEN = 32 // bytes
const HASH_ALG = 'SHA-256'
const PREFIX = 'pbkdf2v1'

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function fromHex(hex: string): Uint8Array {
  const arr = hex.match(/.{2}/g)!
  return new Uint8Array(arr.map(b => parseInt(b, 16)))
}

async function deriveKey(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: HASH_ALG },
    keyMaterial,
    KEY_LEN * 8,
  )
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await deriveKey(password, salt)
  return `${PREFIX}:${toHex(salt.buffer)}:${toHex(hash)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored.startsWith(PREFIX + ':')) return false
  const parts = stored.split(':')
  if (parts.length !== 3) return false
  const salt = fromHex(parts[1])
  const expectedHash = parts[2]
  const hash = await deriveKey(password, salt)
  return toHex(hash) === expectedHash
}
