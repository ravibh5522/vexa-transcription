# Coolify Deployment Configuration

## Important Settings for Coolify

When deploying from Git in Coolify, use these settings:

### 1. Resource Type
- **Type:** Docker Compose

### 2. Repository Settings
- **Repository:** Your Git URL
- **Branch:** main
- **Compose File Path:** `docker-compose.yml`

### 3. Build Settings
**CRITICAL:** Set these in Coolify:

```bash
# Base Directory (leave empty or set to .)
Base Directory: .

# Docker Compose Command
docker compose --profile cpu build

# Then start with:
docker compose --profile cpu up -d
```

### 4. Build Pack / Nixpacks
**DISABLE** Nixpacks! Use raw Docker Compose only.

### 5. Submodules
**ENABLE** "Clone Submodules" in Git settings, because this project uses submodules for:
- `services/vexa-bot`
- `services/WhisperLive`

## If Still Failing

The error suggests Coolify can't find files during build. This happens when:

1. **Submodules not cloned** - Make sure "Clone Submodules" is enabled in Coolify
2. **Wrong build context** - Coolify might be building from wrong directory

### Alternative: Use Pre-built Images

Instead of building in Coolify, build locally and push to registry:

```bash
# On your local machine
cd /home/ravi/Desktop/vexa

# Build and tag images
docker compose --profile cpu build

# Tag for registry (replace with your registry)
docker tag vexa_dev-api-gateway your-registry/vexa-api-gateway:latest
docker tag vexa_dev-admin-api your-registry/vexa-admin-api:latest
docker tag vexa_dev-bot-manager your-registry/vexa-bot-manager:latest
docker tag vexa_dev-transcription-collector your-registry/vexa-transcription-collector:latest
docker tag vexa_dev-whisperlive-cpu your-registry/vexa-whisperlive-cpu:latest
docker tag vexa_dev-mcp your-registry/vexa-mcp:latest
docker tag vexa-bot:dev your-registry/vexa-bot:dev

# Push to registry
docker push your-registry/vexa-api-gateway:latest
docker push your-registry/vexa-admin-api:latest
docker push your-registry/vexa-bot-manager:latest
docker push your-registry/vexa-transcription-collector:latest
docker push your-registry/vexa-whisperlive-cpu:latest
docker push your-registry/vexa-mcp:latest
docker push your-registry/vexa-bot:dev

# Then modify docker-compose.yml to use these images instead of building
```

## Recommended Approach for Coolify

**Option 1: Use Docker Hub or GitHub Container Registry**

1. Build images locally
2. Push to registry
3. Update docker-compose.yml to pull images
4. Deploy in Coolify (no build needed)

**Option 2: Use Coolify's Docker Image resource**

Instead of Docker Compose, deploy each service as individual "Docker Image" resources in Coolify, using pre-built images.

**Option 3: Fix Build Context**

Check in Coolify UI:
- Settings → Build
- Look for "Docker Build Context" or "Working Directory"
- Ensure it's set to root (`.` or `/`)

## Current Error Analysis

The error `/services/bot-manager/requirements.txt: not found` means:

The Dockerfile is looking for `./services/bot-manager/requirements.txt` from the build context root, but Coolify's build context doesn't include it.

**This suggests Coolify is NOT cloning the full repo or NOT setting the build context correctly.**

## Checklist for Coolify

- [ ] "Clone Submodules" enabled in Git settings
- [ ] Submodules actually cloned (check Coolify logs)
- [ ] Build context set to `.` (root)
- [ ] Using Docker Compose, not Nixpacks
- [ ] All files committed and pushed to Git
- [ ] `.gitignore` not excluding required files

## Test Locally First

Before deploying to Coolify, test locally:

```bash
# Clone fresh (simulating Coolify)
cd /tmp
git clone YOUR_REPO_URL vexa-test
cd vexa-test
git submodule update --init --recursive

# Try building
docker compose --profile cpu build

# If this fails, Coolify will fail too
```
