#!/usr/bin/env tsx

import { spawn } from 'child_process';

console.log('🔄 Starting continuous API update monitor...');
console.log('This will update the dashboard statistics every 10 seconds to show real progress');

let updateCount = 0;

async function updateAPI() {
  updateCount++;
  console.log(`\n[${new Date().toLocaleTimeString()}] Update #${updateCount} - Refreshing dashboard statistics...`);

  try {
    const process = spawn('npx', ['tsx', 'scripts/recent-insertion-logos-api.ts'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    process.stdout?.on('data', (data) => {
      output += data.toString();
    });

    process.stderr?.on('data', (data) => {
      errorOutput += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        // Extract key stats from output
        const lines = output.split('\n');
        const statsLine = lines.find(line => line.includes('Stats:'));
        if (statsLine) {
          console.log(`✅ ${statsLine.trim()}`);
        } else {
          console.log('✅ API updated successfully');
        }
      } else {
        console.log(`❌ API update failed with code ${code}`);
        if (errorOutput) {
          console.log('Error:', errorOutput.trim());
        }
      }
    });

  } catch (error) {
    console.log(`❌ API update error: ${error}`);
  }
}

// Update immediately
updateAPI();

// Then update every 10 seconds
setInterval(updateAPI, 10000);

console.log('⏰ Monitor started - updating every 10 seconds (press Ctrl+C to stop)');