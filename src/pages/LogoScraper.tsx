import React, { useState, useEffect } from 'react';

interface ScraperProgress {
  instanceId: number;
  totalGames: number;
  processedGames: number;
  successfulLogos: number;
  failedLogos: number;
  currentGameId: number | null;
  currentGameName: string | null;
  currentPlatform: string | null;
  lastUpdate: string;
  status: 'running' | 'paused' | 'completed' | 'error';
  errors: string[];
  recentSuccesses?: Array<{
    gameId: number;
    gameName: string;
    platform: string;
    timestamp: string;
  }>;
}

interface RecentLogo {
  id: number;
  name: string;
  platform_name: string;
  logo_base64: string | null;
  processed_at: string;
}

export default function LogoScraper() {
  const [scraperProgress, setScraperProgress] = useState<{ [key: number]: ScraperProgress }>({});
  const [recentLogos, setRecentLogos] = useState<RecentLogo[]>([]);
  const [totalStats, setTotalStats] = useState({
    totalGames: 0,
    gamesWithLogos: 0,
    gamesWithoutLogos: 0,
    completionPercentage: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  const loadScraperProgress = async () => {
    try {
      // Try to load production scraper first, then fall back to other versions
      let progress = {};
      let scraperType = 'unknown';

      // Try production scraper first
      try {
        const responseProduction = await fetch('/production-scraper-progress.json');
        if (responseProduction.ok) {
          progress = await responseProduction.json();
          scraperType = 'production';
        }
      } catch (error) {
        console.log('Production scraper progress not available, trying others...');
      }

      // Try 6-instance scraper
      if (Object.keys(progress).length === 0) {
        try {
          const response6 = await fetch('/scraper-6-progress.json');
          if (response6.ok) {
            progress = await response6.json();
            scraperType = '6-instance';
          }
        } catch (error) {
          console.log('6-instance progress not available, trying 4-instance...');
        }
      }

      // Try 4-instance scraper
      if (Object.keys(progress).length === 0) {
        const response4 = await fetch('/scraper-progress.json');
        if (response4.ok) {
          progress = await response4.json();
          scraperType = '4-instance';
        }
      }

      setScraperProgress(progress);
    } catch (error) {
      console.error('Failed to load scraper progress:', error);
    }
  };

  const loadRecentLogos = async () => {
    try {
      // Fetch real logo data from our API
      const response = await fetch('/api/recent-logos.json');
      if (response.ok) {
        const data = await response.json();
        setRecentLogos(data.recentLogos || []);

        // Update stats with real data if available
        if (data.stats) {
          setTotalStats(data.stats);
        }
      } else {
        console.error('Failed to load recent logos API');
        setRecentLogos([]);
      }
    } catch (error) {
      console.error('Failed to load recent logos:', error);
      setRecentLogos([]);
    }
  };

  const loadTotalStats = async () => {
    // Stats are now loaded in loadRecentLogos to avoid duplication
    // This function is kept for compatibility but does nothing
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([
        loadScraperProgress(),
        loadRecentLogos(),
        loadTotalStats()
      ]);
      setIsLoading(false);
    };

    loadData();

    // Refresh data every 2 seconds
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-green-600';
      case 'completed': return 'text-blue-600';
      case 'error': return 'text-red-600';
      case 'paused': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return '🏃';
      case 'completed': return '✅';
      case 'error': return '❌';
      case 'paused': return '⏸️';
      default: return '❓';
    }
  };

  const totalProcessed = Object.values(scraperProgress).reduce((sum, p) => sum + p.processedGames, 0);
  const totalSuccessful = Object.values(scraperProgress).reduce((sum, p) => sum + p.successfulLogos, 0);
  const totalFailed = Object.values(scraperProgress).reduce((sum, p) => sum + p.failedLogos, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Loading scraper dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          🎮 Clear Logo Scraper Dashboard
        </h1>

        {/* Overall Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-700">Total Games</h3>
            <p className="text-3xl font-bold text-blue-600">{totalStats.totalGames.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-700">With Logos</h3>
            <p className="text-3xl font-bold text-green-600">{totalStats.gamesWithLogos.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-700">Without Logos</h3>
            <p className="text-3xl font-bold text-orange-600">{totalStats.gamesWithoutLogos.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-700">Completion</h3>
            <p className="text-3xl font-bold text-purple-600">{totalStats.completionPercentage}%</p>
          </div>
        </div>

        {/* Scraper Instances */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Scraper Instances ({Object.keys(scraperProgress).length} running)
            </h2>
            <p className="text-gray-600">
              Total Processed: {totalProcessed} | Successful: {totalSuccessful} | Failed: {totalFailed}
              {totalProcessed > 0 && (
                <span className="ml-2 text-sm">
                  | Overall Success Rate: {Math.round((totalSuccessful / totalProcessed) * 100)}%
                </span>
              )}
            </p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.values(scraperProgress).map((progress) => (
                <div key={progress.instanceId} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-semibold">
                      Instance {progress.instanceId}
                    </h3>
                    <span className={`text-xs font-medium ${getStatusColor(progress.status)}`}>
                      {getStatusIcon(progress.status)} {progress.status}
                    </span>
                  </div>

                  {progress.currentGameName && (
                    <div className="mb-2 p-2 bg-gray-50 rounded text-xs">
                      <p className="font-medium text-gray-700">Processing:</p>
                      <p className="text-gray-900 truncate" title={progress.currentGameName}>
                        {progress.currentGameName}
                      </p>
                      {progress.currentPlatform && (
                        <p className="text-blue-600 text-xs mt-1 font-medium">
                          🎮 {progress.currentPlatform}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-gray-500">ID: {progress.currentGameId}</span>
                        <a
                          href={`https://gamesdb.launchbox-app.com/games/details/${progress.currentGameId}-${progress.currentGameName?.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          View →
                        </a>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Processed:</span>
                      <span className="font-medium">{progress.processedGames}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Successful:</span>
                      <span className="font-medium text-green-600">{progress.successfulLogos}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Failed:</span>
                      <span className="font-medium text-red-600">{progress.failedLogos}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Success Rate:</span>
                      <span className="font-medium text-blue-600">
                        {progress.processedGames > 0
                          ? `${Math.round((progress.successfulLogos / progress.processedGames) * 100)}%`
                          : '0%'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last Update:</span>
                      <span className="text-xs text-gray-500">{formatTime(progress.lastUpdate)}</span>
                    </div>
                  </div>

                  {progress.recentSuccesses && progress.recentSuccesses.length > 0 && (
                    <div className="mt-2 p-2 bg-green-50 rounded border-l-4 border-green-400">
                      <p className="text-xs font-medium text-green-700 mb-1">✅ Recent Successes:</p>
                      {progress.recentSuccesses.map((success, index) => (
                        <div key={index} className="text-xs text-green-600 mb-1">
                          <div className="font-medium truncate" title={success.gameName}>
                            {success.gameName}
                          </div>
                          <div className="text-green-500 flex justify-between">
                            <span>{success.platform}</span>
                            <span>{new Date(success.timestamp).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {progress.errors.length > 0 && (
                    <div className="mt-2 p-2 bg-red-50 rounded">
                      <p className="text-xs font-medium text-red-700">Recent Errors:</p>
                      {progress.errors.slice(-2).map((error, index) => (
                        <p key={index} className="text-xs text-red-600 truncate" title={error}>
                          {error}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Logos */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Recently Processed Logos</h2>
          </div>
          <div className="p-6">
            {recentLogos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {recentLogos.map((game) => (
                  <div key={game.id} className="border rounded-lg p-4">
                    <div className="flex flex-col items-center space-y-3">
                      {game.logo_base64 && game.logo_base64.startsWith('data:image/') ? (
                        <img
                          src={game.logo_base64}
                          alt={game.name}
                          className="w-20 h-20 object-contain rounded"
                          style={{
                            background: 'linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)',
                            backgroundSize: '8px 8px',
                            backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px'
                          }}
                        />
                      ) : (
                        <div className="w-20 h-20 bg-gray-200 rounded flex items-center justify-center">
                          <span className="text-gray-400 text-xs">No Logo</span>
                        </div>
                      )}
                      <div className="text-center">
                        <h3 className="font-medium text-gray-900 text-sm">{game.name}</h3>
                        <p className="text-xs text-gray-500">{game.platform_name}</p>
                        <p className="text-xs text-gray-400">ID: {game.id}</p>
                        <p className="text-xs text-green-600 mt-1">✅ Valid Image</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-400 text-6xl mb-4">🎮</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Valid Logos Yet</h3>
                <p className="text-gray-600 mb-4">
                  The logo scraper will populate this section with successfully downloaded logo images.
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> The database currently contains 149,353 corrupted "logo" records
                    that are actually JSON metadata instead of image data. Once the new scraper is working,
                    you'll see real logo images here.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}