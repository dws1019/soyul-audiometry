/** 고유 id. crypto.randomUUID는 보안 컨텍스트(https, localhost)에서만 있으므로 대체 경로를 둡니다. */
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' && globalThis.isSecureContext) {
    return crypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
