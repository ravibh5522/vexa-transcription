# 🚨 COOLIFY BUILD CONTEXT FIX

## The Problem

Coolify is failing to build because it's NOT sending the complete repository to Docker during build. The error shows:

```
"/services/admin-api/requirements.txt": not found
```

This means Docker build can't see the `services/` directory.

## Why This Happens

Coolify uses BuildKit which has stricter build context rules. When Coolify clones your repo, it might not be including all files in the Docker build context.

## ✅ SOLUTION 1: Use Coolify's "Build Pack" Settings (RECOMMENDED)

In Coolify UI:

### Step 1: Disable Nixpacks
1. Go to your resource settings
2. Find "Build Pack" or "Builder" setting
3. **Select "Docker"** or **"Dockerfile"** (NOT Nixpacks)
4. Ensure it's set to use docker-compose.yml

### Step 2: Set Build Context
1. Look for "Docker Build Args" or "Build Context"
2. Set **Base Directory** to `.` (dot) or leave empty
3. Ensure **Dockerfile Path** is `docker-compose.yml`

### Step 3: Add Build Command Override
In Coolify, override the build command:

```bash
# Pre-build: Build bot image first
cd services/vexa-bot && docker build -t vexa-bot:dev -f core/Dockerfile core && cd ../..

# Main build
docker compose --profile cpu build
```

Or simpler:
```bash
make -f Makefile.coolify build-all
```

### Step 4: Set Start Command
```bash
docker compose --profile cpu up -d
```

---

## ✅ SOLUTION 2: Use Pre-built Images (EASIEST)

Instead of building in Coolify, build locally and push to a registry:

### On Your Local Machine:

```bash
cd /home/ravi/Desktop/vexa

# Build all images
docker compose --profile cpu build

# Tag for GitHub Container Registry
docker tag vexa_dev-api-gateway ghcr.io/ravibh5522/vexa-api-gateway:latest
docker tag vexa_dev-admin-api ghcr.io/ravibh5522/vexa-admin-api:latest
docker tag vexa_dev-bot-manager ghcr.io/ravibh5522/vexa-bot-manager:latest
docker tag vexa_dev-transcription-collector ghcr.io/ravibh5522/vexa-transcription-collector:latest
docker tag vexa_dev-whisperlive-cpu ghcr.io/ravibh5522/vexa-whisperlive-cpu:latest
docker tag vexa_dev-mcp ghcr.io/ravibh5522/vexa-mcp:latest
docker tag vexa-bot:dev ghcr.io/ravibh5522/vexa-bot:dev

# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u ravibh5522 --password-stdin

# Push images
docker push ghcr.io/ravibh5522/vexa-api-gateway:latest
docker push ghcr.io/ravibh5522/vexa-admin-api:latest
docker push ghcr.io/ravibh5522/vexa-bot-manager:latest
docker push ghcr.io/ravibh5522/vexa-transcription-collector:latest
docker push ghcr.io/ravibh5522/vexa-whisperlive-cpu:latest
docker push ghcr.io/ravibh5522/vexa-mcp:latest
docker push ghcr.io/ravibh5522/vexa-bot:dev
```

### Then in Coolify:

Use `docker-compose.coolify.yml` which pulls these pre-built images instead of building.

---

## ✅ SOLUTION 3: Manual Deployment on Coolify Server

SSH into your Coolify server and deploy manually:

```bash
# On Coolify server
cd /opt/deployments  # or wherever you want to deploy

# Clone repo
git clone https://github.com/ravibh5522/vexa-transcription.git vexa
cd vexa

# Copy .env file
cp env-example.cpu .env

# Edit .env with your settings
nano .env

# Build and start
make build-bot
docker compose --profile cpu build
docker compose --profile cpu up -d

# Run migrations
docker compose exec transcription-collector alembic stamp head
```

Then in Coolify, just manage it as a "Docker Standalone" resource pointing to this directory.

---

## ✅ SOLUTION 4: Fix Coolify's Git Clone Settings

The issue might be that Coolify isn't cloning the full repo. Check:

1. **In Coolify Git Settings:**
   - Ensure "Clone Depth" is not set (or set to 0 for full clone)
   - Check "Include all branches" if needed
   - Verify the repository URL is correct

2. **Check Coolify Logs:**
   - Look at the build logs
   - See if it shows "Cloning repository..."
   - Check if all files are listed

---

## Recommended Approach

**For quickest deployment RIGHT NOW:**

1. Use **Solution 2** (pre-built images) if you have GitHub Container Registry access
2. Or use **Solution 3** (manual deployment) for immediate results
3. Fix Coolify settings later for automated deployments

**For automated deployments:**
- Use **Solution 1** with proper Coolify configuration

---

## Files Added to Help

- `build-for-coolify.sh` - Simple build script
- `Makefile.coolify` - Makefile for Coolify
- `docker-compose.coolify.yml` - Alternative compose file using pre-built images

---

## Test Locally First

Before deploying to Coolify, test that the build works:

```bash
# Simulate Coolify's build process
cd /home/ravi/Desktop/vexa
rm -rf /tmp/vexa-test
git clone https://github.com/ravibh5522/vexa-transcription.git /tmp/vexa-test
cd /tmp/vexa-test
docker compose --profile cpu build
```

If this fails, Coolify will fail too. Fix any issues locally first.

---

## Next Steps

1. Choose one of the solutions above
2. If using pre-built images, push them to a registry first
3. Configure Coolify according to the chosen solution
4. Deploy!

The **fastest path** is Solution 3 (manual deployment) - you'll be running in minutes.
