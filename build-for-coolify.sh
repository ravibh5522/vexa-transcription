#!/bin/bash
# Coolify Build Script
# This script helps Coolify build the images correctly

set -e

echo "======================================"
echo "Building Vexa Images for Coolify"
echo "======================================"

# Set build context to current directory
CONTEXT="."

# Build each service
echo "Building api-gateway..."
docker build -t vexa-api-gateway:latest -f services/api-gateway/Dockerfile ${CONTEXT}

echo "Building admin-api..."
docker build -t vexa-admin-api:latest -f services/admin-api/Dockerfile ${CONTEXT}

echo "Building bot-manager..."
docker build -t vexa-bot-manager:latest -f services/bot-manager/Dockerfile ${CONTEXT}

echo "Building transcription-collector..."
docker build -t vexa-transcription-collector:latest -f services/transcription-collector/Dockerfile ${CONTEXT}

echo "Building mcp..."
docker build -t vexa-mcp:latest -f services/mcp/Dockerfile ${CONTEXT}

echo "Building whisperlive-cpu..."
docker build -t vexa-whisperlive-cpu:latest -f services/WhisperLive/Dockerfile.cpu ${CONTEXT}

echo "Building vexa-bot..."
docker build -t vexa-bot:dev -f services/vexa-bot/core/Dockerfile services/vexa-bot/core

echo "======================================"
echo "✅ All images built successfully!"
echo "======================================"
