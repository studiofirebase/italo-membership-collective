// Aceita celular brasileiro (com ou sem DDI 55) ou internacional com "+" / "00" (E.164, 8 a 15 dígitos).
export function normalizePhone(value: string): string | null {
  const trimmed = value.trim()
  const digits = trimmed.replace(/\D/g, '')
  const international = trimmed.startsWith('+') || trimmed.startsWith('00')
  if (international) {
    const e164 = trimmed.startsWith('00') ? digits.slice(2) : digits
    return /^[1-9]\d{7,14}$/.test(e164) ? `+${e164}` : null
  }
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return `+${digits}`
  return null
}
