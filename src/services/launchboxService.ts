// LaunchBox Games Database service for fetching clear logos
// https://gamesdb.launchbox-app.com/

export interface LaunchBoxGame {
  id: number;
  name: string;
  releaseDate?: string;
  platform?: string;
  clearLogoUrl?: string;
}

export interface LaunchBoxSearchResult {
  games: LaunchBoxGame[];
  totalCount: number;
}

class LaunchBoxService {
  private baseUrl = 'https://gamesdb.launchbox-app.com';
  private imagesUrl = 'https://images.launchbox-app.com';

  // Use CORS proxy for all browser requests since LaunchBox doesn't allow direct CORS
  private isDevelopment = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
     window.location.hostname === '127.0.0.1' ||
     window.location.hostname.includes('localhost'));

  // Always use CORS proxy in browser environments since LaunchBox API doesn't support CORS
  private corsProxy = typeof window !== 'undefined' ? 'https://api.allorigins.win/get?url=' : '';

  // Cache to avoid repeated requests for the same game
  private logoCache = new Map<string, string | null>();
  private pendingRequests = new Map<string, Promise<string | null>>();

  constructor() {
    console.log(`🌐 LaunchBox Service initialized in ${this.isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);
    console.log(`📡 API calls will be ${this.corsProxy ? 'PROXIED via ' + this.corsProxy.replace('https://api.allorigins.win/get?url=', 'AllOrigins CORS proxy') : 'DIRECT'}`);
  }

  // Rate limiting
  private requestQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue = false;
  private lastRequestTime = 0;
  private minRequestInterval = 100; // Further reduced to 100ms for faster loading

  // Circuit breaker to stop making requests when API is overloaded
  private circuitBreakerFailures = 0;
  private circuitBreakerThreshold = 5; // Allow more failures before opening (increased from 2)
  private circuitBreakerResetTime = 120000; // Reset after 2 minutes (reduced from 3)
  private circuitBreakerOpenTime = 0;
  private isCircuitBreakerOpen = false;

  /**
   * Check if circuit breaker should be reset
   */
  private checkCircuitBreaker(): boolean {
    if (this.isCircuitBreakerOpen) {
      const now = Date.now();
      if (now - this.circuitBreakerOpenTime > this.circuitBreakerResetTime) {
        console.log('LaunchBox circuit breaker reset - trying again');
        this.isCircuitBreakerOpen = false;
        this.circuitBreakerFailures = 0;
        return false;
      }
      return true; // Still open
    }
    return false; // Not open
  }

  /**
   * Record success/failure for circuit breaker
   */
  private recordResult(success: boolean, errorType?: string) {
    if (success) {
      // Reset failure count on any success
      if (this.circuitBreakerFailures > 0) {
        console.log('LaunchBox request succeeded, resetting failure count');
        this.circuitBreakerFailures = 0;
      }
    } else {
      this.circuitBreakerFailures++;
      if (this.circuitBreakerFailures >= this.circuitBreakerThreshold) {
        console.log(`LaunchBox circuit breaker opened after ${this.circuitBreakerFailures} failures (${errorType}). Disabling for ${this.circuitBreakerResetTime / 60000} minutes.`);
        this.isCircuitBreakerOpen = true;
        this.circuitBreakerOpenTime = Date.now();
      }
    }
  }

  /**
   * Add a request to the queue and process it with rate limiting
   */
  private async queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  /**
   * Process the request queue with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      if (timeSinceLastRequest < this.minRequestInterval) {
        await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest));
      }

      const request = this.requestQueue.shift();
      if (request) {
        this.lastRequestTime = Date.now();
        await request();
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Make a rate-limited fetch request with retry logic
   */
  private async makeRequest(url: string, retries = 1): Promise<Response> { // Reduced retries from 2 to 1
    // Check circuit breaker first
    if (this.checkCircuitBreaker()) {
      throw new Error('Circuit breaker is open - API temporarily unavailable');
    }

    return this.queueRequest(async () => {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          // Add timeout to fetch request
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for better UX

          const response = await fetch(url, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; GamesBrowser/1.0)'
            }
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            this.recordResult(true); // Success
            return response;
          }

          if (response.status === 429 || response.status === 408) {
            // Rate limited or timeout, wait longer before retry
            if (attempt < retries) {
              await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
              continue;
            }
          }

          lastError = new Error(`HTTP ${response.status}`);
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');
          if (attempt < retries) {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          }
        }
      }

      // All retries failed
      const errorType = lastError?.message.includes('408') ? 'Timeout' :
                       lastError?.message.includes('429') ? 'Rate Limit' :
                       'Network Error';
      this.recordResult(false, errorType);
      throw lastError || new Error('Max retries exceeded');
    });
  }

  /**
   * Search for games on LaunchBox and extract clear logos
   */
  async searchGames(gameName: string, limit: number = 10): Promise<LaunchBoxSearchResult> {
    try {
      // Search for the game using the correct URL structure
      const searchUrl = `${this.baseUrl}/games/results/${encodeURIComponent(gameName)}`;
      const finalUrl = this.corsProxy ? `${this.corsProxy}${encodeURIComponent(searchUrl)}` : searchUrl;

      console.log('Searching LaunchBox for:', gameName, 'at', searchUrl, this.corsProxy ? '(via proxy)' : '(direct)');

      const response = await this.makeRequest(finalUrl);
      if (!response.ok) {
        throw new Error(`LaunchBox search failed: ${response.status}`);
      }

      // Handle response differently for proxied vs direct requests
      let html: string;
      if (this.corsProxy && this.corsProxy.includes('allorigins')) {
        // AllOrigins proxy - extract from JSON
        const data = await response.json();
        html = data.contents;
      } else {
        // Direct response or corsproxy.io - use HTML directly
        html = await response.text();
      }
      console.log('LaunchBox search response length:', html.length);

      // Parse the search results page to extract game links
      const gameMatches = this.parseSearchResults(html);
      console.log('Found game matches:', gameMatches.length);

      // Limit results and fetch clear logos for each game
      const limitedGames = gameMatches.slice(0, limit);

      // Process games in optimized batches for faster loading
      const batchSize = 5; // Increased batch size for faster loading
      const gamesWithLogos: (PromiseSettledResult<LaunchBoxGame | null>)[] = [];

      for (let i = 0; i < limitedGames.length; i += batchSize) {
        const batch = limitedGames.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(game => this.fetchGameClearLogo(game))
        );
        gamesWithLogos.push(...batchResults);
      }

      const successfulGames = gamesWithLogos
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => (result as PromiseFulfilledResult<LaunchBoxGame | null>).value) as LaunchBoxGame[];

      return {
        games: successfulGames,
        totalCount: gameMatches.length
      };

    } catch (error) {
      console.error('LaunchBox search error:', error);
      return {
        games: [],
        totalCount: 0
      };
    }
  }

  /**
   * Parse search results HTML to extract game information
   */
  private parseSearchResults(html: string): Partial<LaunchBoxGame>[] {
    const games: Partial<LaunchBoxGame>[] = [];

    // Look for game links in the HTML
    // Pattern: /games/details/[id]-[slug]
    const gameUrlRegex = /\/games\/details\/(\d+)-([^"]+)/g;
    let match;

    while ((match = gameUrlRegex.exec(html)) !== null) {
      const id = parseInt(match[1]);
      const slug = match[2];
      const name = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

      games.push({
        id,
        name
      });
    }

    // Remove duplicates
    const uniqueGames = games.filter((game, index, self) =>
      index === self.findIndex(g => g.id === game.id)
    );

    return uniqueGames;
  }

  /**
   * Fetch clear logo for a specific game
   */
  private async fetchGameClearLogo(game: Partial<LaunchBoxGame>): Promise<LaunchBoxGame | null> {
    if (!game.id || !game.name) return null;

    try {
      const gameUrl = `${this.baseUrl}/games/details/${game.id}`;
      const finalUrl = this.corsProxy ? `${this.corsProxy}${encodeURIComponent(gameUrl)}` : gameUrl;

      const response = await this.makeRequest(finalUrl);
      if (!response.ok) {
        console.warn(`Failed to fetch game details for ${game.name}: ${response.status}`);
        return null;
      }

      // Handle response differently for proxied vs direct requests
      let html: string;
      if (this.corsProxy && this.corsProxy.includes('allorigins')) {
        // AllOrigins proxy - extract from JSON
        const data = await response.json();
        html = data.contents;
      } else {
        // Direct response or corsproxy.io - use HTML directly
        html = await response.text();
      }

      // Look for clear logo in the HTML
      const clearLogoUrl = this.extractClearLogoUrl(html);

      return {
        id: game.id,
        name: game.name,
        clearLogoUrl,
        releaseDate: this.extractReleaseDate(html),
        platform: this.extractPlatform(html)
      };

    } catch (error) {
      console.error(`Error fetching clear logo for ${game.name}:`, error);
      return null;
    }
  }

  /**
   * Extract clear logo URL from game page HTML
   */
  private extractClearLogoUrl(html: string): string | undefined {
    // Try multiple approaches to find clear logos

    // Method 1: Look for "Clear Logo" text and find images after it
    const clearLogoIndex = html.indexOf('Clear Logo');
    if (clearLogoIndex !== -1) {
      const afterClearLogo = html.substring(clearLogoIndex, clearLogoIndex + 2000);
      const imageMatch = afterClearLogo.match(/https:\/\/images\.launchbox-app\.com\/[^"'\s]+\.png/);
      if (imageMatch) {
        console.log('Found clear logo via "Clear Logo" text:', imageMatch[0]);
        return imageMatch[0];
      }
    }

    // Method 2: Look for any clear logo images in the entire page
    const clearLogoPatterns = [
      /https:\/\/images\.launchbox-app\.com\/[^"'\s]*clear[^"'\s]*\.png/gi,
      /https:\/\/images\.launchbox-app\.com\/[^"'\s]*logo[^"'\s]*\.png/gi,
      /https:\/\/images\.launchbox-app\.com\/[^"'\s]+\.png/g
    ];

    for (const pattern of clearLogoPatterns) {
      const matches = html.match(pattern);
      if (matches && matches.length > 0) {
        // Filter for likely clear logo URLs (avoid fanart, screenshots, etc.)
        const clearLogos = matches.filter(url => {
          const urlLower = url.toLowerCase();
          return (urlLower.includes('clear') || urlLower.includes('logo')) &&
                 !urlLower.includes('fanart') &&
                 !urlLower.includes('screenshot') &&
                 !urlLower.includes('banner');
        });

        if (clearLogos.length > 0) {
          console.log('Found clear logo via pattern matching:', clearLogos[0]);
          return clearLogos[0];
        }

        // If no specific clear logos found, try the first PNG that might be a logo
        if (matches.length > 0) {
          console.log('Found potential logo image:', matches[0]);
          return matches[0];
        }
      }
    }

    console.log('No clear logo found in HTML');
    return undefined;
  }

  /**
   * Extract release date from game page HTML
   */
  private extractReleaseDate(html: string): string | undefined {
    const releaseDateRegex = /Release Date["\s]*:["\s]*([^"<]+)/i;
    const match = releaseDateRegex.exec(html);
    return match ? match[1].trim() : undefined;
  }

  /**
   * Extract platform from game page HTML
   */
  private extractPlatform(html: string): string | undefined {
    const platformRegex = /Platform["\s]*:["\s]*([^"<]+)/i;
    const match = platformRegex.exec(html);
    return match ? match[1].trim() : undefined;
  }

  /**
   * Check if a game name is likely to cause API issues
   */
  private isProblematicGameName(gameName: string): boolean {
    const cleanName = gameName.trim();

    // Skip very short names or names with special characters that cause timeouts
    if (cleanName.length <= 2) return true;
    if (cleanName.startsWith('-') && cleanName.length <= 10) return true;
    if (cleanName.includes('_'.repeat(5))) return true; // Skip names like "_________"

    return false;
  }

  /**
   * Get clear logo for a specific game by name (simplified interface)
   */
  async getClearLogo(gameName: string): Promise<string | null> {
    try {
      // Check cache first
      const cacheKey = gameName.toLowerCase();
      if (this.logoCache.has(cacheKey)) {
        return this.logoCache.get(cacheKey) || null;
      }

      // Check if request is already pending to avoid duplicate requests
      if (this.pendingRequests.has(cacheKey)) {
        return await this.pendingRequests.get(cacheKey)!;
      }

      // Skip problematic game names that are likely to cause timeouts
      if (this.isProblematicGameName(gameName)) {
        console.log('Skipping problematic game name:', gameName);
        this.logoCache.set(cacheKey, null);
        return null;
      }

      // Create and store the pending request
      const requestPromise = this.fetchLogoFromAPI(gameName, cacheKey);
      this.pendingRequests.set(cacheKey, requestPromise);

      const logoUrl = await requestPromise;

      // Clean up pending request
      this.pendingRequests.delete(cacheKey);

      return logoUrl;
    } catch (error) {
      console.error('Error getting clear logo:', error);
      return null;
    }
  }

  /**
   * Internal method to fetch logo from API
   */
  private async fetchLogoFromAPI(gameName: string, cacheKey: string): Promise<string | null> {
    const results = await this.searchGames(gameName, 1);
    const logoUrl = results.games[0]?.clearLogoUrl || null;

    // Cache the result
    this.logoCache.set(cacheKey, logoUrl);

    return logoUrl;
  }
}

export const launchBoxService = new LaunchBoxService();