# Dicey Movements

A fitness app that combines dice rolling with workout timers to create engaging exercise sessions.

## Features

- **Dice-based Workouts**: Roll dice to determine exercises and rep counts
- **Timer System**: Customizable workout timers with pause/resume functionality
- **Progress Tracking**: Track your daily progress and exercise multipliers
- **Social Features**: Connect with friends and see their activity
- **Achievements**: Unlock achievements as you progress
- **Oura Integration**: Sync with Oura ring for sleep and activity data
- **State Persistence**: Timer and dice roll state persists across app restarts and phone locks

## State Persistence

The app now includes robust state persistence to prevent losing your progress when:

- Your phone locks and unlocks
- You switch between apps
- The browser app is closed and reopened
- The page is refreshed

### What Gets Persisted

1. **Timer State**:

   - Active/paused status
   - Remaining time
   - Start time (for calculating elapsed time when app restarts)

2. **Dice Roll State**:
   - Current workout session
   - Timer completion status
   - Workout completion status
   - Roll & Start mode status

### How It Works

- State is automatically saved to localStorage whenever it changes
- When the app restarts, it calculates elapsed time and restores the appropriate state
- State is cleared when:
  - A workout is completed
  - The day resets
  - The user signs out
  - The state is from a previous day

### Technical Details

- Uses the Page Visibility API to detect when the app becomes hidden/visible
- Automatically adjusts timer state based on elapsed time when app restarts
- Preserves state only within the same day to prevent confusion
- Includes detailed logging for debugging persistence issues

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up your environment variables
4. Start the development server: `npm run dev`

## Environment Variables

Create a `.env` file with the following variables:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.
