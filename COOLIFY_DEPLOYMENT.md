# Vexa Deployment Guide for Coolify

This guide provides step-by-step instructions for deploying Vexa on Coolify, a self-hosted PaaS platform.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Architecture Overview](#architecture-overview)
- [Pre-Deployment Preparation](#pre-deployment-preparation)
- [Coolify Deployment Options](#coolify-deployment-options)
- [Post-Deployment Configuration](#post-deployment-configuration)
- [Testing Your Deployment](#testing-your-deployment)
- [Troubleshooting](#troubleshooting)
- [Scaling and Production Tips](#scaling-and-production-tips)

---

## Prerequisites

### System Requirements

**For CPU Mode (Development/Testing):**
- 4 CPU cores minimum
- 8GB RAM minimum
- 20GB storage
- Docker Engine 20.10+
- Docker Compose v2

**For GPU Mode (Production):**
- 6 CPU cores minimum
- 64GB RAM
- NVIDIA GPU with 16GB VRAM (e.g., A16, A40, A100)
- 50GB storage
- NVIDIA drivers installed
- NVIDIA Container Toolkit configured

### Coolify Requirements
- Coolify v4+ installed and running
- Access to Coolify dashboard
- SSH access to the server (for troubleshooting)

---

## Architecture Overview

Vexa consists of **9 microservices** and **3 infrastructure services**:

### Core Services:
1. **api-gateway** (Port 18056) - Main API endpoint
2. **admin-api** (Port 18057) - Admin operations
3. **bot-manager** (Port 8080, internal) - Orchestrates bot containers
4. **transcription-collector** (Port 18123) - Manages transcripts
5. **whisperlive-cpu/gpu** (Port 9090-9091) - Speech-to-text engine
6. **vexa-bot** (Dynamic containers) - Meeting bots
7. **mcp** (Port 18888) - Model Context Protocol service
8. **traefik** (Ports 8081, 8082) - Load balancer
9. **consul** (Port 8502) - Service discovery

### Infrastructure:
- **PostgreSQL** (Port 15438) - Database
- **Redis** (Port 6379) - Cache & streaming

### Network Architecture:
```
Client → API Gateway (18056) → Bot Manager → Vexa Bot Containers
                              ↓
                    Transcription Collector → WhisperLive → Traefik
                              ↓
                         PostgreSQL
                              ↓
                            Redis
```

---

## Pre-Deployment Preparation

### Step 1: Clone and Prepare Repository

```bash
# Clone the repository
git clone https://github.com/Vexa-ai/vexa.git
cd vexa

# Initialize submodules (REQUIRED - contains vexa-bot and WhisperLive)
git submodule update --init --recursive

# Verify submodules are loaded
ls services/vexa-bot/core/
ls services/WhisperLive/
```

### Step 2: Configure Environment

**For CPU Mode:**
```bash
cp env-example.cpu .env
```

**For GPU Mode:**
```bash
cp env-example.gpu .env
```

**Edit .env file:**
```bash
nano .env
```

**CRITICAL: Update these values:**
```env
# Change this to a secure random token!
ADMIN_API_TOKEN=YOUR_SECURE_TOKEN_HERE  # Generate with: openssl rand -hex 32

# Whisper Configuration
WHISPER_MODEL_SIZE=tiny  # CPU: tiny, GPU: medium or large
DEVICE_TYPE=cpu  # or cuda for GPU

# Exposed Ports (adjust if needed)
API_GATEWAY_HOST_PORT=18056
ADMIN_API_HOST_PORT=18057
POSTGRES_HOST_PORT=15438

# Your domain (for production)
BASE_URL="https://api.yourdomain.com"
WS_URL="wss://api.yourdomain.com/ws"
```

**Generate Secure Token:**
```bash
openssl rand -hex 32
```

### Step 3: Build Bot Image (CRITICAL!)

The bot image **must be built before** deploying services:

```bash
cd services/vexa-bot
docker build -t vexa-bot:dev -f core/Dockerfile core
cd ../..

# Verify image was created
docker images | grep vexa-bot
```

---

## Coolify Deployment Options

### Option 1: Docker Compose (Recommended)

This is the easiest method for deploying the entire stack.

#### 1.1. Upload Project to Coolify

1. Go to Coolify Dashboard
2. Click **"New Resource"** → **"Docker Compose"**
3. Choose deployment method:
   - **Git Repository**: Connect your Vexa repository
   - **Manual Upload**: Upload the project directory

#### 1.2. Configure Docker Compose

1. **Compose File**: Use `docker-compose.yml` from the repository
2. **Environment Variables**: Import from `.env` file
3. **Docker Compose Profile**:
   - For CPU: Add `--profile cpu` to compose command
   - For GPU: Add `--profile gpu` to compose command

#### 1.3. Special Coolify Configuration

**Volume Mounts (Required):**
```yaml
volumes:
  # Persistent data
  - postgres-data:/var/lib/postgresql/data
  - redis-data:/data
  
  # Model cache
  - ./hub:/root/.cache/huggingface/hub
  - ./services/WhisperLive/models:/app/models
  
  # CRITICAL: Docker socket for bot-manager
  - /var/run/docker.sock:/var/run/docker.sock
```

**Network Configuration:**
- Ensure all services use the same Docker network
- Network name: `vexa_default` (or as defined in compose file)

**Health Checks:**
Enable health checks for:
- PostgreSQL (built-in)
- WhisperLive (custom healthcheck.sh)

#### 1.4. GPU Configuration (if applicable)

Add to docker-compose.yml under `whisperlive` service:

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          device_ids: ["0"]  # Adjust GPU ID
          capabilities: [gpu]
```

Ensure Coolify server has:
```bash
# NVIDIA drivers
nvidia-smi  # Should show GPU info

# NVIDIA Container Toolkit
docker run --rm --gpus all nvidia/cuda:12.3.2-base nvidia-smi
```

#### 1.5. Deploy in Coolify

1. Click **"Deploy"**
2. Monitor deployment logs
3. Wait for all services to be healthy (~2-5 minutes)

---

### Option 2: Individual Services (Advanced)

Deploy each service separately for more granular control.

#### 2.1. PostgreSQL Setup

1. Create **PostgreSQL** service in Coolify
2. Configure:
   - Image: `postgres:15-alpine`
   - Port: `15438:5432`
   - Environment:
     ```
     POSTGRES_DB=vexa
     POSTGRES_USER=postgres
     POSTGRES_PASSWORD=postgres
     ```
   - Volume: `postgres-data:/var/lib/postgresql/data`
   - Health check: `pg_isready -U postgres`

#### 2.2. Redis Setup

1. Create **Redis** service
2. Configure:
   - Image: `redis:7.0-alpine`
   - Port: `6379` (internal only)
   - Command: `redis-server --appendonly yes`
   - Volume: `redis-data:/data`

#### 2.3. Core Services

Deploy in this order:

1. **Consul**
   - Image: `hashicorp/consul:1.16`
   - Port: `8502:8500`
   - Command: `agent -dev -client=0.0.0.0`

2. **Traefik**
   - Image: `traefik:v3.1`
   - Ports: `8081:8081`, `8082:8080`
   - Configuration via command args (see docker-compose.yml)

3. **Admin API**
   - Build from: `services/admin-api/Dockerfile`
   - Port: `18057:8001`
   - Environment: Link to PostgreSQL

4. **Transcription Collector**
   - Build from: `services/transcription-collector/Dockerfile`
   - Port: `18123:8000`
   - Environment: Link to PostgreSQL + Redis

5. **Bot Manager**
   - Build from: `services/bot-manager/Dockerfile`
   - Port: `8080` (internal)
   - **CRITICAL**: Mount `/var/run/docker.sock:/var/run/docker.sock`
   - Environment: Docker socket access required

6. **WhisperLive**
   - Build from: `services/WhisperLive/Dockerfile.cpu` or `Dockerfile.project`
   - Ports: `9090`, `9091`
   - Environment: Link to Redis

7. **API Gateway**
   - Build from: `services/api-gateway/Dockerfile`
   - Port: `18056:8000`
   - Environment: Link to all backend services

8. **MCP** (Optional)
   - Build from: `services/mcp/Dockerfile`
   - Port: `18888:18888`

---

## Post-Deployment Configuration

### Step 1: Run Database Migrations

```bash
# Via Coolify terminal or SSH
docker compose exec transcription-collector alembic upgrade head

# Or stamp if database already exists
docker compose exec transcription-collector alembic stamp head
```

### Step 2: Verify Services

```bash
# Check all services are running
docker compose --profile cpu ps

# Check logs
docker compose logs -f api-gateway
docker compose logs -f bot-manager
docker compose logs -f whisperlive-cpu
```

### Step 3: Test API Connectivity

```bash
# Test API Gateway
curl http://localhost:18056/docs

# Test Admin API
curl http://localhost:18057/docs
```

**Expected Response:** HTML page with Swagger UI documentation

### Step 4: Create Initial User

**Save your ADMIN_API_TOKEN from .env first!**

```bash
# Create user via Admin API
curl -X POST http://localhost:18057/users \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: YOUR_ADMIN_API_TOKEN" \
  -d '{
    "email": "admin@example.com",
    "name": "Admin User",
    "bot_limit": 10
  }'

# Response will include user_id
# Save the user_id from response, then generate API token:

curl -X POST http://localhost:18057/users/{user_id}/tokens \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: YOUR_ADMIN_API_TOKEN" \
  -d '{
    "token_name": "production_key"
  }'
```

**Save the API token** - this is what users use to access the API.

---

## Testing Your Deployment

### Test 1: API Health Check

```bash
curl http://localhost:18056/docs
# Should return Swagger UI HTML
```

### Test 2: Request Bot for Meeting

**Google Meet Example:**
```bash
curl -X POST http://localhost:18056/bots \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_USER_API_KEY" \
  -d '{
    "platform": "google_meet",
    "native_meeting_id": "abc-defg-hij",
    "language": "en",
    "bot_name": "Vexa Bot"
  }'
```

**Microsoft Teams Example:**
```bash
curl -X POST http://localhost:18056/bots \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_USER_API_KEY" \
  -d '{
    "platform": "teams",
    "native_meeting_id": "9387167464734",
    "passcode": "qxJanYOcdjN4d6UlGa",
    "language": "en",
    "bot_name": "Vexa Bot"
  }'
```

### Test 3: Check Bot Status

```bash
# List all bots
curl -H "X-API-Key: YOUR_USER_API_KEY" \
  http://localhost:18056/bots

# Check if bot containers are created
docker ps | grep vexa-bot
```

### Test 4: Get Transcripts

```bash
curl -H "X-API-Key: YOUR_USER_API_KEY" \
  "http://localhost:18056/transcripts/google_meet/abc-defg-hij"
```

### Test 5: WebSocket Connection

```bash
# Install websocat for testing
# brew install websocat  # macOS
# apt install websocat   # Linux

websocat -H="X-API-Key: YOUR_USER_API_KEY" \
  ws://localhost:18056/ws
```

Send subscription message:
```json
{
  "action": "subscribe",
  "meetings": [
    {
      "platform": "google_meet",
      "native_id": "abc-defg-hij"
    }
  ]
}
```

---

## Troubleshooting

### Issue 1: Bot Containers Not Starting

**Symptom:** Bot creation succeeds but bot doesn't appear in meeting

**Solution:**
```bash
# Check bot-manager logs
docker compose logs -f bot-manager

# Verify Docker socket access
docker compose exec bot-manager docker ps
# Should show containers (not "permission denied")

# Check bot image exists
docker images | grep vexa-bot

# Rebuild bot image if missing
cd services/vexa-bot
docker build -t vexa-bot:dev -f core/Dockerfile core
```

**Coolify-specific:**
- Ensure bot-manager has Docker socket mounted
- Check container permissions: add to `docker` group

### Issue 2: Database Connection Errors

**Symptom:** Services fail with "database connection failed"

**Solution:**
```bash
# Check PostgreSQL is healthy
docker compose ps postgres

# Test connection
docker compose exec postgres psql -U postgres -d vexa -c "SELECT 1;"

# Check connection string in services
docker compose exec api-gateway env | grep DB_
```

### Issue 3: WhisperLive Not Registering in Consul

**Symptom:** Bots join but no transcription happens

**Solution:**
```bash
# Check Consul UI
open http://localhost:8502

# Check WhisperLive logs
docker compose logs -f whisperlive-cpu

# Verify environment
docker compose exec whisperlive-cpu env | grep CONSUL

# Restart WhisperLive
docker compose restart whisperlive-cpu
```

### Issue 4: GPU Not Detected

**Symptom:** GPU services fail to start or use CPU

**Solution:**
```bash
# Verify NVIDIA drivers
nvidia-smi

# Test Docker GPU access
docker run --rm --gpus all nvidia/cuda:12.3.2-base nvidia-smi

# Configure NVIDIA Container Toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker

# Check docker-compose.yml device_ids
# Ensure GPU ID matches your system
```

### Issue 5: Port Conflicts

**Symptom:** Service fails to start with "address already in use"

**Solution:**
```bash
# Find what's using the port
sudo lsof -i :18056

# Change port in .env
nano .env
# Update: API_GATEWAY_HOST_PORT=18056 to different port

# Restart services
docker compose down
docker compose --profile cpu up -d
```

### Issue 6: Out of Disk Space

**Symptom:** Services fail with "no space left on device"

**Solution:**
```bash
# Clean up Docker
docker system prune -a --volumes

# Check disk usage
df -h
docker system df

# Remove old images
docker image prune -a

# Clean unused volumes
docker volume prune
```

---

## Scaling and Production Tips

### 1. Reverse Proxy & SSL

Use Coolify's built-in proxy or configure external reverse proxy:

**Nginx Example:**
```nginx
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:18056;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /ws {
        proxy_pass http://localhost:18056/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 2. Scale WhisperLive Instances

Edit docker-compose.yml:
```yaml
whisperlive-cpu:
  deploy:
    replicas: 3  # Scale to 3 instances
```

Traefik will automatically load balance.

### 3. External Database

For production, use managed PostgreSQL:

```bash
# Update .env
DB_HOST=your-postgres.aws.com
DB_PORT=5432
DB_NAME=vexa_prod
DB_USER=vexauser
DB_PASSWORD=secure_password

# Remove postgres service from docker-compose.yml
```

### 4. Redis Cluster

For high availability:
```bash
# Use Redis Sentinel or Cluster
REDIS_URL=redis://redis-sentinel:26379/0
```

### 5. Monitoring

Add monitoring stack:
- **Prometheus**: Metrics collection
- **Grafana**: Dashboards
- **Loki**: Log aggregation

### 6. Resource Limits

Add to docker-compose.yml:
```yaml
services:
  api-gateway:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### 7. Backup Strategy

**Database Backups:**
```bash
# Automated backup script
docker compose exec postgres pg_dump -U postgres vexa > backup_$(date +%Y%m%d).sql

# Restore
docker compose exec -T postgres psql -U postgres vexa < backup.sql
```

**Volume Backups:**
```bash
docker run --rm -v vexa_postgres-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup.tar.gz /data
```

### 8. Update Strategy

```bash
# Backup first
docker compose exec postgres pg_dump -U postgres vexa > backup.sql

# Pull latest changes
git pull origin main
git submodule update --recursive

# Rebuild
docker compose --profile cpu build

# Run migrations
docker compose exec transcription-collector alembic upgrade head

# Restart services
docker compose --profile cpu up -d
```

---

## Environment Variables Reference

### Required
```env
ADMIN_API_TOKEN=                    # Admin authentication token
WHISPER_MODEL_SIZE=tiny             # tiny, base, small, medium, large
DEVICE_TYPE=cpu                     # cpu or cuda
BOT_IMAGE_NAME=vexa-bot:dev         # Bot Docker image name
```

### Optional
```env
LANGUAGE_DETECTION_SEGMENTS=10      # Segments for language detection
VAD_FILTER_THRESHOLD=0.2           # Voice activity detection threshold
WL_MAX_CLIENTS=10                  # Max WhisperLive clients
API_GATEWAY_HOST_PORT=18056        # External API port
ADMIN_API_HOST_PORT=18057          # External admin port
POSTGRES_HOST_PORT=15438           # External database port
```

### Database
```env
DB_HOST=postgres
DB_PORT=5432
DB_NAME=vexa
DB_USER=postgres
DB_PASSWORD=postgres
```

### Redis
```env
REDIS_URL=redis://redis:6379/0
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_STREAM_NAME=transcription_segments
```

---

## Support & Resources

- **Documentation**: [docs/README.md](docs/README.md)
- **API Guide**: [docs/user_api_guide.md](docs/user_api_guide.md)
- **WebSocket Guide**: [docs/websocket.md](docs/websocket.md)
- **GitHub Issues**: https://github.com/Vexa-ai/vexa/issues
- **Discord**: https://discord.gg/Ga9duGkVz9

---

## Quick Reference Commands

```bash
# Start services
docker compose --profile cpu up -d

# Stop services
docker compose down

# View logs
docker compose logs -f [service-name]

# Restart service
docker compose restart [service-name]

# Rebuild service
docker compose build [service-name]
docker compose up -d [service-name]

# Run migrations
docker compose exec transcription-collector alembic upgrade head

# Access database
docker compose exec postgres psql -U postgres vexa

# Check service health
docker compose ps
docker compose exec bot-manager docker ps
```

---

## Deployment Checklist

- [ ] Clone repository
- [ ] Initialize submodules
- [ ] Copy and edit .env file
- [ ] Generate secure ADMIN_API_TOKEN
- [ ] Build vexa-bot image
- [ ] Configure Coolify resource
- [ ] Upload docker-compose.yml
- [ ] Set environment variables
- [ ] Configure volume mounts
- [ ] Mount Docker socket for bot-manager
- [ ] Deploy services
- [ ] Run database migrations
- [ ] Test API connectivity
- [ ] Create initial user
- [ ] Generate user API token
- [ ] Test bot creation
- [ ] Test transcription
- [ ] Configure domain/SSL (production)
- [ ] Set up monitoring (production)
- [ ] Configure backups (production)

---

**Congratulations!** Your Vexa instance is now deployed on Coolify. 🎉

For production deployments, remember to:
1. Use strong passwords and tokens
2. Enable SSL/TLS
3. Set up regular backups
4. Configure monitoring
5. Review security settings
