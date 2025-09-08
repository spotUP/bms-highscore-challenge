import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format numbers with periods as thousands separators
export function formatScore(score: number): string {
  return score.toLocaleString('de-DE'); // German locale uses periods for thousands separators
}
