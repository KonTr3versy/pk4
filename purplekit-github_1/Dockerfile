# =============================================================================
# PurpleKit Dockerfile
# =============================================================================
# This creates a single container that runs both the frontend and backend.
# 
# Build: docker build -t purplekit .
# Run:   docker run -p 3000:3000 -e DATABASE_URL=... purplekit
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build the frontend
# -----------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files first (better caching)
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY frontend/ ./

# Build the production bundle
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Production image
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production

# Install curl for healthchecks
RUN apk add --no-cache curl

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./backend/

# Install backend dependencies (production only)
WORKDIR /app/backend
RUN npm ci --only=production

# Copy backend source
COPY backend/src ./src

# Copy built frontend from Stage 1
COPY --from=frontend-builder /app/frontend/dist ../frontend/dist

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the server
CMD ["node", "src/index.js"]
