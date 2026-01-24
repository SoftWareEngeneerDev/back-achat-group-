/**
 * Valider une adresse email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valider un numéro de téléphone ivoirien
 */
export function isValidPhoneNumber(phone: string): boolean {
  const phoneRegex = /^(\+225)?[0-9]{10}$/;
  return phoneRegex.test(phone);
}

/**
 * Valider que la ville est Ouagadougou
 */
export function isValidCity(city: string): boolean {
  return city.toLowerCase() === 'ouagadougou';
}

/**
 * Formater un numéro de téléphone
 */
export function formatPhoneNumber(phone: string): string {
  // Ajouter +225 si absent
  if (!phone.startsWith('+225')) {
    return `+225${phone}`;
  }
  return phone;
}