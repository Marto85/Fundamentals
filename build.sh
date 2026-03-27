#!/usr/bin/env bash
set -e

echo "▶ Installing frontend dependencies..."
cd frontend
npm install
npx vite build
cd ..

echo "▶ Installing backend dependencies..."
pip install -r requirements.txt

echo "✅ Build complete"