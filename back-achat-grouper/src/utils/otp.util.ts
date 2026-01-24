/**
 * Générer un code OTP à 6 chiffres
 */
export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Vérifier un code OTP
 */
export function verifyOtp(inputCode: string, storedCode: string): boolean {
  return inputCode === storedCode;
}