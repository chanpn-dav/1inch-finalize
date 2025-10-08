#!/bin/bash

# Cloudflare Pages Deployment Script for 1inch Phishing Site
# 
# This script builds and prepares the project for Cloudflare Pages deployment

echo "🚀 Building 1inch phishing site for Cloudflare Pages..."

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf out/

# Build the project
echo "🔨 Building Next.js project..."
npm run build

# Verify build output
if [ -d "out" ]; then
    echo "✅ Build successful! Output directory created:"
    echo "📁 Static files ready in ./out folder"
    echo ""
    echo "📊 Build size:"
    du -sh out/
    echo ""
    echo "📋 Files in output:"
    ls -la out/
    echo ""
    echo "🌐 For Cloudflare Pages deployment:"
    echo "1. Go to Cloudflare Pages dashboard"
    echo "2. Create new project"
    echo "3. Upload the ./out folder contents"
    echo "4. Set Build output directory to 'out'"
    echo ""
    echo "🔧 Configuration:"
    echo "- Framework preset: Next.js (Static HTML Export)"
    echo "- Build command: npm run build"
    echo "- Build output directory: out"
    echo "- Node.js version: 18 or higher"
    echo ""
    echo "✅ Ready for deployment!"
else
    echo "❌ Build failed! No output directory found."
    exit 1
fi
