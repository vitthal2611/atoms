#!/bin/bash
set -e

echo "📦 Installing app dependencies..."
npm install

echo "📦 Installing Cloud Functions dependencies..."
(cd functions && npm install)

echo "🏗  Building for production..."
npm run build

echo "🔐 Logging in to Firebase (browser will open)..."
npx firebase-tools login

echo "🚀 Deploying Firestore rules + Functions + Hosting..."
npx firebase-tools deploy --only firestore:rules,functions,hosting

echo ""
echo "✅ Done! Your app is live at:"
echo "   https://budgetbuddy-9d7da.web.app"
