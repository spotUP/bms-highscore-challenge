import React, { useState, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, ExternalLink, TrendingUp, Users, Award } from "lucide-react";
import { ratingAggregationService, GameRatings, RatingSource } from "@/services/ratingAggregationService";

interface GameRatingDisplayProps {
  gameName: string;
  platform?: string;
  launchboxRating?: number;
  launchboxRatingCount?: number;
  className?: string;
  showSources?: boolean;
}

interface RatingSourceProps {
  source: RatingSource;
  size?: 'sm' | 'md' | 'lg';
}

const RatingSourceBadge: React.FC<RatingSourceProps> = ({ source, size = 'md' }) => {
  const getSourceInfo = (sourceType: string) => {
    const info = {
      'launchbox': { name: 'LaunchBox', color: 'bg-blue-600', icon: '🎮' },
      'rawg': { name: 'RAWG', color: 'bg-purple-600', icon: '🎯' },
      'igdb': { name: 'IGDB', color: 'bg-indigo-600', icon: '🎭' },
      'metacritic': { name: 'Metacritic', color: 'bg-yellow-600', icon: '⭐' },
      'steam': { name: 'Steam', color: 'bg-gray-600', icon: '🔵' }
    };
    return info[sourceType] || { name: sourceType, color: 'bg-gray-500', icon: '🎲' };
  };

  const sourceInfo = getSourceInfo(source.source);
  const normalizedRating = (source.rating / source.maxRating) * 5;
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2'
  };

  return (
    <div className={`flex items-center gap-2 ${size === 'sm' ? 'text-xs' : ''}`}>
      <Badge
        className={`${sourceInfo.color} text-white ${sizeClasses[size]} flex items-center gap-1`}
      >
        <span>{sourceInfo.icon}</span>
        <span>{sourceInfo.name}</span>
        <Star className="w-3 h-3 fill-current" />
        <span className="font-bold">{normalizedRating.toFixed(1)}</span>
      </Badge>
      {source.reviewCount && source.reviewCount > 0 && (
        <span className="text-xs text-muted-foreground">
          {source.reviewCount.toLocaleString()} reviews
        </span>
      )}
    </div>
  );
};

export const GameRatingDisplay: React.FC<GameRatingDisplayProps> = ({
  gameName,
  platform,
  launchboxRating,
  launchboxRatingCount,
  className = '',
  showSources = false
}) => {
  const [gameRatings, setGameRatings] = useState<GameRatings | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchRatings = async () => {
      if (!gameName) return;

      setLoading(true);
      try {
        const ratings = await ratingAggregationService.getCachedGameRatings(
          gameName,
          platform,
          launchboxRating && launchboxRatingCount ? {
            rating: launchboxRating,
            count: launchboxRatingCount
          } : undefined
        );
        setGameRatings(ratings);
      } catch (error) {
        console.error('Error fetching ratings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRatings();
  }, [gameName, platform, launchboxRating, launchboxRatingCount]);

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-4 h-4 border-2 border-gray-300 border-t-yellow-500 rounded-full animate-spin"></div>
        <span className="text-sm text-muted-foreground">Loading ratings...</span>
      </div>
    );
  }

  if (!gameRatings || gameRatings.aggregated.sources.length === 0) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        No ratings available
      </div>
    );
  }

  const { aggregated } = gameRatings;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Main Aggregated Rating */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Star className="w-5 h-5 text-yellow-500 fill-current" />
          <span className="text-lg font-bold">{aggregated.averageRating.toFixed(1)}</span>
          <span className="text-sm text-muted-foreground">/ 5.0</span>
        </div>

        {/* Confidence Badge */}
        {aggregated.confidence === 'low' && (
          <Badge variant="outline" className="text-xs">
            <Users className="w-3 h-3 mr-1" />
            low confidence
          </Badge>
        )}

        {/* Source Count */}
        <span className="text-sm text-muted-foreground">
          {aggregated.sources.length} source{aggregated.sources.length !== 1 ? 's' : ''}
        </span>

        {/* Total Reviews */}
        {aggregated.totalReviews > 0 && (
          <span className="text-sm text-muted-foreground">
            ({aggregated.totalReviews.toLocaleString()} reviews)
          </span>
        )}
      </div>

      {/* Source Details */}
      {showSources && aggregated.sources.length > 1 && (
        <div className="space-y-2">
          {!expanded && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(true)}
              className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground"
            >
              View individual ratings ({aggregated.sources.length} sources)
            </Button>
          )}

          {expanded && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Individual Ratings:</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(false)}
                  className="h-auto p-0 text-xs"
                >
                  Hide
                </Button>
              </div>

              <div className="space-y-2">
                {aggregated.sources.map((source, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <RatingSourceBadge source={source} size="sm" />
                    {source.url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="h-auto p-1"
                      >
                        <a href={source.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Single Source Display */}
      {showSources && aggregated.sources.length === 1 && (
        <RatingSourceBadge source={aggregated.sources[0]} size="sm" />
      )}
    </div>
  );
};