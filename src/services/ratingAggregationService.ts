// Rating Aggregation Service - Multiple source game ratings
// Combines LaunchBox, RAWG, IGDB, and Metacritic ratings

export interface RatingSource {
  source: 'launchbox' | 'rawg' | 'igdb' | 'metacritic' | 'steam';
  rating: number;
  maxRating: number;
  reviewCount?: number;
  url?: string;
}

export interface AggregatedRating {
  averageRating: number;
  maxRating: number;
  totalReviews: number;
  sources: RatingSource[];
  confidence: 'low' | 'medium' | 'high'; // Based on number of sources and reviews
}

export interface GameRatings {
  gameName: string;
  platform?: string;
  launchboxRating?: RatingSource;
  rawgRating?: RatingSource;
  igdbRating?: RatingSource;
  metacriticRating?: RatingSource;
  steamRating?: RatingSource;
  aggregated: AggregatedRating;
}

class RatingAggregationService {
  private rawgApiKey?: string;
  private igdbClientId?: string;
  private igdbAccessToken?: string;

  constructor() {
    // Initialize API keys from environment
    this.rawgApiKey = import.meta.env.VITE_RAWG_API_KEY;
    this.igdbClientId = import.meta.env.VITE_IGDB_CLIENT_ID;
    this.igdbAccessToken = import.meta.env.VITE_IGDB_ACCESS_TOKEN;
  }

  /**
   * Aggregate ratings from multiple sources
   */
  aggregateRatings(sources: RatingSource[]): AggregatedRating {
    if (sources.length === 0) {
      return {
        averageRating: 0,
        maxRating: 5,
        totalReviews: 0,
        sources: [],
        confidence: 'low'
      };
    }

    // Normalize all ratings to 0-5 scale
    const normalizedRatings = sources.map(source => {
      const normalized = (source.rating / source.maxRating) * 5;
      return {
        rating: normalized,
        weight: this.getSourceWeight(source.source),
        reviewCount: source.reviewCount || 1
      };
    });

    // Calculate weighted average
    const totalWeight = normalizedRatings.reduce((sum, r) => sum + r.weight, 0);
    const weightedSum = normalizedRatings.reduce((sum, r) => sum + (r.rating * r.weight), 0);
    const averageRating = weightedSum / totalWeight;

    // Calculate total reviews
    const totalReviews = sources.reduce((sum, s) => sum + (s.reviewCount || 0), 0);

    // Determine confidence level
    const confidence = this.getConfidenceLevel(sources.length, totalReviews);

    return {
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      maxRating: 5,
      totalReviews,
      sources,
      confidence
    };
  }

  /**
   * Get weight for different rating sources
   */
  private getSourceWeight(source: string): number {
    const weights = {
      'metacritic': 1.2,    // Professional reviews
      'igdb': 1.1,          // Comprehensive community
      'rawg': 1.0,          // Large modern gaming community
      'launchbox': 0.9,     // Retro gaming community
      'steam': 0.8          // Platform-specific
    };
    return weights[source] || 1.0;
  }

  /**
   * Determine confidence level based on sources and review count
   */
  private getConfidenceLevel(sourceCount: number, reviewCount: number): 'low' | 'medium' | 'high' {
    if (sourceCount >= 3 && reviewCount >= 50) return 'high';
    if (sourceCount >= 2 && reviewCount >= 10) return 'medium';
    return 'low';
  }

  /**
   * Fetch RAWG rating for a game
   */
  async fetchRAWGRating(gameName: string, platform?: string): Promise<RatingSource | null> {
    if (!this.rawgApiKey) return null;

    try {
      const searchQuery = encodeURIComponent(gameName);
      const response = await fetch(
        `http://localhost:3001/rawg-api/api/games?key=${this.rawgApiKey}&search=${searchQuery}&page_size=5`
      );

      if (!response.ok) return null;

      const data = await response.json();
      const game = data.results?.[0];

      if (game && game.rating) {
        return {
          source: 'rawg',
          rating: game.rating,
          maxRating: 5,
          reviewCount: game.ratings_count || 0,
          url: `https://rawg.io/games/${game.slug}`
        };
      }
    } catch (error) {
      console.error('RAWG API error:', error);
      // Check if it's a rate limit error (429) or auth error (401)
      if (error instanceof Response && (error.status === 401 || error.status === 429)) {
        console.warn('RAWG API rate limited or auth failed - skipping RAWG rating');
      }
    }

    return null;
  }

  /**
   * Fetch IGDB rating for a game
   */
  async fetchIGDBRating(gameName: string): Promise<RatingSource | null> {
    if (!this.igdbClientId || !this.igdbAccessToken) return null;

    try {
      const response = await fetch('http://localhost:3001/igdb-api/v4/games', {
        method: 'POST',
        headers: {
          'Client-ID': this.igdbClientId,
          'Authorization': `Bearer ${this.igdbAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: `search "${gameName}"; fields name,rating,rating_count; limit 1;`
      });

      if (!response.ok) return null;

      const data = await response.json();
      const game = data[0];

      if (game && game.rating) {
        return {
          source: 'igdb',
          rating: game.rating,
          maxRating: 100,
          reviewCount: game.rating_count || 0,
          url: `https://www.igdb.com/games/${game.slug || ''}`
        };
      }
    } catch (error) {
      console.error('IGDB API error:', error);
    }

    return null;
  }

  /**
   * Get comprehensive ratings for a game
   */
  async getGameRatings(
    gameName: string,
    platform?: string,
    launchboxRating?: { rating: number; count: number }
  ): Promise<GameRatings> {
    const sources: RatingSource[] = [];

    // Add LaunchBox rating if available
    if (launchboxRating && launchboxRating.rating > 0) {
      sources.push({
        source: 'launchbox',
        rating: launchboxRating.rating,
        maxRating: 5,
        reviewCount: launchboxRating.count
      });
    }

    // Fetch from other sources in parallel
    const [rawgRating, igdbRating] = await Promise.allSettled([
      this.fetchRAWGRating(gameName, platform),
      this.fetchIGDBRating(gameName)
    ]);

    // Add successful ratings to sources
    if (rawgRating.status === 'fulfilled' && rawgRating.value) {
      sources.push(rawgRating.value);
    }

    if (igdbRating.status === 'fulfilled' && igdbRating.value) {
      sources.push(igdbRating.value);
    }

    // Aggregate all ratings
    const aggregated = this.aggregateRatings(sources);

    return {
      gameName,
      platform,
      launchboxRating: sources.find(s => s.source === 'launchbox'),
      rawgRating: sources.find(s => s.source === 'rawg'),
      igdbRating: sources.find(s => s.source === 'igdb'),
      aggregated
    };
  }

  /**
   * Cache ratings to avoid repeated API calls
   */
  private ratingCache = new Map<string, GameRatings>();

  async getCachedGameRatings(
    gameName: string,
    platform?: string,
    launchboxRating?: { rating: number; count: number }
  ): Promise<GameRatings> {
    const cacheKey = `${gameName}-${platform || 'unknown'}`;

    if (this.ratingCache.has(cacheKey)) {
      return this.ratingCache.get(cacheKey)!;
    }

    const ratings = await this.getGameRatings(gameName, platform, launchboxRating);
    this.ratingCache.set(cacheKey, ratings);

    return ratings;
  }
}

export const ratingAggregationService = new RatingAggregationService();