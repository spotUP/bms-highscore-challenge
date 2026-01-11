import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

interface ProgressStats {
  totalGames: number;
  gamesWithLogos: number;
  gamesWithoutLogos: number;
  progressPercent: number;
  estimatedTimeRemaining: string;
}

let lastLogoCount = 0;
let lastCheckTime = Date.now();
let rateHistory: number[] = [];

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function createProgressBar(percent: number, width: number = 50): string {
  const filled = Math.floor((percent / 100) * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `[${bar}] ${percent.toFixed(2)}%`;
}

async function getProgressStats(): Promise<ProgressStats> {
  try {
    const { count: totalGames } = await supabase
      .from('games_database')
      .select('*', { count: 'exact', head: true });

    const { count: gamesWithLogos } = await supabase
      .from('games_database')
      .select('*', { count: 'exact', head: true })
      .not('logo_url', 'is', null);

    const total = totalGames || 0;
    const withLogos = gamesWithLogos || 0;
    const withoutLogos = total - withLogos;
    const progressPercent = total > 0 ? (withLogos / total) * 100 : 0;

    // Calculate processing rate
    const currentTime = Date.now();
    const timeDiff = (currentTime - lastCheckTime) / 1000; // seconds
    const logosDiff = withLogos - lastLogoCount;
    const currentRate = timeDiff > 0 ? logosDiff / timeDiff : 0; // logos per second

    // Update rate history (keep last 10 measurements)
    if (rateHistory.length >= 10) {
      rateHistory.shift();
    }
    rateHistory.push(currentRate);

    // Calculate average rate
    const avgRate = rateHistory.reduce((sum, rate) => sum + rate, 0) / rateHistory.length;

    // Estimate time remaining
    let estimatedTimeRemaining = "Calculating...";
    if (avgRate > 0 && withoutLogos > 0) {
      const secondsRemaining = withoutLogos / avgRate;
      estimatedTimeRemaining = formatTime(secondsRemaining);
    } else if (withoutLogos === 0) {
      estimatedTimeRemaining = "Complete!";
    }

    lastLogoCount = withLogos;
    lastCheckTime = currentTime;

    return {
      totalGames: total,
      gamesWithLogos: withLogos,
      gamesWithoutLogos: withoutLogos,
      progressPercent,
      estimatedTimeRemaining
    };
  } catch (error) {
    console.error('Error fetching progress:', error);
    return {
      totalGames: 0,
      gamesWithLogos: 0,
      gamesWithoutLogos: 0,
      progressPercent: 0,
      estimatedTimeRemaining: "Error"
    };
  }
}

async function displayProgress() {
  const stats = await getProgressStats();

  // Clear screen and move cursor to top
  process.stdout.write('\x1b[2J\x1b[H');

  console.log('🚀 LIVE LAUNCHBOX LOGO SCRAPING PROGRESS 🚀\n');
  console.log('='.repeat(60));
  console.log(`📊 Total Games:        ${stats.totalGames.toLocaleString()}`);
  console.log(`✅ Games with Logos:   ${stats.gamesWithLogos.toLocaleString()}`);
  console.log(`❌ Games without Logos: ${stats.gamesWithoutLogos.toLocaleString()}`);
  console.log('='.repeat(60));

  // Progress bar
  console.log('\n📈 PROGRESS:');
  console.log(createProgressBar(stats.progressPercent, 60));
  console.log(`\n⏱️  Estimated Time Remaining: ${stats.estimatedTimeRemaining}`);

  // Processing rate info
  if (rateHistory.length > 0) {
    const currentRate = rateHistory[rateHistory.length - 1];
    const avgRate = rateHistory.reduce((sum, rate) => sum + rate, 0) / rateHistory.length;
    console.log(`\n⚡ Current Rate:  ${(currentRate * 60).toFixed(1)} logos/min`);
    console.log(`📊 Average Rate:  ${(avgRate * 60).toFixed(1)} logos/min`);
  }

  console.log('\n🔧 Active Instances: ~22 parallel processes');
  console.log('🌐 Source: LaunchBox Games Database (Web Scraping)');
  console.log('\n' + '='.repeat(60));
  console.log('⏹️  Press Ctrl+C to stop monitoring');

  const timestamp = new Date().toLocaleTimeString();
  console.log(`🕐 Last Updated: ${timestamp}`);
}

async function startMonitoring() {
  console.log('🔄 Starting live progress monitoring...\n');

  // Initial display
  await displayProgress();

  // Update every 5 seconds
  const interval = setInterval(async () => {
    await displayProgress();
  }, 5000);

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\n\n👋 Progress monitoring stopped.');
    process.exit(0);
  });
}

// Start monitoring
startMonitoring().catch(console.error);