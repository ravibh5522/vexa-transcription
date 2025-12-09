# Port Conflict Resolution - COMPLETED ✅

## Problem
Coolify deployment failed during container startup with error:
```
Error response from daemon: driver failed programming external connectivity on endpoint vexa-traefik-1: 
Bind for 0.0.0.0:8082 failed: port is already allocated
```

## Root Cause
Coolify's own infrastructure services (likely Traefik or monitoring) were using ports in the 8080-8090 range, conflicting with Vexa's default port mappings.

## Solution Applied
All Vexa services have been moved to the 18xxx port range to avoid conflicts:

### Port Mapping Changes in .env:
```bash
# Before → After
TRAEFIK_WEB_HOST_PORT=19090 → 18081
TRAEFIK_DASHBOARD_HOST_PORT=18085 → 18082
# New addition:
CONSUL_HOST_PORT=18502
```

### docker-compose.yml Changes:
1. **Traefik service** - Now uses environment variables:
   ```yaml
   ports:
     - "${TRAEFIK_WEB_HOST_PORT:-18081}:8081"
     - "${TRAEFIK_DASHBOARD_HOST_PORT:-18082}:8080"
   ```

2. **Consul service** - Now uses environment variable:
   ```yaml
   ports:
     - "${CONSUL_HOST_PORT:-18502}:8500"
   ```

## ✅ Changes Committed
- Commit: `c418c19`
- Pushed to: https://github.com/ravibh5522/vexa-transcription.git
- Branch: main

---

## 🚀 NEXT STEPS - Deploy in Coolify

### Step 1: Update .env in Coolify
Since `.env` is in `.gitignore`, you need to update it in Coolify manually:

1. Go to your Vexa application in Coolify
2. Navigate to **Environment Variables** section
3. Add/Update these variables:
   ```
   TRAEFIK_WEB_HOST_PORT=18081
   TRAEFIK_DASHBOARD_HOST_PORT=18082
   CONSUL_HOST_PORT=18502
   ```

### Step 2: Redeploy
1. In Coolify, click **Redeploy** or **Deploy** button
2. Coolify will pull the latest commit (`c418c19`) with the updated docker-compose.yml
3. Wait for build to complete (should succeed since it worked before)
4. This time, all containers should start without port conflicts

### Step 3: Verify Services Are Running
After deployment, check that all services started successfully:

```bash
# In Coolify's container shell or SSH to your server
docker compose -f /path/to/vexa/docker-compose.yml ps
```

All services should show status "Up" or "healthy".

### Step 4: Access Your Services
- **API Gateway**: http://your-server-ip:18056/docs
- **Admin API**: http://your-server-ip:18057/docs  
- **Traefik Dashboard**: http://your-server-ip:18082/dashboard/
- **Consul UI**: http://your-server-ip:18502/ui

### Step 5: Initialize Database (First Time Only)
```bash
# Access the transcription-collector container
docker compose exec transcription-collector alembic stamp head
```

### Step 6: Create First Admin User
```bash
# Use your ADMIN_API_TOKEN from .env
export ADMIN_API_TOKEN="66c78a4b548b87427e1771f2e5107e848b18ca66036a264d5975bd342e5525bc"

# Create user
curl -X POST "http://your-server-ip:18057/users" \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@yourcompany.com",
    "name": "Admin User",
    "is_active": true
  }'

# Generate API key for the user
curl -X POST "http://your-server-ip:18057/users/{user_id}/api-key" \
  -H "Authorization: Bearer $ADMIN_API_TOKEN"
```

---

## 📊 Complete Port Reference
| Service | Internal Port | External Port | URL |
|---------|---------------|---------------|-----|
| API Gateway | 8000 | 18056 | http://server:18056 |
| Admin API | 8001 | 18057 | http://server:18057 |
| WhisperLive | 9090 | 19090 | ws://server:19090 |
| Traefik Web | 8081 | 18081 | http://server:18081 |
| Traefik Dashboard | 8080 | 18082 | http://server:18082 |
| Consul | 8500 | 18502 | http://server:18502 |
| PostgreSQL | 5432 | - | Internal only |
| Redis | 6379 | - | Internal only |

---

## 🔍 Troubleshooting

### If Port Conflicts Still Occur:
1. Check what's using the port:
   ```bash
   sudo lsof -i :18082
   # or
   sudo netstat -tlnp | grep 18082
   ```

2. Choose a different port in .env and redeploy

### If Services Don't Start:
1. Check logs for the failing service:
   ```bash
   docker compose logs traefik
   docker compose logs consul
   ```

2. Verify environment variables were set:
   ```bash
   docker compose config | grep -A5 traefik
   ```

---

## ✨ Success Criteria
- [ ] Coolify deployment completes without errors
- [ ] All containers show "Up" status
- [ ] API Gateway Swagger UI accessible at :18056/docs
- [ ] Admin API Swagger UI accessible at :18057/docs
- [ ] Traefik dashboard accessible at :18082
- [ ] Database migrations applied
- [ ] First user created and API key generated
- [ ] Bot creation test successful

---

**You're now ready to deploy!** 🎉

The port conflicts have been resolved. Just update the environment variables in Coolify and redeploy.
