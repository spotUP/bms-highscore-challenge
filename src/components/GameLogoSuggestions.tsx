import { useState, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import gameLogoMapping from "@/data/game-logo-mapping.json";

interface GameLogoSuggestionsProps {
  gameName: string;
  onSelectImage: (imageUrl: string) => void;
}

interface ImageResult {
  url: string;
  alt: string;
}

export interface GameLogoSuggestionsRef {
  searchForLogos: () => void;
}

const GameLogoSuggestions = forwardRef<GameLogoSuggestionsRef, GameLogoSuggestionsProps>(({ gameName, onSelectImage }, ref) => {
  const [suggestions, setSuggestions] = useState<ImageResult[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const searchForLogos = async () => {
    if (!gameName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a game name first",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const searchTerm = gameName.trim().toLowerCase();
      const supabaseUrl = 'https://tnsgrwntmnzpaifmutqh.supabase.co';
      
      // Create a comprehensive search that includes exact matches and fuzzy matching
      const allGames = Object.entries(gameLogoMapping);
      const matchingGames: Array<[string, any]> = [];
      
      // First, try exact match by game title
      const exactMatch = allGames.find(([gameTitle]) => 
        gameTitle.toLowerCase() === searchTerm
      );
      if (exactMatch) {
        matchingGames.push(exactMatch);
      }
      
      // Then try exact match by MAME name
      const mameMatch = allGames.find(([, gameData]) => 
        gameData.mameName.toLowerCase() === searchTerm
      );
      if (mameMatch && !matchingGames.includes(mameMatch)) {
        matchingGames.push(mameMatch);
      }
      
      // Then try fuzzy matching on all fields
      const fuzzyMatches = allGames.filter(([gameTitle, gameData]) => {
        const title = gameTitle.toLowerCase();
        const mameName = gameData.mameName.toLowerCase();
        const mameTitle = gameData.mameTitle.toLowerCase();
        
        return (title.includes(searchTerm) || 
                mameName.includes(searchTerm) || 
                mameTitle.includes(searchTerm) ||
                searchTerm.includes(title) ||
                searchTerm.includes(mameName) ||
                searchTerm.includes(mameTitle)) &&
               !matchingGames.some(([existingTitle]) => existingTitle === gameTitle);
      });
      
      matchingGames.push(...fuzzyMatches);

      // Convert to image results with Supabase Storage URLs
      const imageResults: ImageResult[] = matchingGames.slice(0, 6).map(([gameTitle, gameData]) => ({
        url: `${supabaseUrl}/storage/v1/object/public/game-logos/${gameData.logoFile}`,
        alt: `${gameTitle} logo`
      }));

      setSuggestions(imageResults);
      
      // Debug logging
      console.log(`Search for "${gameName}":`, {
        searchTerm,
        exactMatch: exactMatch ? exactMatch[0] : null,
        mameMatch: mameMatch ? mameMatch[0] : null,
        totalMatches: matchingGames.length,
        results: imageResults.map(r => r.alt)
      });
      
      if (imageResults.length === 0) {
        toast({
          title: "No Results",
          description: "No logo images found for this game in our database",
        });
      } else {
        toast({
          title: "Found Logos",
          description: `Found ${imageResults.length} logo(s) for "${gameName}"`,
        });
      }
    } catch (error) {
      console.error('Error searching for logos:', error);
      toast({
        title: "Error",
        description: "Failed to search for logo images",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Expose searchForLogos function to parent component
  useImperativeHandle(ref, () => ({
    searchForLogos
  }));

  const handleImageSelect = (imageUrl: string) => {
    onSelectImage(imageUrl);
    toast({
      title: "Success",
      description: "Logo selected successfully",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={searchForLogos}
          disabled={loading || !gameName.trim()}
          className="flex items-center space-x-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          <span>Search Local Game Logos</span>
        </Button>
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-300">Click on an image to select it:</p>
          <div className="grid grid-cols-2 gap-3">
            {suggestions.map((image, index) => (
              <Card 
                key={index} 
                className="bg-black/30 border-white/20 cursor-pointer hover:border-arcade-neonCyan/50 transition-colors"
                onClick={() => handleImageSelect(image.url)}
              >
                <CardContent className="p-3">
                  <img
                    src={image.url}
                    alt={image.alt}
                    className="w-full h-20 object-contain rounded bg-white/10"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

GameLogoSuggestions.displayName = 'GameLogoSuggestions';

export default GameLogoSuggestions;