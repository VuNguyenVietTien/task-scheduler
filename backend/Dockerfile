# Build stage
FROM rust:1.70 as builder

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy source code
COPY . .

# Build app
RUN cargo build --release

# Runtime stage
FROM debian:bullseye-slim

WORKDIR /usr/src/app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl1.1 \
    && rm -rf /var/lib/apt/lists/*

# Copy binary from builder
COPY --from=builder /usr/src/app/target/release/task-scheduler-backend .

# Create upload directory
RUN mkdir uploads && chown -R nobody:nogroup uploads

# Set user
USER nobody

# Set environment variables
ENV HOST=0.0.0.0
ENV PORT=8080

# Expose port
EXPOSE 8080

# Start app
CMD ["./task-scheduler-backend"]
