import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface GameLogoSuggestionsProps {
  gameName: string;
  onSelectImage: (imageUrl: string) => void;
}

interface ImageResult {
  url: string;
  alt: string;
}

const GameLogoSuggestions = ({ gameName, onSelectImage }: GameLogoSuggestionsProps) => {
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
      // Call our edge function to search for images
      const { data, error } = await supabase.functions.invoke('search-game-logos', {
        body: { 
          gameName: gameName.trim(),
          numResults: 4
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      const imageResults: ImageResult[] = data?.images?.map((url: string, index: number) => ({
        url,
        alt: `${gameName} logo ${index + 1}`
      })) || [];

      setSuggestions(imageResults);
      
      if (imageResults.length === 0) {
        toast({
          title: "No Results",
          description: "No logo images found for this game",
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
          <span>Search Logo Images</span>
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
                      console.log('Image failed to load:', image.url);
                      // Instead of hiding, show a fallback
                      e.currentTarget.src = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80"><rect width="200" height="80" fill="#374151"/><text x="100" y="40" text-anchor="middle" dominant-baseline="middle" fill="white" font-family="Arial, sans-serif" font-size="12">Failed to load</text></svg>`)}`;
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
};

export default GameLogoSuggestions;