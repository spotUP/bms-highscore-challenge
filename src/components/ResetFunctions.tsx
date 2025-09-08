import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import { getCardStyle, getButtonStyle, getTypographyStyle } from "@/utils/designSystem";

const ResetFunctions = () => {
  const { toast } = useToast();
  const [isResettingAchievements, setIsResettingAchievements] = useState(false);
  const [isResettingCompetition, setIsResettingCompetition] = useState(false);

  const resetAllAchievements = async () => {
    if (!confirm('⚠️ Are you sure you want to reset ALL achievements and player stats? This action cannot be undone!')) {
      return;
    }

    if (!confirm('🚨 FINAL WARNING: This will delete ALL player achievements and statistics permanently. Are you absolutely sure?')) {
      return;
    }

    setIsResettingAchievements(true);
    
    try {
      console.log('🗑️ Resetting all achievements...');
      
      const { data, error } = await supabase.functions.invoke('reset-achievements');
      
      if (error) {
        console.error('❌ Reset achievements error:', error);
        toast({
          title: "Error",
          description: `Failed to reset achievements: ${error.message}`,
          variant: "destructive"
        });
        return;
      }

      console.log('✅ Achievements reset response:', data);
      
      toast({
        title: "Success!",
        description: `Achievement system reset successfully. Deleted ${data.deleted?.player_achievements || 0} achievements and ${data.deleted?.player_stats || 0} player stats.`,
      });
      
    } catch (error: any) {
      console.error('❌ Reset achievements failed:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to reset achievements",
        variant: "destructive"
      });
    } finally {
      setIsResettingAchievements(false);
    }
  };

  const resetCompetitionScores = async () => {
    if (!confirm('⚠️ Are you sure you want to reset all scores for the current competition? This will also reset all achievements and player stats.')) {
      return;
    }

    if (!confirm('🚨 FINAL WARNING: This will delete ALL scores, achievements, and player statistics for the current competition. Are you absolutely sure?')) {
      return;
    }

    setIsResettingCompetition(true);
    
    try {
      console.log('🔄 Resetting competition scores...');
      
      const { data, error } = await supabase.functions.invoke('reset-competition-scores');
      
      if (error) {
        console.error('❌ Reset competition error:', error);
        toast({
          title: "Error",
          description: `Failed to reset competition: ${error.message}`,
          variant: "destructive"
        });
        return;
      }

      console.log('✅ Competition reset response:', data);
      
      if (data.games?.length === 0) {
        toast({
          title: "No Competition Active",
          description: "No active competition games found - nothing to reset.",
        });
      } else {
        toast({
          title: "Competition Reset!",
          description: `Reset ${data.games?.length || 0} games. Deleted ${data.deleted?.scores || 0} scores and ${data.deleted?.player_achievements || 0} achievements.`,
        });
      }
      
    } catch (error: any) {
      console.error('❌ Reset competition failed:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to reset competition",
        variant: "destructive"
      });
    } finally {
      setIsResettingCompetition(false);
    }
  };

  return (
    <Card className={getCardStyle('warning')}>
      <CardHeader>
        <CardTitle className={`${getTypographyStyle('h3')} flex items-center gap-2 text-red-400`}>
          <AlertTriangle className="w-5 h-5" />
          Danger Zone - Reset Functions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h4 className="font-semibold text-amber-400">Reset Competition</h4>
            <p className="text-sm text-gray-300">
              Reset all scores, achievements, and player stats for the current competition. 
              Games marked "Include in Challenge" will have their scores cleared.
            </p>
            <Button
              onClick={resetCompetitionScores}
              disabled={isResettingCompetition}
              className={`${getButtonStyle('warning')} w-full`}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              {isResettingCompetition ? "Resetting Competition..." : "Reset Competition"}
            </Button>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-red-400">Reset Everything</h4>
            <p className="text-sm text-gray-300">
              ⚠️ NUCLEAR OPTION: Reset ALL achievements and player statistics 
              for ALL players across ALL games. This cannot be undone!
            </p>
            <Button
              onClick={resetAllAchievements}
              disabled={isResettingAchievements}
              className={`${getButtonStyle('destructive')} w-full`}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {isResettingAchievements ? "Resetting All..." : "Reset All Achievements"}
            </Button>
          </div>
        </div>

        <div className="mt-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-200">
              <strong>Warning:</strong> These actions are permanent and cannot be undone. 
              Both functions will send notifications to your configured Teams channel.
              Use these functions carefully - they're intended for testing and starting fresh competitions.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ResetFunctions;
