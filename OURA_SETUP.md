# Oura Ring Integration Setup Guide

This guide will help you set up Oura Ring integration for your Dicey Movements app.

## Prerequisites

1. An Oura Ring account
2. Access to the Oura Developer Portal
3. Your Supabase project credentials

## Step 1: Oura Developer Portal Setup

1. Go to [Oura Developer Portal](https://cloud.ouraring.com/personal-access-tokens)
2. Create a new application
3. Configure the following settings:
   - **Application Name**: Dicey Movements
   - **Redirect URI**: `http://localhost:3000/oura/callback` (for development)
   - **Scopes**: Select `daily` and `heartrate` scopes
4. Note down your **Client ID** and **Client Secret**

## Step 2: Backend Environment Variables

Create a `.env` file in the `backend` directory with the following variables:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Oura API Configuration
OURA_CLIENT_ID=your_oura_client_id_here
OURA_CLIENT_SECRET=your_oura_client_secret_here
OURA_REDIRECT_URI=http://localhost:3000/oura/callback

# Server Configuration
PORT=3001
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Step 3: Database Setup

Run the following SQL commands in your Supabase SQL editor:

```sql
-- Run the contents of create_oura_integration.sql
-- This will create the necessary tables and policies
```

## Step 4: Frontend Environment Variables

Create a `.env` file in the root directory with:

```env
VITE_API_BASE_URL=http://localhost:3001
```

## Step 5: Install Dependencies

```bash
# Backend dependencies
cd backend
npm install

# Frontend dependencies (if not already installed)
cd ..
npm install
```

## Step 6: Start the Application

1. Start the backend server:

```bash
cd backend
npm run dev
```

2. Start the frontend:

```bash
npm run dev
```

## Step 7: Test the Integration

1. Open your app and sign in
2. Go to Settings
3. Click "Connect Oura Ring"
4. Complete the OAuth flow
5. Check the leaderboard for the new "Total Steps" option

## Production Deployment

For production deployment, update the redirect URI in your Oura app settings to:

```
https://yourdomain.com/oura/callback
```

And update the environment variables accordingly.

## Features

- **OAuth Integration**: Secure authentication with Oura API
- **Automatic Token Refresh**: Handles token expiration automatically
- **Data Synchronization**: Syncs daily activity data from Oura
- **Leaderboard Integration**: New "Total Steps" leaderboard option
- **Settings Management**: Connect/disconnect Oura integration in settings

## API Endpoints

- `GET /api/oura/auth-url` - Get OAuth authorization URL
- `GET /api/oura/callback` - Handle OAuth callback
- `GET /api/oura/status/:userId` - Check connection status
- `POST /api/oura/sync/:userId` - Sync activity data
- `DELETE /api/oura/disconnect/:userId` - Disconnect integration

## Troubleshooting

1. **OAuth Error**: Check that your redirect URI matches exactly
2. **Database Errors**: Ensure the SQL schema has been applied
3. **API Errors**: Verify your Oura API credentials
4. **CORS Issues**: Check that your frontend URL is allowed in the backend CORS settings

## Security Notes

- Never commit your `.env` files to version control
- Use environment variables for all sensitive data
- The service role key should only be used on the backend
- Implement proper rate limiting for production use
