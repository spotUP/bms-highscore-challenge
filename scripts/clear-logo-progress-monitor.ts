#!/usr/bin/env tsx

// Progress monitor for the Clear Logo importer
// Uses the same beautiful UI from the improved scraper

import Database from 'better-sqlite3';
import { existsSync, statSync } from 'fs';
import chalk from 'chalk';
import path from 'path';

// ANSI escape codes for terminal control
const ANSI = {
  SAVE_CURSOR: '\u001b[s',
  RESTORE_CURSOR: '\u001b[u',
  CLEAR_LINE: '\u001b[2K',
  MOVE_TO_TOP: '\u001b[1;1H',
  MOVE_TO_LINE_3: '\u001b[3;1H',
  HIDE_CURSOR: '\u001b[?25l',
  SHOW_CURSOR: '\u001b[?25h',
  CLEAR_SCREEN: '\u001b[2J'
};

let logLineCount = 0;
let startTime = Date.now();

interface ClearLogoStats {
  totalLogos: number;
  processed: number;
  successfulLogos: number;
  failedLogos: number;
  currentGame: string;
  currentPlatform: string;
  logosPerSecond: number;
  startTime: number;
  dbSizeMB: number;
}

function initializeSplitScreen() {
  // Clear screen and hide cursor
  process.stdout.write(ANSI.CLEAR_SCREEN + ANSI.HIDE_CURSOR);
  // Reserve top 2 lines for progress bar
  process.stdout.write(ANSI.MOVE_TO_LINE_3);
  logLineCount = 3;
}

function updateStickyProgressBar(progressText: string) {
  // Save current cursor position
  process.stdout.write(ANSI.SAVE_CURSOR);

  // Move to top line and clear it
  process.stdout.write(ANSI.MOVE_TO_TOP + ANSI.CLEAR_LINE);

  // Write progress bar
  process.stdout.write(progressText);

  // Restore cursor to log area
  process.stdout.write(ANSI.RESTORE_CURSOR);
}

function logMessage(message: string) {
  // Write to current log position
  process.stdout.write(message + '\n');
  logLineCount++;

  // If we've filled too many lines, scroll
  if (logLineCount > 50) {
    process.stdout.write('\n'.repeat(5));
    logLineCount = 8;
  }
}

function getClearLogoStats(): ClearLogoStats | null {
  const dbPath = path.join(process.cwd(), 'public', 'clear-logos.db');

  if (!existsSync(dbPath)) {
    return null;
  }

  try {
    const db = new Database(dbPath);

    // Get total count
    const totalResult = db.prepare('SELECT COUNT(*) as count FROM clear_logos').get() as { count: number };

    // Get recent entries to show current progress
    const recentResult = db.prepare(`
      SELECT game_name, platform_name, created_at
      FROM clear_logos
      ORDER BY id DESC
      LIMIT 1
    `).get() as { game_name: string; platform_name: string; created_at: string } | undefined;

    // Get database file size
    const stats = statSync(dbPath);
    const dbSizeMB = stats.size / 1024 / 1024;

    db.close();

    // Try to read total from checkpoint file (more accurate)
    let totalTarget = 31202; // Default fallback
    const checkpointPath = path.join(process.cwd(), 'clear-logo-checkpoint.json');
    if (existsSync(checkpointPath)) {
      try {
        const checkpointData = JSON.parse(require('fs').readFileSync(checkpointPath, 'utf-8'));
        if (checkpointData.totalLogos) {
          totalTarget = checkpointData.totalLogos;
        }
      } catch (error) {
        // Fallback to default if checkpoint can't be read
      }
    }

    return {
      totalLogos: totalTarget,
      processed: totalResult.count,
      successfulLogos: totalResult.count,
      failedLogos: 0, // SQLite only stores successful ones
      currentGame: recentResult?.game_name || 'Unknown',
      currentPlatform: recentResult?.platform_name || 'Unknown',
      logosPerSecond: 0, // Will be calculated
      startTime: startTime,
      dbSizeMB: dbSizeMB
    };
  } catch (error) {
    console.error('Error reading database:', error);
    return null;
  }
}

function updateProgressBar(stats: ClearLogoStats) {
  // Truncate long game names for display
  const displayName = stats.currentGame && stats.currentGame.length > 30
    ? stats.currentGame.substring(0, 27) + '...'
    : stats.currentGame || 'Unknown';

  const displayPlatform = stats.currentPlatform && stats.currentPlatform.length > 20
    ? stats.currentPlatform.substring(0, 17) + '...'
    : stats.currentPlatform || 'Unknown';

  // Calculate progress
  const percentage = (stats.processed / stats.totalLogos) * 100;
  const barLength = 40;
  const filledLength = Math.round((percentage / 100) * barLength);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

  // Calculate ETA
  const rate = stats.logosPerSecond || 0;
  const remaining = stats.totalLogos - stats.processed;
  const etaSeconds = rate > 0 ? remaining / rate : 0;
  const etaHours = Math.floor(etaSeconds / 3600);
  const etaMinutes = Math.floor((etaSeconds % 3600) / 60);
  const etaDisplay = etaHours > 0 ? `${etaHours}h${etaMinutes}m` : `${etaMinutes}m`;

  // Build the sticky progress bar text
  const progressText = chalk.cyan('🖼️ ') +
    chalk.cyan(`[${bar}]`) +
    ` ${percentage.toFixed(1)}% | ${stats.processed.toLocaleString()}/${stats.totalLogos.toLocaleString()} | ` +
    chalk.green(`✅ ${stats.successfulLogos}`) + ` ` +
    chalk.red(`❌ ${stats.failedLogos}`) + ` | ` +
    chalk.yellow(`🎯 ${displayPlatform}`) + ` | ` +
    chalk.magenta(`🎲 ${displayName}`) + ` | ` +
    chalk.blue(`⚡ ${rate.toFixed(1)}/s`) + ` | ` +
    chalk.white(`💾 ${stats.dbSizeMB.toFixed(1)}MB`) + ` | ` +
    chalk.white(`⏱️ ETA: ${etaDisplay}`);

  // Update the sticky progress bar at the top
  updateStickyProgressBar(progressText);
}

function formatUptime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function showStats(stats: ClearLogoStats) {
  const uptime = Date.now() - startTime;

  // Clear the log area before showing new stats
  process.stdout.write(ANSI.MOVE_TO_LINE_3 + ANSI.CLEAR_LINE);
  for (let i = 0; i < 25; i++) {
    process.stdout.write('\n' + ANSI.CLEAR_LINE);
  }
  process.stdout.write(ANSI.MOVE_TO_LINE_3);
  logLineCount = 3;

  logMessage(chalk.cyan('\n📊 Clear Logo Import Statistics:'));
  logMessage(chalk.white(`   Total Target: ${stats.totalLogos.toLocaleString()} Clear Logos`));
  logMessage(chalk.green(`   ✅ Downloaded: ${stats.processed.toLocaleString()} (${((stats.processed / stats.totalLogos) * 100).toFixed(2)}%)`));
  logMessage(chalk.blue(`   💾 Database Size: ${stats.dbSizeMB.toFixed(1)} MB`));
  logMessage(chalk.yellow(`   🎯 Current: ${stats.currentGame} (${stats.currentPlatform})`));
  logMessage(chalk.magenta(`   ⚡ Speed: ${stats.logosPerSecond.toFixed(1)} logos/second`));
  logMessage(chalk.white(`   ⏱️ Uptime: ${formatUptime(uptime)}`));

  // Show platform breakdown
  try {
    const dbPath = path.join(process.cwd(), 'public', 'clear-logos.db');
    if (existsSync(dbPath)) {
      const db = new Database(dbPath);
      const platforms = db.prepare(`
        SELECT platform_name, COUNT(*) as count
        FROM clear_logos
        GROUP BY platform_name
        ORDER BY count DESC
        LIMIT 5
      `).all() as { platform_name: string; count: number }[];

      if (platforms.length > 0) {
        logMessage(chalk.cyan('\n🎮 Top Platforms:'));
        platforms.forEach(platform => {
          logMessage(chalk.white(`   ${platform.platform_name}: ${platform.count.toLocaleString()}`));
        });
      }

      db.close();
    }
  } catch (error) {
    // Ignore errors in stats display
  }
}

async function main() {
  console.log(chalk.cyan('🚀 Clear Logo Import Progress Monitor'));
  console.log(chalk.white('Press Ctrl+C to exit\n'));

  initializeSplitScreen();

  let samples: Array<{ count: number; time: number }> = [];
  const SAMPLE_WINDOW = 5; // Keep 5 seconds of samples (very responsive)

  // Monitor loop
  setInterval(() => {
    const stats = getClearLogoStats();

    if (!stats) {
      updateStickyProgressBar(chalk.red('❌ Clear Logo database not found. Import may not be running.'));
      return;
    }

    // Add current sample
    const currentTime = Date.now();
    samples.push({ count: stats.processed, time: currentTime });

    // Keep only recent samples
    samples = samples.filter(sample => currentTime - sample.time <= SAMPLE_WINDOW * 1000);

    // Calculate speed - use shorter window for more responsiveness
    if (samples.length >= 2) {
      // Use last 5 seconds for immediate responsiveness, or all samples if less
      const recentSamples = samples.filter(sample => currentTime - sample.time <= 5000);
      if (recentSamples.length >= 2) {
        const oldestRecent = recentSamples[0];
        const newestRecent = recentSamples[recentSamples.length - 1];
        const timeDiff = (newestRecent.time - oldestRecent.time) / 1000;
        const countDiff = newestRecent.count - oldestRecent.count;

        if (timeDiff > 0 && countDiff > 0) {
          stats.logosPerSecond = countDiff / timeDiff;
        } else {
          // Fallback to longer window
          const oldestSample = samples[0];
          const newestSample = samples[samples.length - 1];
          const longTimeDiff = (newestSample.time - oldestSample.time) / 1000;
          const longCountDiff = newestSample.count - oldestSample.count;
          stats.logosPerSecond = longTimeDiff > 0 ? longCountDiff / longTimeDiff : 0;
        }
      } else {
        const oldestSample = samples[0];
        const newestSample = samples[samples.length - 1];
        const timeDiff = (newestSample.time - oldestSample.time) / 1000;
        const countDiff = newestSample.count - oldestSample.count;
        stats.logosPerSecond = timeDiff > 0 ? countDiff / timeDiff : 0;
      }
    } else {
      stats.logosPerSecond = 0;
    }

    // Update progress bar
    updateProgressBar(stats);

    // Show completion status
    if (stats.processed >= stats.totalLogos) {
      logMessage(chalk.green('\n🎉 Clear Logo import completed successfully!'));
      logMessage(chalk.white(`✅ Final count: ${stats.processed.toLocaleString()} Clear Logos`));
      logMessage(chalk.white(`💾 Database size: ${stats.dbSizeMB.toFixed(1)} MB`));
      return;
    }

  }, 200); // Update every 200ms (5 times per second) for real-time feel

  // Show detailed stats every 5 seconds (more frequent)
  setInterval(() => {
    const stats = getClearLogoStats();
    if (stats && stats.processed < stats.totalLogos) {
      showStats(stats);
    }
  }, 5000);

  // Cleanup on exit
  process.on('SIGINT', () => {
    process.stdout.write(ANSI.SHOW_CURSOR);
    process.stdout.write('\n' + chalk.yellow('👋 Progress monitor stopped.\n'));
    process.exit(0);
  });
}

main().catch(console.error);