# Achievement System Setup

The achievement system is not currently set up in your database. Follow these steps to enable it:

## Step 1: Apply the Migration

1. **Go to your Supabase Dashboard**
   - Visit [supabase.com](https://supabase.com)
   - Sign in to your account
   - Select your project

2. **Open the SQL Editor**
   - In the left sidebar, click on "SQL Editor"
   - Click "New Query"

3. **Run the Migration**
   - Copy the contents of `apply-achievement-migration.sql`
   - Paste it into the SQL Editor
   - Click "Run" to execute the migration

## Step 2: Verify the Setup

After running the migration, you should see:
- ✅ `achievements` table created with 15 sample achievements
- ✅ `player_achievements` table for tracking unlocked achievements
- ✅ `player_stats` table for tracking player statistics
- ✅ Database triggers that automatically check achievements when scores are submitted

## Step 3: Test the System

1. **Go to your app's Admin page** (`/admin`)
2. **Scroll down to "Achievement System Test"**
3. **Click "Refresh Test"** - you should now see:
   - Achievements Table: Count: 15
   - Player Achievements: Count: 0 (initially)
   - Player Stats: Count: 0 (initially)

4. **Test Achievement Trigger**:
   - Click "Test Achievement Trigger" to insert a test score
   - This should trigger the "First Steps" achievement

## What the Achievement System Includes

### Available Achievements:
- 🎯 **First Steps** - Submit your very first score!
- 👑 **Champion** - Achieve first place in any game!
- 🎯 **Score Hunter** - Score 10,000+ points in a single game
- 🎮 **Game Explorer** - Play 5 different games
- 💎 **High Roller** - Score 25,000+ points in any game
- 📈 **Regular Player** - Submit 10 scores
- And 9 more achievements!

### Features:
- ✅ **Automatic Detection** - Achievements unlock automatically when criteria are met
- ✅ **Visual Notifications** - Pop-up notifications when achievements are unlocked
- ✅ **Player Dashboard** - View all achievements at `/player?player=PLAYER_NAME`
- ✅ **Webhook Integration** - Achievement notifications sent to Teams/Discord/Slack
- ✅ **Progress Tracking** - Shows progress toward locked achievements

## Troubleshooting

If you encounter any issues:

1. **Check the SQL Editor for errors** - Make sure the migration ran successfully
2. **Verify tables exist** - Use the Achievement System Test in the Admin page
3. **Check browser console** - Look for any JavaScript errors
4. **Test with a real score** - Submit a score through the normal interface

## Next Steps

Once the achievement system is set up:
1. Players will automatically unlock achievements as they play
2. You can view achievements in the Player Dashboard
3. Achievement notifications will appear when unlocked
4. Webhook notifications will be sent to configured channels

The system is designed to work automatically - no additional configuration needed!
