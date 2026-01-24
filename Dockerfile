# Build stage
FROM oven/bun:alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Production stage
FROM oven/bun:alpine

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S bunuser && \
    adduser -S bunuser -u 1001 -G bunuser

# Copy from builder
COPY --from=builder /app /app

# Change to non-root user
USER bunuser

# Expose port
EXPOSE 8333

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8333/ || exit 1

# Run the application
CMD ["bun", "run", "index.js"]
