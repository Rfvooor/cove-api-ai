# Production Dockerfile for Cove API AI

# Stage 1: Base image with Node.js and pnpm
FROM node:20-alpine AS base
LABEL org.opencontainers.image.source=https://github.com/your-org/cove-api-ai
LABEL org.opencontainers.image.description="Cove API AI - Production Image"
LABEL org.opencontainers.image.licenses=MIT

# Install system dependencies and pnpm
RUN apk add --no-cache \
    libc6-compat \
    git \
    curl \
    bash \
    python3 \
    openssl

# Install pnpm globally
RUN npm install -g pnpm

# Stage 2: Dependencies installation
FROM base AS dependencies
WORKDIR /app

# Copy package management files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies
RUN pnpm install --frozen-lockfile --prod

# Stage 3: Build
FROM base AS builder
WORKDIR /app

# Copy all project files
COPY . .

# Install all dependencies (including dev)
RUN pnpm install --frozen-lockfile

# Build the application
RUN pnpm build

# Stage 4: Production
FROM base AS production
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S coveai -u 1001

# Copy built artifacts from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy additional necessary files
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/.env.example ./.env

# Set permissions
RUN chown -R coveai:nodejs /app
USER coveai

# Expose application port
EXPOSE 4000

# Set environment to production
ENV NODE_ENV=production
ENV LOG_LEVEL=info

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

# Runtime configuration and startup
CMD ["node", "--max-old-space-size=4096", "dist/index.js"]

# Optional: Add metadata labels
LABEL maintainer="Your Name <your.email@example.com>"
LABEL version="0.1.0"
LABEL description="Multi-Agent AI Framework with Intelligent Orchestration"