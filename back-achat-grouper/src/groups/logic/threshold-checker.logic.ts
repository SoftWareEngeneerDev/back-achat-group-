/**
 * Vérifier si le seuil minimum est atteint
 */
export function isThresholdReached(currentParticipants: number, minParticipants: number): boolean {
  return currentParticipants >= minParticipants;
}

/**
 * Vérifier si le groupe est complet
 */
export function isGroupFull(currentParticipants: number, maxParticipants: number): boolean {
  return currentParticipants >= maxParticipants;
}

/**
 * Calculer le pourcentage de complétion
 */
export function getCompletionPercentage(currentParticipants: number, maxParticipants: number): number {
  return Math.round((currentParticipants / maxParticipants) * 100);
}
