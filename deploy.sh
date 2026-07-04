#!/bin/bash
set -e

echo "📦 Installing dependencies..."
npm install

echo "🏗  Building for production..."
npm run build

echo "🔐 Logging in to Firebase (browser will open)..."
npx firebase-tools login

echo "🚀 Deploying Firestore rules + Hosting..."
npx firebase-tools deploy --only firestore:rules,hosting

echo ""
echo "✅ Done! Your app is live at:"
echo "   https://budgetbuddy-9d7da.web.app"
