export function whatsappLink(phone: string | null | undefined, message: string): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 8) return null;

  let international = digits;
  if (international.startsWith('00')) international = international.slice(2);
  if (international.startsWith('0')) international = `383${international.slice(1)}`;
  else if (!international.startsWith('383') && international.length <= 9) international = `383${international}`;

  return `https://wa.me/${international}?text=${encodeURIComponent(message)}`;
}
