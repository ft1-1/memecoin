# Multi-stage Docker build for production deployment
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    sqlite \
    curl \
    dumb-init

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S deployuser -u 1001 -G nodejs

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Development stage
FROM base AS development

# Install all dependencies (including dev dependencies)
RUN npm ci --include=dev

# Copy source code
COPY src ./src
COPY config ./config

# Create directories with proper permissions
RUN mkdir -p database/data logs && \
    chown -R deployuser:nodejs database logs

# Switch to non-root user
USER deployuser

# Expose health check port
EXPOSE 3001

# Start in development mode
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build

# Install all dependencies
RUN npm ci --include=dev

# Copy source code and configs
COPY src ./src
COPY config ./config

# Build the application
RUN npm run build

# Production dependencies stage
FROM base AS deps

# Install only production dependencies
RUN npm ci --only=production --ignore-scripts

# Production stage
FROM base AS production

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy built application
COPY --from=build /app/dist ./dist
COPY --from=build /app/config ./config

# Copy package.json for runtime
COPY package.json ./

# Create required directories and set permissions
RUN mkdir -p database/data logs && \
    chown -R deployuser:nodejs /app

# Switch to non-root user
USER deployuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Expose health check port
EXPOSE 3001

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["npm", "start"]

# Production optimized stage
FROM production AS production-optimized

# Additional optimizations for production
USER root

# Install additional production utilities
RUN apk add --no-cache \
    tini \
    ca-certificates

# Optimize SQLite
RUN echo "PRAGMA journal_mode=WAL;" > /tmp/optimize.sql && \
    echo "PRAGMA synchronous=NORMAL;" >> /tmp/optimize.sql && \
    echo "PRAGMA cache_size=10000;" >> /tmp/optimize.sql

# Switch back to app user
USER deployuser

# Use tini as init system
ENTRYPOINT ["tini", "--"]
CMD ["npm", "start"]