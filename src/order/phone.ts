export function formatPhone(value: string): string {
  const text = value.trim();
  if (!/^[\d\s()-]*$/.test(text)) return text;
  const digits = text.replace(/\D/g, "");
  if (/^1\d{7}$/.test(digits)) return digits.slice(0, 4) + "-" + digits.slice(4);
  const prefix = digits.startsWith("02") ? 2 : /^050[2-8]/.test(digits) && digits.length === 12 ? 4 : 3;
  if (digits.startsWith("0") && (digits.length === prefix + 7 || digits.length === prefix + 8)) {
    return digits.slice(0, prefix) + "-" + digits.slice(prefix, -4) + "-" + digits.slice(-4);
  }
  return text;
}
