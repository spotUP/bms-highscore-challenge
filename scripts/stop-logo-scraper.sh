#!/bin/bash

echo "🛑 Stopping logo scraper instances..."

if [ -f "scraper-pids.txt" ]; then
    PIDS=$(cat scraper-pids.txt)
    echo "Found PIDs: $PIDS"

    for PID in $PIDS; do
        if ps -p $PID > /dev/null; then
            echo "Stopping PID $PID..."
            kill $PID
        else
            echo "PID $PID already stopped"
        fi
    done

    # Wait a moment for graceful shutdown
    sleep 2

    # Force kill if still running
    for PID in $PIDS; do
        if ps -p $PID > /dev/null; then
            echo "Force killing PID $PID..."
            kill -9 $PID
        fi
    done

    rm scraper-pids.txt
    echo "✅ All instances stopped"
else
    echo "❌ No PID file found. Stopping all tsx processes related to logo scraper..."
    pkill -f "multi-instance-logo-scraper"
    echo "✅ Stopped all logo scraper processes"
fi

echo ""
echo "📊 Final progress saved in scraper-progress.json"
echo "📁 Instance logs available in scraper-*.log files"