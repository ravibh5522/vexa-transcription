# Vexa Coolify Quick Reference

## Pre-Deployment Checklist

```bash
# 1. Clone and prepare
git clone https://github.com/Vexa-ai/vexa.git
cd vexa
git submodule update --init --recursive

# 2. Run setup script (automated)
./coolify-setup.sh

# OR Manual setup:
cp env-example.cpu .env  # or env-example.gpu
nano .env  # Update ADMIN_API_TOKEN

# 3. Build bot image (CRITICAL!)
cd services/vexa-bot
docker build -t vexa-bot:dev -f core/Dockerfile core
cd ../..
```

## Coolify Configuration

### Docker Compose Settings

**Resource Type:** Docker Compose  
**Compose File:** `docker-compose.yml`  
**Profile:** `--profile cpu` (or `--profile gpu`)

### Required Environment Variables

Import from `.env` or set manually:

```env
ADMIN_API_TOKEN=<secure-random-token>
WHISPER_MODEL_SIZE=tiny  # or medium for GPU
DEVICE_TYPE=cpu  # or cuda
BOT_IMAGE_NAME=vexa-bot:dev
API_GATEWAY_HOST_PORT=18056
ADMIN_API_HOST_PORT=18057
POSTGRES_HOST_PORT=15438
```

### Critical Volume Mounts

```yaml
volumes:
  # Persistent data (REQUIRED)
  - postgres-data:/var/lib/postgresql/data
  - redis-data:/data
  
  # Docker socket (CRITICAL for bot-manager)
  - /var/run/docker.sock:/var/run/docker.sock
  
  # Model cache (optional but recommended)
  - ./hub:/root/.cache/huggingface/hub
  - ./services/WhisperLive/models:/app/models
```

### Network Configuration

**Network Name:** `vexa_default` (auto-created)  
**Network Driver:** bridge  
**All services must use the same network**

## Post-Deployment Steps

### 1. Run Database Migrations

```bash
docker compose exec transcription-collector alembic upgrade head

# If database already exists:
docker compose exec transcription-collector alembic stamp head
```

### 2. Verify Services

```bash
# Check all services
docker compose --profile cpu ps

# Should see:
# - postgres (healthy)
# - redis (running)
# - api-gateway (running)
# - admin-api (running)
# - bot-manager (running)
# - transcription-collector (running)
# - whisperlive-cpu (running, healthy)
# - traefik (running)
# - consul (running)
# - mcp (running)
```

### 3. Test API

```bash
# API Gateway
curl http://localhost:18056/docs

# Admin API
curl http://localhost:18057/docs

# Expected: HTML page with Swagger UI
```

### 4. Create First User

```bash
# Replace YOUR_ADMIN_API_TOKEN with value from .env

curl -X POST http://localhost:18057/users \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: YOUR_ADMIN_API_TOKEN" \
  -d '{
    "email": "admin@example.com",
    "name": "Admin User",
    "bot_limit": 10
  }'

# Save the user_id from response
# Then generate API token:

curl -X POST http://localhost:18057/users/{user_id}/tokens \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: YOUR_ADMIN_API_TOKEN" \
  -d '{"token_name": "production_key"}'

# Save the token - this is for API access
```

## Port Reference

| Service | Internal | External | Public? |
|---------|----------|----------|---------|
| API Gateway | 8000 | 18056 | ✅ Yes |
| Admin API | 8001 | 18057 | ⚠️ Internal only |
| Bot Manager | 8080 | - | ❌ No |
| Transcription Collector | 8000 | 18123 | ⚠️ Debug only |
| WhisperLive | 9090-9091 | - | ❌ No (behind Traefik) |
| Traefik Web | 8081 | 19090 | ⚠️ Internal |
| Traefik Dashboard | 8080 | 18085 | ⚠️ Internal |
| PostgreSQL | 5432 | 15438 | ⚠️ Internal |
| Redis | 6379 | - | ❌ No |
| Consul | 8500 | 8502 | ⚠️ Internal |
| MCP | 18888 | 18888 | ⚠️ Optional |

**For production:** Only expose 18056 (API Gateway) publicly

## Common Issues & Quick Fixes

### Bot containers not starting

```bash
# Check bot-manager logs
docker compose logs bot-manager

# Verify Docker socket access
docker compose exec bot-manager docker ps

# Rebuild bot image if missing
cd services/vexa-bot && docker build -t vexa-bot:dev -f core/Dockerfile core
```

### Database connection errors

```bash
# Check postgres health
docker compose ps postgres

# Test connection
docker compose exec postgres psql -U postgres -d vexa -c "SELECT 1;"
```

### WhisperLive not working

```bash
# Check Consul
open http://localhost:8502

# Restart WhisperLive
docker compose restart whisperlive-cpu

# Check logs
docker compose logs -f whisperlive-cpu
```

### Port conflicts

```bash
# Find what's using the port
sudo lsof -i :18056

# Change in .env and restart
nano .env  # Update port
docker compose down
docker compose --profile cpu up -d
```

## Management Commands

```bash
# Start services
docker compose --profile cpu up -d

# Stop services
docker compose down

# View logs (all services)
docker compose logs -f

# View logs (specific service)
docker compose logs -f api-gateway

# Restart service
docker compose restart api-gateway

# Rebuild and restart
docker compose build api-gateway
docker compose up -d api-gateway

# Check service status
docker compose ps

# Check bot containers
docker ps | grep vexa-bot
```

## Testing Commands

```bash
# Request bot for Google Meet
curl -X POST http://localhost:18056/bots \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_USER_API_KEY" \
  -d '{
    "platform": "google_meet",
    "native_meeting_id": "abc-defg-hij",
    "language": "en"
  }'

# Request bot for Microsoft Teams
curl -X POST http://localhost:18056/bots \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_USER_API_KEY" \
  -d '{
    "platform": "teams",
    "native_meeting_id": "9387167464734",
    "passcode": "qxJanYOcdjN4d6UlGa",
    "language": "en"
  }'

# Get transcripts
curl -H "X-API-Key: YOUR_USER_API_KEY" \
  "http://localhost:18056/transcripts/google_meet/abc-defg-hij"

# List all bots
curl -H "X-API-Key: YOUR_USER_API_KEY" \
  "http://localhost:18056/bots"
```

## Backup Commands

```bash
# Backup database
docker compose exec postgres pg_dump -U postgres vexa > backup_$(date +%Y%m%d).sql

# Restore database
docker compose exec -T postgres psql -U postgres vexa < backup.sql

# Backup volumes
docker run --rm -v vexa_postgres-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup.tar.gz /data
```

## Update Procedure

```bash
# 1. Backup first
docker compose exec postgres pg_dump -U postgres vexa > backup.sql

# 2. Pull updates
git pull origin main
git submodule update --recursive

# 3. Rebuild
docker compose --profile cpu build

# 4. Run migrations
docker compose exec transcription-collector alembic upgrade head

# 5. Restart
docker compose --profile cpu up -d
```

## Production Checklist

- [ ] Change ADMIN_API_TOKEN to secure value
- [ ] Configure domain and SSL/TLS
- [ ] Restrict Admin API access (firewall/internal only)
- [ ] Set up monitoring (Prometheus + Grafana)
- [ ] Configure automated backups
- [ ] Set up log aggregation
- [ ] Review resource limits
- [ ] Test disaster recovery
- [ ] Document runbook
- [ ] Set up alerts

## Resources

- **Full Guide:** [COOLIFY_DEPLOYMENT.md](COOLIFY_DEPLOYMENT.md)
- **API Docs:** [docs/user_api_guide.md](docs/user_api_guide.md)
- **WebSocket:** [docs/websocket.md](docs/websocket.md)
- **GitHub:** https://github.com/Vexa-ai/vexa
- **Discord:** https://discord.gg/Ga9duGkVz9

## Quick Links

- API Gateway Docs: http://localhost:18056/docs
- Admin API Docs: http://localhost:18057/docs
- Traefik Dashboard: http://localhost:18085
- Consul UI: http://localhost:8502

---

**Need Help?** Check logs first: `docker compose logs -f`
