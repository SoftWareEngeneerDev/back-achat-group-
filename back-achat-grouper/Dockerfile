FROM node:18-alpine

# Créer le répertoire de l'application
WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./
COPY prisma ./prisma/

# Installer les dépendances
RUN npm ci --only=production

# Copier le code source
COPY . .

# Générer Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Exposer le port
EXPOSE 5000

# Créer les dossiers nécessaires
RUN mkdir -p uploads logs

# Démarrer l'application
CMD ["npm", "start"]