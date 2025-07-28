# Push Notifications Setup Guide

This guide will help you set up push notifications for both desktop browsers and Safari on iOS.

## Overview

The push notification system includes:

- **Desktop Push Notifications**: Works in Chrome, Firefox, Edge, and other modern browsers
- **Safari Push Notifications**: Works on iOS Safari and macOS Safari
- **Service Worker**: Handles background notifications and offline functionality
- **Backend API**: Manages subscriptions and sends notifications

## Setup Steps

### 1. Generate VAPID Keys

First, generate the VAPID keys needed for push notifications:

```bash
cd backend
node generate-vapid-keys.js
```

This will output your public and private keys. Save these securely.

### 2. Configure Environment Variables

1. **Generate VAPID keys:**

   ```bash
   cd backend
   node generate-vapid-keys.js
   ```

2. **Add the generated keys to your existing `.env` file:**
   ```bash
   # Add these to your existing .env file
   VAPID_PUBLIC_KEY=your_public_key_here
   VAPID_PRIVATE_KEY=your_private_key_here
   VAPID_EMAIL=mailto:your-actual-email@example.com
   ```

**Note**: The email address should be a valid email that you control, as it's used for VAPID authentication.

**Alternative**: Use the automated setup script:

```bash
cd backend
./setup-push-notifications.sh
```

### 3. Run Database Migration

Execute the push subscriptions table migration:

```sql
-- Run this in your Supabase SQL editor
-- Or use the migration file: backend/supabase/create_push_subscriptions_table.sql
```

### 4. Build and Deploy

Build the backend and deploy:

```bash
cd backend
npm run build
npm start
```

## Features

### Desktop Push Notifications

- ✅ Works in Chrome, Firefox, Edge, Safari
- ✅ Background notifications when app is closed
- ✅ Rich notifications with actions
- ✅ Automatic subscription management

### Safari Push Notifications (iOS/macOS)

- ✅ iOS Safari support
- ✅ macOS Safari support
- ✅ Automatic permission requests
- ✅ Background notifications

### Enhanced Timer Notifications

- ✅ Multiple notification methods
- ✅ Sound alerts
- ✅ Visual flashing effects
- ✅ Title bar flashing
- ✅ Window focus attempts

## User Experience

### Permission Request Flow

1. **Automatic Detection**: The app detects if push notifications are supported
2. **Permission Request**: Users see a friendly prompt to enable notifications
3. **Settings Integration**: Notification status is shown in the settings panel
4. **Fallback Handling**: Graceful degradation if notifications are blocked

### Timer Expired Notifications

When a timer expires, users receive:

1. **Sound Alert**: Audio notification plays
2. **Push Notification**: System notification appears
3. **Visual Effects**: Page flashes and title bar changes
4. **Action Buttons**: "Start Workout" and "Dismiss" options

## Technical Implementation

### Service Worker (`public/sw.js`)

- Handles push events
- Manages notification display
- Provides offline functionality
- Handles notification clicks

### Notification Service (`src/utils/notificationService.ts`)

- Manages permission requests
- Handles subscription lifecycle
- Provides Safari-specific support
- Integrates with backend API

### Backend API (`backend/src/pushNotificationService.ts`)

- Manages user subscriptions
- Sends push notifications
- Handles subscription cleanup
- Provides VAPID key management

## Browser Support

| Browser | Desktop | Mobile | Push API | Safari API |
| ------- | ------- | ------ | -------- | ---------- |
| Chrome  | ✅      | ✅     | ✅       | ❌         |
| Firefox | ✅      | ✅     | ✅       | ❌         |
| Safari  | ✅      | ✅     | ✅       | ✅         |
| Edge    | ✅      | ✅     | ✅       | ❌         |

## Testing

### Local Development

1. Start the backend server
2. Open the app in a supported browser
3. Check the browser console for service worker registration
4. Test permission requests
5. Test timer notifications

### Production Deployment

1. Ensure HTTPS is enabled (required for push notifications)
2. Update VAPID keys in production environment
3. Test on multiple browsers and devices
4. Monitor notification delivery rates

## Troubleshooting

### Common Issues

1. **Notifications not showing**: Check browser permissions
2. **Service worker not registering**: Ensure HTTPS in production
3. **VAPID key errors**: Verify keys are correctly set
4. **Safari issues**: Check Apple Push Notification Service setup

### Debug Steps

1. Check browser console for errors
2. Verify service worker registration
3. Test permission status
4. Check network requests to backend
5. Verify database subscriptions

## Security Considerations

- VAPID keys should be kept secure
- User consent is required for notifications
- Subscriptions are tied to user accounts
- Invalid subscriptions are automatically cleaned up

## Performance

- Notifications are sent asynchronously
- Failed subscriptions are automatically removed
- Service worker caches essential resources
- Background sync handles offline scenarios
