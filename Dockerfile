FROM oven/bun:alpine

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S bunuser && \
    adduser -S bunuser -u 1001 -G bunuser

COPY --chown=bunuser:bunuser . .

USER bunuser

EXPOSE 8333

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8333/health || exit 1

CMD ["bun", "run", "server/index.ts"]
