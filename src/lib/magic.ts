export function generateToken(len = 32) {
  // URL-safe base64-ish token
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}
