# Achievement System Setup Instructions

## ✅ Current Status
- ✅ Achievement webhook code is working
- ✅ Score webhooks are working successfully 
- ⚠️ Database tables and functions need to be created

## 🔧 Setup Steps

### Step 1: Run the SQL Script

1. **Open your Supabase Dashboard**
   - Go to [app.supabase.com](https://app.supabase.com)
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Run the Setup Script**
   - Copy the entire contents of `simple-achievement-setup.sql`
   - Paste it into the SQL Editor
   - Click "Run" to execute

### Step 2: Verify Setup

After running the script, you should see:
```
Achievement system setup complete!
total_achievements: 5
```

### Step 3: Test the System

1. **Submit a test score** in your app
2. **Check the browser console** - you should see:
   ```
   🎯 Achievement system called for: [player_name]
   🏆 Found 1 new achievements for [player_name]
   🚀 Sending achievement webhook: ...
   ✅ Achievement webhook sent successfully: ...
   ```

3. **Check Microsoft Teams** - you should receive an achievement notification

## 🎖️ Available Achievements

Once set up, these achievements will be automatically awarded:

- 🎯 **First Score** (10 points) - Submit your very first score
- 💯 **Century Club** (25 points) - Score 100+ points
- 🚀 **High Scorer** (50 points) - Score 1,000+ points  
- 👑 **Champion** (100 points) - Achieve first place
- 🎖️ **Score Hunter** (200 points) - Score 10,000+ points

## 🔍 Troubleshooting

### If you get errors:
1. **"Function not found"** → Run the SQL script
2. **"Table does not exist"** → Run the SQL script
3. **"Permission denied"** → Make sure you're logged in as project owner

### Check if setup worked:
```sql
-- Run this query in SQL Editor to verify
SELECT COUNT(*) FROM achievements;
SELECT COUNT(*) FROM player_achievements;
```

## 🎯 What Happens Next

Once the SQL script is run:
1. ✅ Achievement tables will be created
2. ✅ Triggers will be set up to auto-award achievements
3. ✅ RPC function will be available for the webhook system
4. ✅ Achievement notifications will work in Teams
5. ✅ Player dashboard will show achievements

The achievement system will then work automatically for all future score submissions!
