import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface GameDatabaseFavorite {
  id: string;
  user_id: string;
  game_id: string;
  game_name: string;
  created_at: string;
}

interface Game {
  id: string;
  name: string;
  database_id: number | null;
}

export const useGameDatabaseFavorites = () => {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<GameDatabaseFavorite[]>([]);
  const [favoriteGameIds, setFavoriteGameIds] = useState<Set<string>>(new Set());
  const [favoriteGamesDetails, setFavoriteGamesDetails] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Load user's favorites from database
  const loadFavorites = useCallback(async () => {
    if (!user) {
      setFavorites([]);
      setFavoriteGameIds(new Set());
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_favorites')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading favorites:', error);
        return;
      }

      setFavorites(data || []);
      setFavoriteGameIds(new Set((data || []).map(f => f.game_id)));

      // Also load full game details for favorites
      if (data && data.length > 0) {
        const gameIds = data.map(f => f.game_id);
        const { data: gamesData, error: gamesError } = await supabase
          .from('games_database')
          .select(`
            id,
            name,
            platform_name,
            database_id,
            release_year,
            overview,
            max_players,
            cooperative,
            community_rating,
            community_rating_count,
            esrb_rating,
            genres,
            developer,
            publisher,
            video_url,
            screenshot_url,
            cover_url,
            logo_url
          `)
          .in('id', gameIds);

        if (!gamesError && gamesData) {
          setFavoriteGamesDetails(gamesData);
        }
      } else {
        setFavoriteGamesDetails([]);
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Add game to favorites
  const addToFavorites = useCallback(async (game: Game) => {
    if (!user) {
      return false;
    }

    if (favoriteGameIds.has(game.id)) {
      return false; // Already favorited
    }

    try {
      const favoriteData = {
        user_id: user.id,
        game_id: game.id,
        game_name: game.name,
      };

      const { data, error } = await supabase
        .from('user_favorites')
        .insert(favoriteData)
        .select()
        .single();

      if (error) {
        console.error('Error adding favorite:', error);
        return false;
      }

      setFavorites(prev => [data, ...prev]);
      setFavoriteGameIds(prev => new Set([...prev, game.id]));

      // Also load the full game details for this new favorite
      const { data: gameData, error: gameError } = await supabase
        .from('games_database')
        .select(`
          id,
          name,
          platform_name,
          database_id,
          release_year,
          overview,
          max_players,
          cooperative,
          community_rating,
          community_rating_count,
          esrb_rating,
          genres,
          developer,
          publisher,
          video_url,
          screenshot_url,
          cover_url,
          logo_url
        `)
        .eq('id', game.id)
        .single();

      if (!gameError && gameData) {
        setFavoriteGamesDetails(prev => [gameData, ...prev]);
      }

      return true;
    } catch (error) {
      console.error('Error adding favorite:', error);
      return false;
    }
  }, [user, favoriteGameIds]);

  // Remove game from favorites
  const removeFromFavorites = useCallback(async (gameId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('game_id', gameId);

      if (error) {
        console.error('Error removing favorite:', error);
        return false;
      }

      setFavorites(prev => prev.filter(f => f.game_id !== gameId));
      setFavoriteGameIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(gameId);
        return newSet;
      });
      setFavoriteGamesDetails(prev => prev.filter(g => g.id !== gameId));

      return true;
    } catch (error) {
      console.error('Error removing favorite:', error);
      return false;
    }
  }, [user]);

  // Toggle favorite status
  const toggleFavorite = useCallback(async (game: Game) => {
    if (favoriteGameIds.has(game.id)) {
      return await removeFromFavorites(game.id);
    } else {
      return await addToFavorites(game);
    }
  }, [favoriteGameIds, addToFavorites, removeFromFavorites]);

  // Check if game is favorited
  const isFavorited = useCallback((gameId: string) => {
    return favoriteGameIds.has(gameId);
  }, [favoriteGameIds]);

  // Migrate localStorage favorites to database (run once)
  const migrateLocalStorageFavorites = useCallback(async () => {
    if (!user) return;

    try {
      const savedFavorites = localStorage.getItem('retro-ranks-favorites');
      if (savedFavorites) {
        const favoritesArray = JSON.parse(savedFavorites) as string[];

        // Only migrate if user has no favorites in database yet
        if (favoritesArray.length > 0 && favorites.length === 0) {
          console.log('Migrating', favoritesArray.length, 'favorites from localStorage to database');

          // We'll need the game names from the database
          const { data: gamesData } = await supabase
            .from('games_database')
            .select('id, name')
            .in('id', favoritesArray);

          if (gamesData) {
            const migratedFavorites = gamesData.map(game => ({
              user_id: user.id,
              game_id: game.id,
              game_name: game.name,
            }));

            const { error } = await supabase
              .from('user_favorites')
              .insert(migratedFavorites);

            if (!error) {
              console.log('Successfully migrated favorites to database');
              // Clear localStorage after successful migration
              localStorage.removeItem('retro-ranks-favorites');
              // Reload favorites from database
              loadFavorites();
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to migrate localStorage favorites:', error);
    }
  }, [user, favorites.length, loadFavorites]);

  // Load favorites when user changes
  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  // Migrate localStorage favorites when component mounts and user is available
  useEffect(() => {
    if (user && !loading) {
      migrateLocalStorageFavorites();
    }
  }, [user, loading, migrateLocalStorageFavorites]);

  return {
    favorites,
    favoriteGameIds,
    favoriteGamesDetails,
    loading,
    loadFavorites,
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    isFavorited,
  };
};