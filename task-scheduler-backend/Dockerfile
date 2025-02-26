FROM rust:1.75-slim as builder

WORKDIR /usr/src/app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy manifests
COPY Cargo.toml Cargo.lock ./

# Copy source code
COPY src ./src/

# Build the application
RUN cargo build --release

# Runtime stage
FROM debian:bullseye-slim

WORKDIR /usr/local/bin

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy the built binary from builder
COPY --from=builder /usr/src/app/target/release/task-scheduler-backend ./

# Copy configuration files if needed
COPY config ./config

# Create a non-root user
RUN useradd -m -u 1001 -U app
USER app

EXPOSE 4000

CMD ["./task-scheduler-backend"]
