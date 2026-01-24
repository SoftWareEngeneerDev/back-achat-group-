/**
 * Vérifier si le groupe a expiré
 */
export function isGroupExpired(endDate: Date): boolean {
  return new Date() > endDate;
}

/**
 * Calculer le temps restant en heures
 */
export function getTimeLeftInHours(endDate: Date): number {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60)));
}

/**
 * Formater le temps restant
 */
export function formatTimeLeft(endDate: Date): string {
  const hours = getTimeLeftInHours(endDate);
  
  if (hours === 0) {
    return 'Expiré';
  } else if (hours < 24) {
    return `${hours} heure${hours > 1 ? 's' : ''} restante${hours > 1 ? 's' : ''}`;
  } else {
    const days = Math.floor(hours / 24);
    return `${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}`;
  }
}