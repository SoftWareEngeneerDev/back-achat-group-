# 🛒 Achats Groupés BF — Backend

Backend Node.js de la plateforme d'e-commerce d'achats groupés pour le Burkina Faso.

## Stack Technique
- **Runtime** : Node.js + Express
- **Base de données** : PostgreSQL + Prisma ORM
- **Auth** : JWT + bcrypt + OTP SMS (Twilio)
- **Temps réel** : Socket.io
- **Paiements** : CinetPay (Orange Money, Moov Money, Ligdicash, Cartes)
- **Notifications** : SendGrid (email) + Twilio (SMS)
- **Documentation** : Swagger UI
- **Tests** : Jest + Supertest

## Installation

```bash
# 1. Cloner et installer les dépendances
npm install

# 2. Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos vraies valeurs

# 3. Initialiser la base de données
npx prisma migrate dev --name init
npx prisma generate

# 4. Seed (données initiales)
npm run prisma:seed

# 5. Démarrer en développement
npm run dev
```

## Endpoints principaux

| Module | Base URL |
|--------|----------|
| Auth | `/api/v1/auth` |
| Utilisateurs | `/api/v1/users` |
| Produits | `/api/v1/products` |
| Groupes | `/api/v1/groups` |
| Paiements | `/api/v1/payments` |
| Commandes | `/api/v1/orders` |
| Notifications | `/api/v1/notifications` |
| Avis | `/api/v1/products/:id/reviews` |
| Litiges | `/api/v1/disputes` |
| Admin | `/api/v1/admin` |

**Documentation Swagger** : http://localhost:3000/api/v1/docs

## Comptes de test (après seed)

| Rôle | Téléphone | Mot de passe |
|------|-----------|--------------|
| Admin | +22600000001 | Admin@2024! |
| Fournisseur | +22600000002 | Supplier@2024! |
| Membre | +22670000001 | Member@2024! |

## Variables d'environnement requises

Voir `.env.example` pour la liste complète.

## Structure du projet

```
src/
├── config/         # DB, env, swagger, constants
├── middleware/      # auth, validate, rateLimit, errorHandler
├── modules/
│   ├── auth/       # Inscription, connexion, OTP, JWT
│   ├── users/      # Profil, dashboard, admin users
│   ├── products/   # Catalogue, CRUD fournisseur, validation admin
│   ├── groups/     # Groupes d'achat, tarification dynamique
│   ├── payments/   # CinetPay, escrow, remboursements
│   ├── orders/     # Commandes, tracking, livraison
│   ├── notifications/ # Push, email, SMS temps réel
│   ├── reviews/    # Avis produits
│   ├── disputes/   # Litiges
│   └── admin/      # Fournisseurs, analytics, monitoring
├── sockets/        # Socket.io rooms et events
├── jobs/           # CRON : expiration groupes, nettoyage
└── utils/          # Logger, response, helpers
```
