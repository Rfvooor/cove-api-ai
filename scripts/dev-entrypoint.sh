#!/bin/bash

# Strict mode for bash scripting
set -euo pipefail

# Color codes for logging
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Log function with colored output
log() {
    local level="$1"
    local message="$2"
    local color=""

    case "$level" in
        "INFO")
            color=$GREEN
            ;;
        "WARN")
            color=$YELLOW
            ;;
        "ERROR")
            color=$RED
            ;;
        *)
            color=$NC
            ;;
    esac

    echo -e "${color}[${level}] ${message}${NC}"
}

# Check required environment variables
check_env_vars() {
    local required_vars=(
        "NODE_ENV"
        "OPENROUTER_API_KEY"
        "POSTGRES_HOST"
        "REDIS_HOST"
    )

    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log "ERROR" "Missing required environment variable: $var"
            exit 1
        fi
    done
}

# Database migration function
run_migrations() {
    log "INFO" "Running database migrations..."
    pnpm db:migrate
}

# Seed initial data if needed
seed_data() {
    log "INFO" "Seeding initial data..."
    pnpm db:seed
}

# Wait for database to be ready
wait_for_postgres() {
    local host="${POSTGRES_HOST:-localhost}"
    local port="${POSTGRES_PORT:-5432}"
    local max_attempts=30
    local attempt=0

    log "INFO" "Waiting for PostgreSQL to be ready..."

    while ! nc -z "$host" "$port"; do
        attempt=$((attempt + 1))
        if [ $attempt -gt $max_attempts ]; then
            log "ERROR" "PostgreSQL did not become ready in time"
            exit 1
        fi
        log "WARN" "Waiting for PostgreSQL... (Attempt $attempt/$max_attempts)"
        sleep 2
    done

    log "INFO" "PostgreSQL is ready!"
}

# Wait for Redis to be ready
wait_for_redis() {
    local host="${REDIS_HOST:-localhost}"
    local port="${REDIS_PORT:-6379}"
    local max_attempts=30
    local attempt=0

    log "INFO" "Waiting for Redis to be ready..."

    while ! nc -z "$host" "$port"; do
        attempt=$((attempt + 1))
        if [ $attempt -gt $max_attempts ]; then
            log "ERROR" "Redis did not become ready in time"
            exit 1
        fi
        log "WARN" "Waiting for Redis... (Attempt $attempt/$max_attempts)"
        sleep 2
    done

    log "INFO" "Redis is ready!"
}

# Wait for ChromaDB to be ready
wait_for_chroma() {
    local host="${CHROMA_HOST:-localhost}"
    local port="${CHROMA_PORT:-8000}"
    local max_attempts=30
    local attempt=0

    log "INFO" "Waiting for ChromaDB to be ready..."

    while ! nc -z "$host" "$port"; do
        attempt=$((attempt + 1))
        if [ $attempt -gt $max_attempts ]; then
            log "ERROR" "ChromaDB did not become ready in time"
            exit 1
        fi
        log "WARN" "Waiting for ChromaDB... (Attempt $attempt/$max_attempts)"
        sleep 2
    done

    log "INFO" "ChromaDB is ready!"
}

# Generate development SSL certificates
generate_dev_certs() {
    log "INFO" "Generating development SSL certificates..."
    mkdir -p /app/certs
    openssl req -x509 -newkey rsa:4096 \
        -keyout /app/certs/dev-key.pem \
        -out /app/certs/dev-cert.pem \
        -days 365 \
        -nodes \
        -subj "/C=US/ST=Development/L=DevCity/O=DevOrg/OU=DevTeam/CN=localhost"
}

# Setup development environment
setup_dev_env() {
    log "INFO" "Setting up development environment..."
    
    # Install development dependencies
    pnpm install

    # Prepare husky git hooks
    pnpm prepare
}

# Main entrypoint logic
main() {
    log "INFO" "🚀 Starting Cove API AI Development Environment 🚀"

    # Check environment variables
    check_env_vars

    # Setup development environment
    setup_dev_env

    # Generate development certificates
    generate_dev_certs

    # Wait for dependent services
    wait_for_postgres
    wait_for_redis
    wait_for_chroma

    # Run database migrations
    run_migrations

    # Seed initial data
    seed_data

    # Start development server with hot reload and debugging
    log "INFO" "Starting development server with hot reload and debugging..."
    exec pnpm dev:debug
}

# Trap signals to ensure clean shutdown
trap 'log "WARN" "Received interrupt signal. Shutting down..."; exit 0' SIGINT SIGTERM

# Execute main function
main