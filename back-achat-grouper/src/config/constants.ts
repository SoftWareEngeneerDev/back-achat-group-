// Rôles utilisateur
export const ROLES = {
  VISITOR: 'VISITOR',
  MEMBER: 'MEMBER',
  SUPPLIER: 'SUPPLIER',
  ADMIN: 'ADMIN',
} as const;

// Statuts de groupe
export const GROUP_STATUS = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

// Statuts de commande
export const ORDER_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  PROCESSING: 'PROCESSING',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
} as const;

// Statuts de paiement
export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const;

// Méthodes de paiement
export const PAYMENT_METHODS = {
  ORANGE_MONEY: 'ORANGE_MONEY',
  MOOV_MONEY: 'MOOV_MONEY',
  LIGDICASH: 'LIGDICASH',
  CARD: 'CARD',
} as const;

// Types de notification
export const NOTIFICATION_TYPES = {
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  PUSH: 'PUSH',
  WHATSAPP: 'WHATSAPP',
} as const;

// Statuts fournisseur
export const SUPPLIER_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED',
} as const;

// Statuts produit
export const PRODUCT_STATUS = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  ARCHIVED: 'ARCHIVED',
} as const;

// Délai de remboursement (en heures)
export const REFUND_DELAY_HOURS = 72;

// Durée de validité OTP (en minutes)
export const OTP_VALIDITY_MINUTES = 10;

// Taille maximale upload (en bytes)
export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB

// Formats d'images acceptés
export const ALLOWED_IMAGE_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];

// Pagination par défaut
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Durée de cache (en secondes)
export const CACHE_TTL = {
  SHORT: 300, // 5 minutes
  MEDIUM: 1800, // 30 minutes
  LONG: 3600, // 1 heure
  DAY: 86400, // 24 heures
};

// Messages d'erreur
export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Non autorisé',
  FORBIDDEN: 'Accès interdit',
  NOT_FOUND: 'Ressource non trouvée',
  VALIDATION_ERROR: 'Erreur de validation',
  INTERNAL_ERROR: 'Erreur interne du serveur',
  GROUP_FULL: 'Le groupe est complet',
  GROUP_EXPIRED: 'Le groupe a expiré',
  INSUFFICIENT_FUNDS: 'Solde insuffisant',
  ALREADY_MEMBER: 'Vous êtes déjà membre de ce groupe',
};

// Messages de succès
export const SUCCESS_MESSAGES = {
  CREATED: 'Créé avec succès',
  UPDATED: 'Mis à jour avec succès',
  DELETED: 'Supprimé avec succès',
  GROUP_JOINED: 'Vous avez rejoint le groupe avec succès',
  PAYMENT_SUCCESS: 'Paiement effectué avec succès',
};