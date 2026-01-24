/**
 * Calculer le prix en fonction du nombre de participants
 */
export function calculateGroupPrice(
  basePrice: number,
  currentParticipants: number,
  discountCurve: Array<{ participants: number; discountPercent: number }>
): number {
  // Trier la courbe par nombre de participants (ordre décroissant)
  const sortedCurve = [...discountCurve].sort((a, b) => b.participants - a.participants);

  // Trouver le palier applicable
  const applicableTier = sortedCurve.find(tier => currentParticipants >= tier.participants);

  if (!applicableTier) {
    return basePrice; // Aucune réduction
  }

  // Calculer le prix avec réduction
  const discount = basePrice * (applicableTier.discountPercent / 100);
  return basePrice - discount;
}

/**
 * Calculer le montant du dépôt (10% du prix actuel)
 */
export function calculateDepositAmount(currentPrice: number, depositPercent: number = 10): number {
  return currentPrice * (depositPercent / 100);
}

/**
 * Calculer le solde final à payer
 */
export function calculateFinalPayment(currentPrice: number, depositPaid: number): number {
  return currentPrice - depositPaid;
}