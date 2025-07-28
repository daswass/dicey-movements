#!/bin/bash

echo "🚀 Setting up Push Notifications for Dicey Movements"
echo "=================================================="

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please create a .env file with your existing configuration first."
    exit 1
else
    echo "✅ Using existing .env file"
fi

# Generate VAPID keys
echo "🔑 Generating VAPID keys..."
node generate-vapid-keys.js

echo ""
echo "📋 Next steps:"
echo "1. Add the generated VAPID keys above to your existing .env file"
echo "2. Update VAPID_EMAIL with your real email address"
echo "3. Run the database migration: backend/supabase/add_notification_settings.sql"
echo "4. Start the backend server: npm run dev"
echo ""
echo "🎉 Push notification setup complete!" 