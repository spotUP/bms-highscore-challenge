#!/bin/bash

echo "🚀 Starting 4-instance clear logo scraper..."
echo "Each instance will process different games to maximize efficiency"
echo ""

# Clean up any existing progress file
if [ -f "scraper-progress.json" ]; then
    echo "📋 Found existing progress file, continuing from where we left off..."
else
    echo "📋 Starting fresh scraper run..."
fi

# Start 4 instances in the background
echo "🏃 Starting instance 0..."
npx tsx scripts/multi-instance-logo-scraper.ts 0 4 > scraper-0.log 2>&1 &
PID0=$!

echo "🏃 Starting instance 1..."
npx tsx scripts/multi-instance-logo-scraper.ts 1 4 > scraper-1.log 2>&1 &
PID1=$!

echo "🏃 Starting instance 2..."
npx tsx scripts/multi-instance-logo-scraper.ts 2 4 > scraper-2.log 2>&1 &
PID2=$!

echo "🏃 Starting instance 3..."
npx tsx scripts/multi-instance-logo-scraper.ts 3 4 > scraper-3.log 2>&1 &
PID3=$!

echo ""
echo "✅ All instances started!"
echo "   Instance 0: PID $PID0 (log: scraper-0.log)"
echo "   Instance 1: PID $PID1 (log: scraper-1.log)"
echo "   Instance 2: PID $PID2 (log: scraper-2.log)"
echo "   Instance 3: PID $PID3 (log: scraper-3.log)"
echo ""
echo "📊 Monitor progress at: http://localhost:8080/logo-scraper"
echo "📁 Progress data: scraper-progress.json"
echo ""
echo "🛑 To stop all instances:"
echo "   kill $PID0 $PID1 $PID2 $PID3"
echo ""

# Save PIDs to file for easy cleanup
echo "$PID0 $PID1 $PID2 $PID3" > scraper-pids.txt

echo "💡 Scraper instances are running in the background."
echo "   Use 'tail -f scraper-*.log' to watch individual logs"
echo "   Use 'cat scraper-progress.json' to check progress"
echo "   Visit /logo-scraper in the web app for live monitoring"