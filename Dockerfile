# Dockerfile - Babyshop Dropshipping API
# Build: docker build -t babyshop-api:1.0 .
# Run: docker run -p 3000:3000 --env-file .env babyshop-api:1.0

# Stage 1: Builder (Production build)
FROM node:18-alpine as builder

WORKDIR /app

# Copier fichiers de dépendances
COPY package*.json ./

# Installer dépendances (sans dev)
RUN npm ci --production

# Stage 2: Runtime (Image finale plus légère)
FROM node:18-alpine

WORKDIR /app

# Installer dumb-init pour gérer signaux
RUN apk add --no-cache dumb-init

# Créer utilisateur non-root pour sécurité
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copier dépendances installées depuis builder
COPY --from=builder /app/node_modules ./node_modules

# Copier fichiers application
COPY --chown=nodejs:nodejs api_dropshipping.js ./
COPY --chown=nodejs:nodejs package*.json ./

# Créer dossier logs
RUN mkdir -p logs && chown -R nodejs:nodejs logs

# Switch vers utilisateur non-root
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Démarrer avec dumb-init pour signaux
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "api_dropshipping.js"]

# Labels pour metadata
LABEL maintainer="Justme <contact@marcherbien.fr>"
LABEL description="API Dropshipping Babyshop - MongoDB + WooCommerce"
LABEL version="1.0.0"
