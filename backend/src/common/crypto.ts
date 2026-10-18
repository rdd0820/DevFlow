import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/** GCM 推荐的初始向量长度。每次加密都重新生成，不能复用 */
const IV_LENGTH = 12;

/** 认证标签长度。解密时用它判断密文是否被改过，或者密钥是否不对 */
const TAG_LENGTH = 16;

/**
 * 由配置里的口令派生 32 字节密钥。
 * 口令本身可以是任意长度，AES-256 需要固定 32 字节。
 */
function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

/**
 * 加密仓库 token。
 * 返回值是 base64，内容依次为初始向量、认证标签和密文，存进文本列即可。
 */
export function encryptToken(token: string, secret: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

/**
 * 解密仓库 token。
 * 密钥不对、内容损坏或格式太短时返回 null，调用方应把同步降级为匿名访问，而不是抛错。
 */
export function decryptToken(encrypted: string, secret: string): string | null {
  try {
    const raw = Buffer.from(encrypted, 'base64');
    if (raw.length < IV_LENGTH + TAG_LENGTH) return null;
    const iv = raw.subarray(0, IV_LENGTH);
    const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = raw.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
