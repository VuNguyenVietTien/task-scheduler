# syntax=docker/dockerfile:1.4
FROM rust:slim-bullseye as builder

# Set build-time metadata
LABEL stage=builder
LABEL project="task-scheduler"
LABEL component="backend"

# Switch to nightly Rust
RUN rustup default nightly
RUN rustup update
RUN rustup component add rustfmt clippy

WORKDIR /usr/src/app

# Configure apt and install build dependencies
RUN echo 'Acquire::Retries "5";' > /etc/apt/apt.conf.d/80-retries && \
    echo 'APT::Install-Recommends "false";' >> /etc/apt/apt.conf.d/80-retries && \
    echo 'Acquire::Check-Valid-Until "false";' >> /etc/apt/apt.conf.d/80-retries && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
      apt-transport-https \
      ca-certificates \
      pkg-config \
      libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy manifest files first for better caching
COPY Cargo.toml Cargo.lock ./
COPY entity/Cargo.toml entity/
COPY migration/Cargo.toml migration/

# Create dummy source files to build dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs && \
    mkdir -p entity/src && echo "pub fn main() {}" > entity/src/lib.rs && \
    mkdir -p migration/src && echo "pub fn main() {}" > migration/src/lib.rs

# Build dependencies only
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=target \
    cargo build --release

# Now copy the actual source code
COPY src src/
COPY entity/src entity/src/
COPY migration/src migration/src/

# Build with cache mounted
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=target \
    cargo build --release && \
    cp target/release/task-scheduler-backend /usr/src/app/

# Runtime stage
FROM debian:bullseye-slim

# Set runtime metadata
LABEL maintainer="ProjectManager Team"
LABEL project="task-scheduler"
LABEL component="backend"
LABEL version="1.0"

WORKDIR /usr/local/bin

# Install runtime dependencies and create non-root user in one layer
RUN echo 'Acquire::Retries "5";' > /etc/apt/apt.conf.d/80-retries && \
    echo 'APT::Install-Recommends "false";' >> /etc/apt/apt.conf.d/80-retries && \
    echo 'Acquire::Check-Valid-Until "false";' >> /etc/apt/apt.conf.d/80-retries && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      openssl \
      curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -u 1001 -U app

# Create config directory
RUN mkdir -p /etc/task-scheduler && chown app:app /etc/task-scheduler

# Copy only the built binary
COPY --from=builder --chown=app:app /usr/src/app/task-scheduler-backend ./

USER app

# Set environment configuration path
ENV CONFIG_PATH=/etc/task-scheduler/.env

EXPOSE 4000

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

ENTRYPOINT ["./task-scheduler-backend"]
CMD ["--host", "0.0.0.0", "--port", "4000"]
