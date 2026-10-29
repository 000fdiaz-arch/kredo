export function toWhatsAppPhone(phone: string) {
  let digits = phone.replace(/\D/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.length === 8) {
    return `507${digits}`;
  }

  return digits;
}
