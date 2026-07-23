# Multi-stage Dockerfile for Podhound

# Stage 1: Build standalone compiled executable using Bun
FROM oven/bun:latest AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install

COPY migrations ./migrations
COPY src ./src

# Compile standalone executable
RUN bun build --compile --minify ./src/index.ts --outfile podhound

# Stage 2: Minimal runtime image
FROM alpine:latest AS runner
WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /app/podhound /app/podhound

# Directory for SQLite database persistence
RUN mkdir -p /app/data

ENV PORT=8080
ENV DATABASE_PATH=/app/data/podhound.db
EXPOSE 8080

CMD ["/app/podhound"]
