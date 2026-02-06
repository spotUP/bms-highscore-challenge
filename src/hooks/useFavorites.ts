import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { RAWGGame } from '@/utils/rawgApi';

interface UserFavorite {
  id: string;
  user_id: string;
  game_id: number;
  game_name: string;
  game_description?: string;
  game_image_url?: string;
  game_platforms?: any;
  created_at: string;
  updated_at: string;
}

export const useFavorites = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [favorites, setFavorites] = useState<UserFavorite[]>([]);
  const [favoriteGameIds, setFavoriteGameIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  // Load user's favorites
  const loadFavorites = useCallback(async () => {
    if (!user) {
      setFavorites([]);
      setFavoriteGameIds(new Set());
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await api
        .from('user_favorites')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading favorites:', error);
        toast({
          title: 'Error',
          description: 'Failed to load favorites',
          variant: 'destructive'
        });
        return;
      }

      setFavorites(data || []);
      setFavoriteGameIds(new Set((data || []).map(f => f.game_id)));
    } catch (error) {
      console.error('Error loading favorites:', error);
      toast({
        title: 'Error',
        description: 'Failed to load favorites',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  // Add game to favorites
  const addToFavorites = useCallback(async (game: RAWGGame) => {
    if (!user) {
      toast({
        title: 'Login Required',
        description: 'Please log in to add favorites',
        variant: 'destructive'
      });
      return false;
    }

    if (favoriteGameIds.has(game.id)) {
      toast({
        title: 'Already Favorited',
        description: 'This game is already in your favorites',
      });
      return false;
    }

    try {
      const favoriteData = {
        user_id: user.id,
        game_id: game.id,
        game_name: game.name,
        game_description: game.description || game.description_raw || null,
        game_image_url: game.background_image || null,
        game_platforms: game.platforms || null,
      };

      const { data, error } = await api
        .from('user_favorites')
        .insert(favoriteData)
        .select()
        .single();

      if (error) {
        console.error('Error adding favorite:', error);
        toast({
          title: 'Error',
          description: 'Failed to add to favorites',
          variant: 'destructive'
        });
        return false;
      }

      setFavorites(prev => [data, ...prev]);
      setFavoriteGameIds(prev => new Set([...prev, game.id]));

      toast({
        title: 'Added to Favorites',
        description: `${game.name} added to your favorites`,
      });

      return true;
    } catch (error) {
      console.error('Error adding favorite:', error);
      toast({
        title: 'Error',
        description: 'Failed to add to favorites',
        variant: 'destructive'
      });
      return false;
    }
  }, [user, favoriteGameIds, toast]);

  // Remove game from favorites
  const removeFromFavorites = useCallback(async (gameId: number) => {
    if (!user) return false;

    try {
      const { error } = await api
        .from('user_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('game_id', gameId);

      if (error) {
        console.error('Error removing favorite:', error);
        toast({
          title: 'Error',
          description: 'Failed to remove from favorites',
          variant: 'destructive'
        });
        return false;
      }

      setFavorites(prev => prev.filter(f => f.game_id !== gameId));
      setFavoriteGameIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(gameId);
        return newSet;
      });

      toast({
        title: 'Removed from Favorites',
        description: 'Game removed from your favorites',
      });

      return true;
    } catch (error) {
      console.error('Error removing favorite:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove from favorites',
        variant: 'destructive'
      });
      return false;
    }
  }, [user, toast]);

  // Toggle favorite status
  const toggleFavorite = useCallback(async (game: RAWGGame) => {
    if (favoriteGameIds.has(game.id)) {
      return await removeFromFavorites(game.id);
    } else {
      return await addToFavorites(game);
    }
  }, [favoriteGameIds, addToFavorites, removeFromFavorites]);

  // Check if game is favorited
  const isFavorited = useCallback((gameId: number) => {
    return favoriteGameIds.has(gameId);
  }, [favoriteGameIds]);

  // Load favorites when user changes
  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  return {
    favorites,
    favoriteGameIds,
    loading,
    loadFavorites,
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    isFavorited,
  };
};