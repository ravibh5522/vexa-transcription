#!/bin/bash
# Vexa Coolify Quick Setup Script
# This script prepares Vexa for deployment on Coolify

set -e

echo "======================================"
echo "Vexa Coolify Setup Script"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Check if running in project directory
if [ ! -f "docker-compose.yml" ]; then
    print_error "docker-compose.yml not found. Please run this script from the vexa directory."
    exit 1
fi

print_status "Running from vexa directory"

# Step 1: Initialize submodules
echo ""
echo "Step 1: Initializing Git submodules..."
if git submodule update --init --recursive; then
    print_status "Submodules initialized"
else
    print_error "Failed to initialize submodules"
    exit 1
fi

# Step 2: Check if .env exists
echo ""
echo "Step 2: Configuring environment..."
if [ -f ".env" ]; then
    print_warning ".env file already exists. Keeping existing file."
    read -p "Do you want to regenerate .env? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        REGEN_ENV=true
    else
        REGEN_ENV=false
    fi
else
    REGEN_ENV=true
fi

if [ "$REGEN_ENV" = true ]; then
    # Ask for CPU or GPU
    echo ""
    echo "Select deployment mode:"
    echo "1) CPU (Development - Whisper tiny model)"
    echo "2) GPU (Production - Whisper medium model)"
    read -p "Enter choice [1-2]: " -n 1 -r
    echo
    
    if [[ $REPLY == "2" ]]; then
        if [ -f "env-example.gpu" ]; then
            cp env-example.gpu .env
            print_status "Created .env from env-example.gpu"
        else
            print_error "env-example.gpu not found"
            exit 1
        fi
    else
        if [ -f "env-example.cpu" ]; then
            cp env-example.cpu .env
            print_status "Created .env from env-example.cpu"
        else
            print_error "env-example.cpu not found"
            exit 1
        fi
    fi
    
    # Generate secure token
    if command -v openssl &> /dev/null; then
        SECURE_TOKEN=$(openssl rand -hex 32)
        sed -i.bak "s/^ADMIN_API_TOKEN=.*/ADMIN_API_TOKEN=${SECURE_TOKEN}/" .env
        rm -f .env.bak
        print_status "Generated secure ADMIN_API_TOKEN"
        echo ""
        print_warning "IMPORTANT: Save this token!"
        echo "ADMIN_API_TOKEN=${SECURE_TOKEN}"
        echo ""
    else
        print_warning "openssl not found. Please manually update ADMIN_API_TOKEN in .env"
    fi
else
    print_status "Using existing .env file"
fi

# Step 3: Check Docker
echo ""
echo "Step 3: Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi
print_status "Docker is running"

# Step 4: Build bot image
echo ""
echo "Step 4: Building vexa-bot image..."
if docker images | grep -q "vexa-bot.*dev"; then
    print_warning "vexa-bot:dev image already exists"
    read -p "Do you want to rebuild it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        BUILD_BOT=true
    else
        BUILD_BOT=false
    fi
else
    BUILD_BOT=true
fi

if [ "$BUILD_BOT" = true ]; then
    if [ -d "services/vexa-bot/core" ]; then
        cd services/vexa-bot
        if docker build -t vexa-bot:dev -f core/Dockerfile core; then
            cd ../..
            print_status "Built vexa-bot:dev image"
        else
            cd ../..
            print_error "Failed to build vexa-bot image"
            exit 1
        fi
    else
        print_error "services/vexa-bot/core not found. Did submodules initialize correctly?"
        exit 1
    fi
else
    print_status "Using existing vexa-bot:dev image"
fi

# Step 5: Summary and next steps
echo ""
echo "======================================"
echo "Setup Complete!"
echo "======================================"
echo ""
echo "Next steps for Coolify deployment:"
echo ""
echo "1. Upload this directory to your Coolify server"
echo "2. In Coolify, create a new 'Docker Compose' resource"
echo "3. Point it to docker-compose.yml"
echo "4. Set compose profile:"
echo "   - CPU: --profile cpu"
echo "   - GPU: --profile gpu"
echo ""
echo "5. Configure these critical settings:"
echo "   - Mount volume: /var/run/docker.sock:/var/run/docker.sock (for bot-manager)"
echo "   - Import environment variables from .env"
echo "   - Set up persistent volumes for postgres-data and redis-data"
echo ""
echo "6. After deployment, run migrations:"
echo "   docker compose exec transcription-collector alembic upgrade head"
echo ""
echo "7. Create your first user via Admin API:"
echo "   curl -X POST http://localhost:18057/users \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -H 'X-Admin-API-Key: YOUR_ADMIN_API_TOKEN' \\"
echo "     -d '{\"email\": \"admin@example.com\", \"name\": \"Admin\", \"bot_limit\": 10}'"
echo ""
echo "For detailed instructions, see: COOLIFY_DEPLOYMENT.md"
echo ""

# Check if we should start services locally
read -p "Do you want to start services locally now for testing? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Starting services..."
    
    # Determine profile from .env
    if grep -q "DEVICE_TYPE=cuda" .env; then
        PROFILE="gpu"
    else
        PROFILE="cpu"
    fi
    
    # Build all services
    echo "Building Docker images..."
    if docker compose --profile "$PROFILE" build; then
        print_status "All images built successfully"
    else
        print_error "Failed to build images"
        exit 1
    fi
    
    # Start services
    echo "Starting services..."
    if docker compose --profile "$PROFILE" up -d; then
        print_status "Services started"
        
        # Wait for postgres
        echo "Waiting for PostgreSQL to be ready..."
        sleep 10
        
        # Run migrations
        echo "Running database migrations..."
        if docker compose exec transcription-collector alembic stamp head; then
            print_status "Database migrations complete"
        else
            print_warning "Migration failed - database may already be migrated"
        fi
        
        # Show status
        echo ""
        echo "Service Status:"
        docker compose --profile "$PROFILE" ps
        
        echo ""
        print_status "Deployment complete!"
        echo ""
        echo "API Gateway: http://localhost:18056/docs"
        echo "Admin API: http://localhost:18057/docs"
        echo ""
        echo "Your ADMIN_API_TOKEN from .env:"
        grep "^ADMIN_API_TOKEN=" .env
        echo ""
    else
        print_error "Failed to start services"
        exit 1
    fi
else
    print_status "Skipping local deployment"
    echo ""
    echo "You can manually deploy later with:"
    echo "  docker compose --profile cpu build    # Build images"
    echo "  docker compose --profile cpu up -d    # Start services"
    echo ""
fi

echo "======================================"
echo "Setup script complete!"
echo "======================================"
