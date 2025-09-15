import { useCallback, useEffect } from 'react';
import * as React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAchievement } from '@/contexts/AchievementContext';
import { useTournament } from '@/contexts/TournamentContext';

interface Achievement {
  id: string;
  name: string;
  description: string;
  badge_icon: string;
  badge_color: string;
  points: number;
}

export const useAchievements = () => {
  const { showAchievementNotification } = useAchievement();
  const { currentTournament } = useTournament();

  // Deduplication of notifications (session-scoped)
  // Use a Map to track both the achievement ID and the timestamp it was shown
  const notifiedAchievements = (globalThis as any).__ach_notifiedAchievements || new Map<string, number>();
  (globalThis as any).__ach_notifiedAchievements = notifiedAchievements;
  
  // Clear old entries to prevent memory leaks (older than 1 hour)
  const now = Date.now();
  for (const [key, timestamp] of notifiedAchievements.entries()) {
    if (now - timestamp > 60 * 60 * 1000) { // 1 hour
      notifiedAchievements.delete(key);
    }
  }

  // Realtime subscription (persist for session)
  let rtInit = (globalThis as any).__ach_rtInit || false;
  let rtChannel = (globalThis as any).__ach_rtChannel || null;
  let rtBackfillDone = (globalThis as any).__ach_rtBackfillDone || false;
  (globalThis as any).__ach_rtInit = rtInit;
  (globalThis as any).__ach_rtChannel = rtChannel;
  (globalThis as any).__ach_rtBackfillDone = rtBackfillDone;

  const showToastIfNew = useCallback((achievement: any, scoreId?: string) => {
    const achievementId = achievement.achievement_id || achievement.id;
    const key = `${achievementId}_${currentTournament?.id || 'notournament'}`;
    
    // Skip if we've shown this achievement in the last minute
    const lastShown = notifiedAchievements.get(key) || 0;
    if (Date.now() - lastShown < 60000) { // 1 minute cooldown
      console.log(`⏭️ Skipping duplicate achievement: ${achievement.name} (shown recently)`);
      return;
    }
    
    // Update the timestamp for this achievement
    notifiedAchievements.set(key, Date.now());
    
    // Show the notification
    showAchievementNotification({
      id: achievementId,
      name: achievement.achievement_name || achievement.name,
      description: achievement.achievement_description || achievement.description,
      badge_icon: achievement.badge_icon,
      badge_color: achievement.badge_color,
      points: achievement.points,
    });
  }, [showAchievementNotification, currentTournament?.id]);

  const checkForDuplicateAchievements = useCallback(async (playerName: string, tournamentId: string) => {
    try {
      const { data, error } = await supabase
        .from('player_achievements')
        .select('player_name, achievement_id, tournament_id, created_at')
        .eq('player_name', playerName.toUpperCase())
        .eq('tournament_id', tournamentId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error checking for duplicate achievements:', error);
        return;
      }

      // Group by achievement_id and count occurrences
      const achievementCounts = new Map();
      data?.forEach(entry => {
        const key = `${entry.achievement_id}`;
        achievementCounts.set(key, (achievementCounts.get(key) || 0) + 1);
      });

      // Find duplicates
      const duplicates = [];
      for (const [achievementId, count] of achievementCounts.entries()) {
        if (count > 1) {
          duplicates.push({ 
            achievementId, 
            count,
            // Get the first and last timestamps for this achievement
            firstAwarded: data?.find(d => d.achievement_id === achievementId)?.created_at,
            lastAwarded: data?.slice().reverse().find(d => d.achievement_id === achievementId)?.created_at
          });
        }
      }

      if (duplicates.length > 0) {
        console.warn('⚠️ Found duplicate achievements in database:', duplicates);
        console.log('Full achievement data for player:', data);
      } else {
        console.log('✅ No duplicate achievements found in database');
      }
      
      return { hasDuplicates: duplicates.length > 0, duplicates, allAchievements: data };
    } catch (e) {
      console.error('Error in checkForDuplicateAchievements:', e);
      return { hasDuplicates: false, error: e };
    }
  }, [supabase]);

  const cleanupDuplicateAchievements = useCallback(async (playerName: string, tournamentId: string) => {
    try {
      console.log('🧹 Starting cleanup of duplicate achievements for', playerName);
      const { hasDuplicates, duplicates, allAchievements } = await checkForDuplicateAchievements(playerName, tournamentId) || {};
      
      if (!hasDuplicates || !duplicates?.length || !allAchievements?.length) {
        console.log('No duplicates to clean up');
        return;
      }

      // For each duplicate, keep only the first one
      const seen = new Set();
      const achievementsToKeep = [];
      const achievementsToDelete = [];

      // Process in reverse order to keep the earliest one
      for (const achievement of [...allAchievements].reverse()) {
        const key = `${achievement.achievement_id}`;
        if (seen.has(key)) {
          achievementsToDelete.push(achievement);
        } else {
          seen.add(key);
          achievementsToKeep.push(achievement);
        }
      }

      console.log(`Found ${achievementsToDelete.length} duplicate achievements to remove`);
      
      if (achievementsToDelete.length > 0) {
        // Delete duplicates (you might want to back these up first)
        const { error } = await supabase
          .from('player_achievements')
          .delete()
          .in('id', achievementsToDelete.map(a => a.id));
          
        if (error) {
          console.error('Error deleting duplicate achievements:', error);
        } else {
          console.log(`✅ Successfully removed ${achievementsToDelete.length} duplicate achievements`);
        }
      }
      
      return { deleted: achievementsToDelete.length, kept: achievementsToKeep.length };
    } catch (e) {
      console.error('Error in cleanupDuplicateAchievements:', e);
      return { error: e };
    }
  }, [checkForDuplicateAchievements]);

  const ensureRealtimeSubscription = useCallback(async (playerName: string) => {
    try {
      if (!currentTournament?.id) return;
      
      // Clean up any existing subscription
      if ((globalThis as any).__ach_rtChannel) {
        await (globalThis as any).__ach_rtChannel.unsubscribe();
        (globalThis as any).__ach_rtChannel = null;
      }

      // Reset backfill when player changes
      if ((globalThis as any).__lastPlayerName !== playerName) {
        (globalThis as any).__ach_rtBackfillDone = false;
        (globalThis as any).__lastPlayerName = playerName;
      }

      // Try to get current user (ignore errors)
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id ?? null;

      const chan = supabase
        .channel(`player_achievements_${currentTournament.id}_${playerName}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'player_achievements',
          filter: `tournament_id=eq.${currentTournament.id}`
        }, async (payload: any) => {
          const row = payload?.new;
          if (!row) return;

          // Filter for this viewer
          if (userId) {
            if (row.user_id !== userId) return;
          } else {
            if ((row.player_name || '').toUpperCase() !== playerName.toUpperCase()) return;
          }

          // Mark as backfilled to prevent duplicate polling
          (globalThis as any).__ach_rtBackfillDone = true;

          // Fetch achievement details
          const { data: a, error } = await supabase
            .from('achievements')
            .select('id, name, description, badge_icon, badge_color, points, created_by')
            .eq('id', row.achievement_id)
            .maybeSingle();
          if (error || !a) return;

          const ach: any = a as any;

          // Only show achievements created by this user when authenticated
          if (userId && ach?.created_by && ach.created_by !== userId) {
            return;
          }

          showToastIfNew({ ...(ach || {}), achievement_id: ach?.id }, row.score_id);
        })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime subscription active for achievements');
          }
        });

      (globalThis as any).__ach_rtChannel = chan;
      (globalThis as any).__ach_rtInit = true;
    } catch (e) {
      console.log('⚠️ Realtime subscription setup failed:', e);
    }
  }, [currentTournament, showToastIfNew]);

  // Track last achievement check to prevent duplicates
  const lastCheckRef = React.useRef<{playerName: string; timestamp: number}>({playerName: '', timestamp: 0});
  const CHECK_DEBOUNCE_MS = 2000; // 2 second debounce window

  const checkForNewAchievements = useCallback(async (playerName: string) => {
    // Debug: Check and clean duplicate achievements in the database
    if (currentTournament?.id) {
      console.log('🔍 Checking for duplicate achievements...');
      const result = await checkForDuplicateAchievements(playerName, currentTournament.id);
      if (result?.hasDuplicates) {
        console.log('🧹 Found duplicates, cleaning up...');
        await cleanupDuplicateAchievements(playerName, currentTournament.id);
      }
    }
    try {
      const now = Date.now();
      
      // Skip if we've checked for this player very recently
      if (
        lastCheckRef.current && 
        lastCheckRef.current.playerName === playerName && 
        (now - lastCheckRef.current.timestamp) < CHECK_DEBOUNCE_MS
      ) {
        console.log('⏭️ Skipping duplicate achievement check for', playerName);
        return;
      }

      lastCheckRef.current = { playerName, timestamp: now };
      console.log('🎯 Achievement system called for:', playerName, 'tournament:', currentTournament?.id);
      
      // Only check achievements if we have a current tournament
      if (!currentTournament) {
        console.log('⚠️ No current tournament - skipping achievements');
        return;
      }
      
      // Small delay to ensure DB triggers/commit have finalized before querying
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Require authenticated user for user-scoped achievements
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.log('⚠️ Could not get auth user for achievements (will use anonymous path):', userError.message);
      }

      const userId = userData?.user?.id;
      // Ensure realtime subscription (once per session)
      await ensureRealtimeSubscription(playerName);

      // If realtime is active and we haven't backfilled this session, do a one-time poll, then skip further polling.
      const rtActive = !!(globalThis as any).__ach_rtInit && !!(globalThis as any).__ach_rtChannel;
      const doBackfill = rtActive && !(globalThis as any).__ach_rtBackfillDone;
      if (!userId) {
        console.log('👤 Not logged in - using tournament/player_name achievements RPC');
        try {
          if (rtActive && !doBackfill) {
            console.log('📡 Realtime active - skipping anonymous polling');
            return;
          }
          let attempts = 0;
          let newAchievements: any[] | null = null;
          let lastError: any = null;
          while (attempts < 5 && (!Array.isArray(newAchievements) || newAchievements.length === 0)) {
            const { data, error } = await (supabase as any).rpc('get_recent_achievements_by_tournament', {
              p_tournament_id: currentTournament.id,
              p_player_name: playerName.toUpperCase(),
              p_since_minutes: 10
            });
            if (error) {
              lastError = error;
              console.log('⚠️ Anonymous achievement RPC error (attempt', attempts + 1, '):', error.message);
              await new Promise((r) => setTimeout(r, 600));
            } else {
              newAchievements = data as any[];
              if (!newAchievements || newAchievements.length === 0) {
                await new Promise((r) => setTimeout(r, 600));
              }
            }
            attempts++;
          }

          if (lastError) {
            console.log('⚠️ Anonymous achievement RPC final error:', lastError.message);
          }

          if (Array.isArray(newAchievements) && newAchievements.length > 0) {
            // Filter out achievements that were already shown recently
            const uniqueNewAchievements = newAchievements.filter(achievement => {
              const achievementId = achievement.achievement_id || achievement.id;
              const key = `${achievementId}_${currentTournament?.id || 'notournament'}`;
              const lastShown = notifiedAchievements.get(key) || 0;
              return (Date.now() - lastShown) >= 60000; // 1 minute cooldown
            });
            
            if (uniqueNewAchievements.length > 0) {
              console.log(`🏆 Found ${uniqueNewAchievements.length} new achievements for ${playerName} (after deduplication)`);
              uniqueNewAchievements.forEach((achievement: any, index: number) => {
                setTimeout(() => {
                  showToastIfNew(achievement);
                }, index * 1000);
              });
              sendMultipleAchievementsWebhook(playerName, uniqueNewAchievements);
            } else {
              console.log('ℹ️ All achievements were shown recently, skipping display');
            }
          } else {
            console.log('📭 No new achievements found for anonymous player', playerName, 'in tournament', currentTournament.id);
          }

          if (doBackfill) {
            (globalThis as any).__ach_rtBackfillDone = true;
          }
        } catch (error) {
          console.log('⚠️ Anonymous achievement system not available - ensure migrations are applied');
          console.log('🔧 Error details:', error);
        }
        return;
      }

      // Query recent achievements for this user within the current tournament
      try {
        if (rtActive && !doBackfill) {
          console.log('📡 Realtime active - skipping user-scoped polling');
          return;
        }
        let attempts = 0;
        let newAchievements: any[] | null = null;
        let lastError: any = null;
        while (attempts < 5 && (!Array.isArray(newAchievements) || newAchievements.length === 0)) {
          const { data, error } = await (supabase as any).rpc('get_recent_achievements_for_user', {
            p_user_id: userId,
            p_tournament_id: currentTournament.id,
            p_since_minutes: 10
          });
          if (error) {
            lastError = error;
            console.log('⚠️ User achievement RPC error (attempt', attempts + 1, '):', error.message);
            await new Promise((r) => setTimeout(r, 600));
          } else {
            newAchievements = data as any[];
            if (!newAchievements || newAchievements.length === 0) {
              await new Promise((r) => setTimeout(r, 600));
            }
          }
          attempts++;
        }

        if (lastError) {
          console.log('⚠️ User achievement RPC final error:', lastError.message);
        }

        // Show notification and send webhook for each new achievement
        if (Array.isArray(newAchievements) && newAchievements.length > 0) {
          console.log(`🏆 Found ${newAchievements.length} new achievements for ${playerName}`);
          
          // If RPC doesn't include created_by, we trust it is already scoped for this user.
          // Otherwise, filter by created_by === userId if present.
          const filtered = newAchievements.filter((ach: any) =>
            !('created_by' in ach) || !userId || ach.created_by === userId
          );

          // Show individual notifications with delays
          filtered.forEach((achievement: any, index: number) => {
            setTimeout(() => {
              showToastIfNew(achievement);
            }, index * 1000);
          });
          
          // Send single webhook with all achievements
          sendMultipleAchievementsWebhook(playerName, newAchievements as any[]);
        } else {
          console.log('📭 No new achievements found for user', userId, 'in tournament', currentTournament.id);
        }

        if (doBackfill) {
          (globalThis as any).__ach_rtBackfillDone = true;
        }
      } catch (error) {
        console.log('⚠️ User-scoped achievement system not available - ensure migrations are applied');
        console.log('🔧 Error details:', error);
      }
    } catch (error) {
      console.error('Error in checkForNewAchievements:', error);
    }
  }, [showAchievementNotification, currentTournament, checkForDuplicateAchievements, cleanupDuplicateAchievements, ensureRealtimeSubscription]);

  const sendMultipleAchievementsWebhook = useCallback(async (
    playerName: string, 
    achievements: any[]
  ) => {
    try {
      console.log('🚀 Sending achievement webhook for', achievements.length, 'achievements:', {
        player_name: playerName,
        achievements: achievements.map(a => a.achievement_name)
      });

      // Get the most recent score for this player to provide context
      const { data: recentScore } = await supabase
        .from('scores')
        .select(`
          score,
          game_id,
          games (name)
        `)
        .eq('player_name', playerName.toUpperCase())
        .eq('tournament_id', currentTournament?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const webhookResponse = await supabase.functions.invoke('achievement-webhook-simple', {
        body: {
          player_name: playerName,
          achievements: achievements.map(achievement => ({
            name: achievement.achievement_name,
            description: achievement.achievement_description,
            points: achievement.points
          })),
          game_name: recentScore?.games?.name,
          score: recentScore?.score
        }
      });

      if (webhookResponse.error) {
        console.error('❌ Achievement webhook error:', webhookResponse.error);
      } else {
        console.log('✅ Achievement webhook sent successfully:', webhookResponse.data);
      }
    } catch (error) {
      console.error('❌ Achievement webhook call failed:', error);
    }
  }, [supabase, currentTournament]);

  const sendAchievementWebhook = useCallback(async (
    playerName: string, 
    achievement: Achievement, 
    playerAchievement: any
  ) => {
    try {
      console.log('🚀 Sending achievement webhook:', {
        player_name: playerName,
        achievement: achievement.name,
        points: achievement.points
      });

      // Get the most recent score for this player to provide context
      const { data: recentScore } = await supabase
        .from('scores')
        .select(`
          score,
          game_id,
          games (name)
        `)
        .eq('player_name', playerName.toUpperCase())
        .eq('tournament_id', currentTournament?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const webhookResponse = await supabase.functions.invoke('achievement-webhook-simple', {
        body: {
          player_name: playerName,
          achievements: [{
            name: achievement.name,
            description: achievement.description,
            points: achievement.points
          }],
          game_name: recentScore?.games?.name,
          score: recentScore?.score
        }
      });

      if (webhookResponse.error) {
        console.error('❌ Achievement webhook error:', webhookResponse.error);
      } else {
        console.log('✅ Achievement webhook sent successfully:', webhookResponse.data);
      }
    } catch (error) {
      console.error('❌ Achievement webhook call failed:', error);
    }
  }, [supabase, currentTournament]);


  // Clean up realtime subscription when component unmounts
  useEffect(() => {
    return () => {
      if ((globalThis as any).__ach_rtChannel) {
        (globalThis as any).__ach_rtChannel.unsubscribe();
        (globalThis as any).__ach_rtChannel = null;
        (globalThis as any).__ach_rtInit = false;
      }
    };
  }, []);

  return {
    checkForNewAchievements,
    sendMultipleAchievementsWebhook,
    checkForDuplicateAchievements,
    cleanupDuplicateAchievements
  };
};
