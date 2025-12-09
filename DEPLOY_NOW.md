# ✅ READY FOR COOLIFY - Final Deployment Steps

## Changes Made (December 9, 2025)

### Fixed Dockerfile Paths
All Dockerfiles have been updated to work with Coolify's build context:
- Removed leading `./` from all COPY commands
- Changed `COPY ./libs/` to `COPY libs/`
- Changed `COPY ./services/` to `COPY services/`

This ensures Docker can find files when Coolify builds from Git.

### Committed to Git
- Repository: `https://github.com/ravibh5522/vexa-transcription.git`
- Branch: `main`
- Latest commit includes all Dockerfile fixes

---

## Deploy in Coolify NOW ✅

### 1. Create Resource in Coolify

**Type:** Docker Compose

**Git Settings:**
- Repository URL: `https://github.com/ravibh5522/vexa-transcription.git`
- Branch: `main`
- Compose File: `docker-compose.yml`

### 2. Environment Variables

Add these in Coolify environment settings:

```env
ADMIN_API_TOKEN=66c78a4b548b87427e1771f2e5107e848b18ca66036a264d5975bd342e5525bc
LANGUAGE_DETECTION_SEGMENTS=10
VAD_FILTER_THRESHOLD=0.2
WHISPER_MODEL_SIZE=tiny
DEVICE_TYPE=cpu
BOT_IMAGE_NAME=vexa-bot:dev
WL_MAX_CLIENTS=10
API_GATEWAY_HOST_PORT=18056
ADMIN_API_HOST_PORT=18057
TRAEFIK_WEB_HOST_PORT=19090
TRAEFIK_DASHBOARD_HOST_PORT=18085
TRANSCRIPTION_COLLECTOR_HOST_PORT=18123
POSTGRES_HOST_PORT=15438
```

**Update these for your domain:**
```env
BASE_URL=https://your-domain.com:18056
WS_URL=wss://your-domain.com:18056/ws
```

### 3. Docker Compose Settings

**Build Command:** (Leave default or set to)
```bash
docker compose --profile cpu build
```

**Start Command:**
```bash
docker compose --profile cpu up -d
```

### 4. Volume Mounts (CRITICAL!)

Add these volume mounts in Coolify UI:

#### Mount 1: Docker Socket (MOST IMPORTANT!)
```
Name: docker-socket
Source Path: /var/run/docker.sock
Destination Path: /var/run/docker.sock
```

#### Mount 2: PostgreSQL Data
```
Name: postgres-data
Source Path: postgres-data
Destination Path: /var/lib/postgresql/data
```

#### Mount 3: Redis Data
```
Name: redis-data
Source Path: redis-data
Destination Path: /data
```

#### Mount 4: Hugging Face Cache (Optional but recommended)
```
Name: huggingface-hub
Source Path: hub
Destination Path: /root/.cache/huggingface/hub
```

### 5. Deploy!

Click "Deploy" in Coolify and wait for build to complete.

---

## After Deployment

### 1. Check Service Status

In Coolify terminal or SSH to server:
```bash
docker compose --profile cpu ps
```

All services should be running.

### 2. Run Database Migrations

```bash
docker compose exec transcription-collector alembic stamp head
```

### 3. Create First User

```bash
curl -X POST http://localhost:18057/users \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: 66c78a4b548b87427e1771f2e5107e848b18ca66036a264d5975bd342e5525bc" \
  -d '{
    "email": "admin@example.com",
    "name": "Admin User",
    "bot_limit": 10
  }'
```

Save the `user_id` from response.

### 4. Generate API Token

```bash
curl -X POST http://localhost:18057/users/{user_id}/tokens \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: 66c78a4b548b87427e1771f2e5107e848b18ca66036a264d5975bd342e5525bc" \
  -d '{"token_name": "production_key"}'
```

**Save this token** - it's used for all API requests.

### 5. Test API

```bash
# Check API is responding
curl http://your-domain:18056/docs

# Should return Swagger UI HTML
```

### 6. Test Bot Creation

```bash
curl -X POST http://your-domain:18056/bots \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_USER_TOKEN" \
  -d '{
    "platform": "google_meet",
    "native_meeting_id": "abc-defg-hij",
    "language": "en"
  }'
```

---

## Exposed Ports

Make sure these ports are accessible:

- **18056** - API Gateway (public)
- **18057** - Admin API (internal only)

All other services are internal.

---

## Troubleshooting

### If Build Still Fails in Coolify

1. **Check Build Logs** - Look for file not found errors
2. **Verify Git Clone** - Ensure all files are in the repository
3. **Check Build Context** - Should be set to `.` (root)

### If Services Don't Start

```bash
# Check logs
docker compose logs -f api-gateway
docker compose logs -f bot-manager

# Check if PostgreSQL is healthy
docker compose ps postgres
```

### If Bots Don't Create

```bash
# Verify Docker socket is mounted
docker compose exec bot-manager docker ps

# Should show container list, not permission denied
```

---

## Security Notes

1. ✅ ADMIN_API_TOKEN is already set to a secure random value
2. ⚠️  Keep Admin API (18057) internal - don't expose publicly
3. ⚠️  Use HTTPS/WSS in production (add reverse proxy)
4. ✅ User API tokens are hashed in database

---

## What's Included

- ✅ All microservices ready
- ✅ PostgreSQL database
- ✅ Redis cache
- ✅ Traefik load balancer
- ✅ Consul service discovery
- ✅ WhisperLive (CPU mode)
- ✅ Bot manager (ready to spawn bots)
- ✅ Documentation (see COOLIFY_DEPLOYMENT.md)

---

## Success Indicators

After deployment, you should see:

```
✅ api-gateway: Up
✅ admin-api: Up
✅ bot-manager: Up
✅ transcription-collector: Up
✅ whisperlive-cpu: Up (healthy)
✅ postgres: Up (healthy)
✅ redis: Up
✅ traefik: Up
✅ consul: Up
```

**Access Points:**
- API Docs: http://your-domain:18056/docs
- Admin Docs: http://your-domain:18057/docs
- Traefik Dashboard: http://your-domain:18085

---

## Support

- Full Guide: `COOLIFY_DEPLOYMENT.md`
- Quick Reference: `COOLIFY_QUICK_REFERENCE.md`
- Troubleshooting: `COOLIFY_TROUBLESHOOTING.md`
- GitHub: https://github.com/ravibh5522/vexa-transcription
- Original Repo: https://github.com/Vexa-ai/vexa

---

**Last Updated:** December 9, 2025
**Status:** ✅ Ready for Production Deployment
**Build Tested:** ✅ All services build successfully locally
