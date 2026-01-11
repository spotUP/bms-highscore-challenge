export interface ErrorDetails {
  message: string;
  consoleOutput?: string;
  timestamp: number;
}

export class ErrorLogger {
  private static errors: ErrorDetails[] = [];

  static logError(error: any, consoleOutput?: string) {
    const errorDetails: ErrorDetails = {
      message: error?.message || JSON.stringify(error),
      consoleOutput,
      timestamp: Date.now()
    };
    
    this.errors.push(errorDetails);
    console.error(error);
    
    return errorDetails;
  }

  static getRecentErrors() {
    // Get errors from last 5 minutes
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return this.errors.filter(e => e.timestamp > fiveMinutesAgo);
  }

  static clearErrors() {
    this.errors = [];
  }
}