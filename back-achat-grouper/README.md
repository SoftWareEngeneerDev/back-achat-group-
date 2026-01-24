# Backend - Plateforme d'Achats Groupés

API RESTful pour une plateforme e-commerce d'achats groupés développée avec Node.js, Express, TypeScript, Prisma et MySQL.

## 🚀 Technologies

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Langage**: TypeScript
- **Base de données**: MySQL 8.0
- **ORM**: Prisma
- **Cache**: Redis
- **Documentation**: Swagger/OpenAPI
- **Tests**: Jest
- **WebSockets**: Socket.io
- **Validation**: Zod

## 📋 Prérequis

- Node.js >= 18.0.0
- MySQL >= 8.0
- Redis (optionnel en dev)
- npm ou yarn

## 🛠️ Installation

```bash
# Cloner le repo
git clone <url>
cd backend-achat-grouper

# Installer les dépendances
npm install

# Copier le fichier .env
cp .env.example .env

# Configurer les variables d'environnement dans .env

# Générer Prisma Client
npm run prisma:generate

# Lancer les migrations
npm run prisma:migrate

# Seed la base de données (optionnel)
npm run prisma:seed
```

## 🚦 Démarrage

### Développement
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Avec Docker
```bash
docker-compose up -d
```

## 📚 Documentation API

La documentation Swagger est disponible à: `http://localhost:5000/api-docs`

## 🧪 Tests

```bash
# Lancer tous les tests
npm test

# Tests en mode watch
npm run test:watch

# Couverture de code
npm run test:coverage
```

## 📁 Structure du projet

```
src/
├── config/         # Configuration (DB, Redis, Swagger)
├── middlewares/    # Middlewares Express
├── modules/        # Modules métier (auth, products, groups, etc.)
├── jobs/           # Tâches planifiées (Cron)
├── utils/          # Utilitaires
├── types/          # Types TypeScript
├── websockets/     # WebSockets (Socket.io)
├── app.ts          # Configuration Express
└── server.ts       # Point d'entrée
```

## 🔑 Variables d'environnement

Voir `.env.example` pour la liste complète des variables requises.

## 📝 Scripts disponibles

- `npm run dev` - Démarrer en mode développement
- `npm run build` - Build pour production
- `npm start` - Démarrer en production
- `npm test` - Lancer les tests
- `npm run prisma:studio` - Interface Prisma Studio
- `npm run lint` - Vérifier le code

## 🔒 Sécurité

- JWT pour l'authentification
- Bcrypt pour les mots de passe
- Helmet pour les headers HTTP
- Rate limiting
- CORS configuré
- Validation des données avec Zod

## 📄 License

MIT