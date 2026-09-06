# syntax=docker/dockerfile:1

# Build stage
# NOTE: Cargo.lock is lockfile format v4 -> requires Cargo >= 1.78. The old
# rust:1.70 image cannot parse it, and bullseye is EOL (apt 404s for libssl1.1).
# rust:1-bookworm is the maintained rolling-stable Debian image (OpenSSL 3,
# same ABI as the bookworm runtime stage).
FROM rust:1-bookworm AS builder

# Create app directory
WORKDIR /usr/src/app

# Install native build dependencies for openssl-sys
# (sqlx / reqwest / lettre use native-tls -> links against system OpenSSL).
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# sqlx::query! macros verify SQL at compile time and read DATABASE_URL from the
# build environment (the build context has no .env — it is dockerignored — and
# no .sqlx/ offline cache is committed). Production DB credentials are injected
# as a BuildKit SECRET, never as ARG/ENV, so they cannot leak into image layers,
# history, or metadata. The secret is mounted only for this single RUN and is
# absent from the final image. Build with:
#   docker build --secret id=database_url,env=DATABASE_URL ...
# or commit a .sqlx/ cache via `cargo sqlx prepare` and pass no secret at all.
# Empty secret is treated as absent (-s guard): sqlx would fail parsing "" as a
# live connection URL.

# Copy source code (backend/.dockerignore excludes target/, .env*, docs, logs)
COPY . .

# Build app (secret consumed only inside this RUN; nothing persisted)
RUN --mount=type=secret,id=database_url \
    if [ -s /run/secrets/database_url ]; then \
        export DATABASE_URL="$(cat /run/secrets/database_url)"; \
    fi && \
    cargo build --release --locked

# Runtime stage
FROM debian:bookworm-slim

WORKDIR /usr/src/app

# Install runtime dependencies:
# - libssl3: OpenSSL 3 shared libs required by the native-tls linked binary
#   (replaces EOL bullseye libssl1.1, which 404s from apt mirrors)
# - ca-certificates: TLS verification for Postgres/HTTPS/SMTP/FCM calls
# - curl: used by the production compose healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy binary from builder (binary name preserved: task-scheduler-backend)
COPY --from=builder /usr/src/app/target/release/task-scheduler-backend .

# Create writable directories for mounted volumes and dedicated non-root user.
# - /usr/src/app/uploads : uploads bind mount (compose: ./uploads:/usr/src/app/uploads)
# - /usr/src/app/config  : config bind mount (main.rs reads
#   config/firebase-service-account.json relative to WORKDIR)
RUN groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid app --home-dir /usr/src/app --shell /usr/sbin/nologin app \
    && mkdir -p uploads config \
    && chown -R app:app /usr/src/app

# Set user
USER app

# Set environment variables.
# HOST/PORT keep the existing Docker/Compose contract (see backend/src/config.rs:
# SERVER_HOST/SERVER_PORT are canonical and WIN over HOST/PORT when both are set,
# so operators can still override via SERVER_* without baking them into the image).
ENV HOST=0.0.0.0
ENV PORT=8080

# Expose port
EXPOSE 8080

# Start app
CMD ["./task-scheduler-backend"]
