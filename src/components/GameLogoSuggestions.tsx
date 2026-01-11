import { useState, forwardRef, useImperativeHandle, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { clearLogoService } from "@/services/clearLogoService";
import { supabase } from "@/integrations/supabase/client";

interface GameLogoSuggestionsProps {
  gameName: string;
  selectedImageUrl?: string;
  onSelectImage: (imageUrl: string) => void;
  onLogosFound?: (hasLogos: boolean, areFromClearService: boolean) => void;
}

interface ImageResult {
  url: string;
  alt: string;
}

export interface GameLogoSuggestionsRef {
  searchForLogos: () => void;
}

const GameLogoSuggestions = forwardRef<GameLogoSuggestionsRef, GameLogoSuggestionsProps>(({ gameName, onSelectImage, onLogosFound }, ref) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const searchForLogos = async (showToasts = true) => {
    if (!gameName.trim()) {
      if (showToasts) {
        toast({
          title: "Error",
          description: "Please enter a game name first",
          variant: "destructive"
        });
      }
      return;
    }

    setLoading(true);
    try {
      console.log(`🔍 Searching database for: "${gameName}"`);

      // Use the same database search as AdvancedSearchField - simple and effective!
      const { data: dbMatches, error } = await supabase
        .from('games_database')
        .select('name')
        .ilike('name', `%${gameName}%`)
        .limit(10);

      if (error) {
        console.error('Database search error:', error);
        throw error;
      }

      const gameNames = dbMatches?.map(game => game.name) || [];
      console.log(`📊 Found ${gameNames.length} games in database:`, gameNames);

      // If no games found, return empty results
      if (gameNames.length === 0) {
        onLogosFound?.(false, false);
        if (showToasts) {
          toast({
            title: "No Results",
            description: "No games found in database matching your search",
          });
        }
        setLoading(false);
        return;
      }

      // Try to get clear logos for the found games from database
      const clearLogoResults: ImageResult[] = [];

      if (gameNames.length > 0) {
        try {
          const clearLogos = await clearLogoService.getClearLogosForGames(gameNames);

          Object.entries(clearLogos).forEach(([name, url]) => {
            if (url) {
              clearLogoResults.push({
                url,
                alt: `${name} logo`
              });
            }
          });

          console.log(`Found ${clearLogoResults.length} clear logos for database matches`);

          // If we found clear logos, automatically select the first one
          if (clearLogoResults.length > 0) {
            onSelectImage(clearLogoResults[0].url);
            onLogosFound?.(true, true); // Has logos, from clear service
            setLoading(false);
            return;
          }
        } catch (error) {
          console.warn('Clear logo service failed:', error);
          onLogosFound?.(false, false);
        }
      } else {
        onLogosFound?.(false, false);
      }

      // Debug logging
      console.log(`Search for "${gameName}":`, {
        databaseMatches: gameNames,
        clearLogosFound: clearLogoResults.length
      });

      if (showToasts && clearLogoResults.length === 0) {
        toast({
          title: "No Results",
          description: "No logo images found for this game in our database",
        });
      }
    } catch (error) {
      console.error('Error searching for logos:', error);
      if (showToasts) {
        toast({
          title: "Error",
          description: "Failed to search for logo images",
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Only search when explicitly triggered (not on gameName change)
  // The parent component should call searchForLogos when needed

  // Expose searchForLogos function to parent component (rarely needed now)
  useImperativeHandle(ref, () => ({
    searchForLogos: () => searchForLogos(true) // Manual searches show toasts
  }));

  return null; // No UI needed since we auto-select logos
});

GameLogoSuggestions.displayName = 'GameLogoSuggestions';

export default GameLogoSuggestions;