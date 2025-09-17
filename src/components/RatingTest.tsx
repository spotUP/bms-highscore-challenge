import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GameRatingDisplay } from "./GameRatingDisplay";
import { GameMediaGallery } from "./GameMediaGallery";

export const RatingTest: React.FC = () => {
  const [testGame, setTestGame] = useState('Super Mario World');
  const [testPlatform, setTestPlatform] = useState('SNES');
  const [showTest, setShowTest] = useState(false);

  const handleTest = () => {
    setShowTest(true);
  };

  const rawgApiKey = import.meta.env.VITE_RAWG_API_KEY;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>🎯 Enhanced Rating System Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            RAWG API Status: {rawgApiKey ? '✅ Connected' : '❌ Not configured'}
          </p>

          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Game name"
              value={testGame}
              onChange={(e) => setTestGame(e.target.value)}
            />
            <Input
              placeholder="Platform"
              value={testPlatform}
              onChange={(e) => setTestPlatform(e.target.value)}
            />
          </div>

          <Button onClick={handleTest} className="w-full">
            Test Enhanced Ratings
          </Button>
        </div>

        {showTest && (
          <div className="border-t pt-4 space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Rating Results for "{testGame}":</h3>
              <GameRatingDisplay
                gameName={testGame}
                platform={testPlatform}
                showSources={true}
              />
            </div>

            <div>
              <h3 className="font-semibold mb-2">Media Gallery for "{testGame}":</h3>
              <GameMediaGallery
                gameName={testGame}
                platform={testPlatform}
              />
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• LaunchBox ratings are already working (114k+ games)</p>
          <p>• RAWG integration adds modern game ratings + screenshots + videos</p>
          <p>• IGDB integration adds comprehensive media galleries (if configured)</p>
          <p>• System automatically aggregates multiple sources</p>
          <p>• Shows confidence levels and source attribution</p>
        </div>
      </CardContent>
    </Card>
  );
};