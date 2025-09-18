import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Store recent console logs for error reporting
const consoleLogs: string[] = []
const MAX_CONSOLE_LOGS = 10

// Override console methods to capture logs
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
}

function captureLog(level: string, ...args: any[]) {
  const timestamp = new Date().toISOString()
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ')

  const logEntry = `[${timestamp}] ${level.toUpperCase()}: ${message}`
  consoleLogs.push(logEntry)

  // Keep only the most recent logs
  if (consoleLogs.length > MAX_CONSOLE_LOGS) {
    consoleLogs.shift()
  }

  // Only call original console method for errors and warnings - suppress logs and info for cleaner console
  if (level === 'error' || level === 'warn') {
    originalConsole[level as keyof typeof originalConsole](...args)
  }
}

// Override console methods
console.log = (...args) => captureLog('log', ...args)
console.error = (...args) => captureLog('error', ...args)
console.warn = (...args) => captureLog('warn', ...args)
console.info = (...args) => captureLog('info', ...args)

/**
 * Get recent console logs for error reporting
 */
export function getRecentConsoleLogs(): string[] {
  return [...consoleLogs]
}

/**
 * Clear console logs
 */
export function clearConsoleLogs(): void {
  consoleLogs.length = 0
}

/**
 * Copy text to clipboard and return success status
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (error) {
    console.warn('Failed to copy to clipboard:', error)
    // Fallback for older browsers
    try {
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      return true
    } catch (fallbackError) {
      console.error('Fallback copy also failed:', fallbackError)
      return false
    }
  }
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
  
  // If it's a local path, convert to Supabase Storage URL using env domain
  if (logoUrl.startsWith('/game-logos/')) {
    const fileName = logoUrl.substring('/game-logos/'.length);
    const base = (import.meta as any)?.env?.VITE_SUPABASE_URL || 'https://tnsgrwntmnzpaifmutqh.supabase.co';
    return `${base}/storage/v1/object/public/game-logos/${fileName}`;
  }
  
  // If it's a placeholder URL, return null to trigger fallback
  if (logoUrl.includes('via.placeholder.com') || logoUrl.includes('placeholder')) {
    return null;
  }
  
  // Return as-is for other URLs
  return logoUrl;
}

// Check if a logo URL is a placeholder that should be treated as null
export function isPlaceholderLogo(logoUrl: string | null): boolean {
  if (!logoUrl) return true;
  return logoUrl.includes('via.placeholder.com') || logoUrl.includes('placeholder');
}
