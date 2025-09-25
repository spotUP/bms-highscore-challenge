// Clear Logo service using Cloudflare R2 storage
// This service provides Clear Logo images from Cloudflare R2
// with 10GB free tier and global CDN delivery

export interface ClearLogoData {
  id: number;
  launchbox_database_id: number;
  game_name: string;
  platform_name: string;
  source_url: string;
  logo_base64: string;
  region?: string;
  created_at: string;
}

class ClearLogoService {
  /**
   * Get Clear Logos for multiple games by name from Cloudflare R2
   */
  async getClearLogosForGames(gameNames: string[]): Promise<Record<string, string>> {
    if (gameNames.length === 0) {
      return {};
    }

    console.log(`🔍 Searching Cloudflare R2 for Clear Logos: ${gameNames.join(', ')}`);

    try {
      // Check if R2 credentials are configured
      if (!this.isR2Configured()) {
        console.log(`⚠️ Cloudflare R2 credentials not configured`);
        console.log(`💡 To enable Clear Logos:`);
        console.log(`   1. Create Cloudflare R2 bucket`);
        console.log(`   2. Upload Clear Logo files`);
        console.log(`   3. Set R2 environment variables`);
        return {};
      }

      // TODO: Implement R2 file fetching
      const logoMap: Record<string, string> = {};

      for (const gameName of gameNames) {
        try {
          // Generate R2 URL for this game's logo
          const logoUrl = this.getR2LogoUrl(gameName);

          // Fetch the logo from R2
          const response = await fetch(logoUrl);
          if (response.ok) {
            const blob = await response.blob();
            const base64 = await this.blobToBase64(blob);
            const dataUrl = `data:image/webp;base64,${base64}`;

            logoMap[gameName] = dataUrl;
            console.log(`✅ Found Clear Logo for: ${gameName}`);
          } else {
            console.log(`❌ No Clear Logo found for: ${gameName} (${response.status})`);
          }
        } catch (error) {
          console.warn(`❌ Error fetching logo for ${gameName}:`, error);
        }
      }

      console.log(`🎯 Found ${Object.keys(logoMap).length} Clear Logos out of ${gameNames.length} requested`);
      return logoMap;

    } catch (error) {
      console.error('❌ Error fetching Clear Logos from Cloudflare R2:', error);
      return {};
    }
  }

  private isR2Configured(): boolean {
    // Check if R2 environment variables are set
    const r2Domain = import.meta.env.VITE_CLOUDFLARE_R2_DOMAIN;
    return !!r2Domain;
  }

  private getR2LogoUrl(gameName: string): string {
    // Convert game name to safe filename
    const safeFileName = gameName
      .replace(/[^a-zA-Z0-9\-_\s]/g, '') // Remove special chars
      .replace(/\s+/g, '-') // Replace spaces with dashes
      .toLowerCase();

    // Use environment-appropriate proxy URL
    const isProduction = import.meta.env.PROD;
    const isDevelopment = import.meta.env.DEV;

    if (isDevelopment) {
      // Local development: use Express proxy server
      return `http://localhost:3001/clear-logos/${safeFileName}.webp`;
    } else {
      // Production: use Vercel API route (will be deployed domain)
      return `/api/clear-logos/${safeFileName}.webp`;
    }
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix to get just base64
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Placeholder methods for future implementation

  /**
   * Search Clear Logos by game name pattern
   */
  async searchClearLogos(searchTerm: string, limit: number = 20): Promise<ClearLogoData[]> {
    console.log(`🔍 Search request for: "${searchTerm}" (limit: ${limit})`);
    console.log(`📋 Search functionality not yet implemented`);
    return [];
  }

  /**
   * Get Clear Logo by LaunchBox database ID
   */
  async getClearLogoById(launchboxId: number): Promise<ClearLogoData | null> {
    console.log(`🎯 Logo request for LaunchBox ID: ${launchboxId}`);
    console.log(`📋 ID lookup functionality not yet implemented`);
    return null;
  }

  /**
   * Get statistics about Clear Logos
   */
  async getStats(): Promise<{ total: number; byPlatform: Array<{ platform: string; count: number }> } | null> {
    console.log(`📊 Stats request for Clear Logo database`);
    console.log(`📋 Stats functionality not yet implemented`);
    return null;
  }

  /**
   * Clean up - currently no resources to clean
   */
  close(): void {
    console.log(`🧹 Clear Logo service cleanup requested`);
    // No resources to clean up currently
  }
}

export const clearLogoService = new ClearLogoService();