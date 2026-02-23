# Shadow Slave Quiz App - Setup Guide

## Overview

This is a multiplayer quiz application themed around the **Shadow Slave** web novel, featuring:
- **The Nightmare Gate** (Discord Login with server verification)
- **The Soul Sea** (Lobby for players)
- **The Trial** (Real-time quiz gameplay)
- **Weaver's Loom** (Admin dashboard)
- **Ascension** (Leaderboard)

## Discord OAuth Setup

To enable Discord authentication, you need to configure a Discord application:

### 1. Create a Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Name it (e.g., "Shadow Slave Quiz")
4. Click "Create"

### 2. Configure OAuth2

1. In your application, go to **OAuth2** → **General**
2. Copy your **Client ID**
3. Copy your **Client Secret** (click "Reset Secret" if needed)
4. Under **Redirects**, add your application URL:
   - For local development: `http://localhost:YOUR_PORT`
   - For production: Your deployed Figma Make URL

### 3. Set Environment Variables

You should have already been prompted to add these three environment variables:

- **DISCORD_CLIENT_ID**: Your Discord application's Client ID
- **DISCORD_CLIENT_SECRET**: Your Discord application's Client Secret  
- **DISCORD_REDIRECT_URI**: The redirect URI (same as what you added in Discord OAuth settings)

### 4. Verify Server Access

The app is configured to only allow members of Discord Server ID: **982182985862377522**

If you want to change this to your own Discord server:
1. Get your Discord server ID (right-click server icon → Copy Server ID with Developer Mode enabled)
2. Update the `REQUIRED_SERVER_ID` constant in `/supabase/functions/server/index.tsx`

## How It Works

### Authentication Flow

1. User clicks "Connect Soul (Discord Login)"
2. Redirected to Discord OAuth authorization
3. User authorizes the app
4. Discord redirects back with an authorization code
5. Backend exchanges code for access token
6. Backend fetches user info and guild memberships
7. Verifies user is in the required Discord server
8. Creates session and returns user data

### Game Flow

1. **Lobby Phase**: First user becomes the "Weaver" (host), others join as "Sleepers"
2. **Admin Setup**: Weaver can add/edit questions in Weaver's Loom
3. **Trial Begins**: Weaver starts the game, questions appear for all players
4. **Real-time Answers**: Players submit answers, scored based on correctness and speed
5. **Ascension**: Final leaderboard shows rankings with Shadow Slave themed titles

### Admin Mode

The host can toggle between:
- **Sovereign Mode** (Admin view): Manage questions, control game flow, view live stats
- **Sleeper Mode** (Player view): Participate in the quiz like other players

## Customization

### Questions

Default questions are about Shadow Slave lore. To customize:
1. Log in as the host/Weaver
2. Open Weaver's Loom (admin panel)
3. Add your own questions with 4 answers each
4. Mark the correct answer with the checkmark icon

### Styling

The app uses the Shadow Slave aesthetic:
- **Primary Color** (#00C2FF): The Spell's electric blue
- **Secondary Color** (#FFD700): Weaver's golden threads
- **Background** (#050505): Void black
- **Danger** (#880015): Blood red

All colors are defined in `/styles/globals.css` as CSS custom properties.

### Required Server ID

Change the Discord server requirement by updating `REQUIRED_SERVER_ID` in the backend.

## Features

- **Real-time multiplayer**: All players see questions simultaneously
- **Discord OAuth**: Secure authentication with server verification
- **Admin dashboard**: Live stats, question management, game controls
- **Scoring system**: Points based on correctness and reaction speed
- **Responsive design**: Works on desktop and mobile
- **Dark gothic theme**: Faithful to Shadow Slave's aesthetic

## Technical Stack

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Deno + Hono (Supabase Edge Functions)
- **Database**: Supabase KV Store
- **Authentication**: Discord OAuth 2.0
- **Real-time Updates**: Polling (2-second intervals)

## Troubleshooting

### "Discord authentication not configured" error
- Make sure all three Discord environment variables are set
- Verify the Client ID and Secret are correct
- Check that the Redirect URI matches exactly

### "Access Denied: You are not a member of the required Citadel"
- Ensure you're a member of Discord server 982182985862377522
- Or change the `REQUIRED_SERVER_ID` to your server's ID

### Questions not appearing
- Make sure you've added questions in Weaver's Loom before starting
- Check that you clicked "Manifest Next Question" to begin the trial

### Players not seeing updates
- The app polls every 2 seconds for updates
- Check browser console for any network errors
- Ensure all players are in the same game session

## Support

For issues or questions about Shadow Slave lore, join the Discord server!
