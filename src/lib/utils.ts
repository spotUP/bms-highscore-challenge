import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format numbers with periods as thousands separators
export function formatScore(score: number): string {
  return score.toLocaleString('de-DE'); // German locale uses periods for thousands separators
}

// Convert local game logo paths to Supabase Storage URLs
export function getGameLogoUrl(logoUrl: string | null): string | null {
  if (!logoUrl) return null;
  
  // If it's already a Supabase Storage URL, return as-is
  if (logoUrl.includes('supabase.co/storage/')) {
    return logoUrl;
  }
  
  // If it's a local path, convert to Supabase Storage URL
  if (logoUrl.startsWith('/game-logos/')) {
    const fileName = logoUrl.substring('/game-logos/'.length);
    return `https://tnsgrwntmnzpaifmutqh.supabase.co/storage/v1/object/public/game-logos/${fileName}`;
  }
  
  // Return as-is for other URLs
  return logoUrl;
}
