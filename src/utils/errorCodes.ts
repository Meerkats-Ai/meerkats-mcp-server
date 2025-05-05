// Error codes for the application
export enum ErrorCode {
  // Web scraping related errors
  WEB_INVALID_URL = 'WEB_INVALID_URL',
  WEB_MISSING_CREDENTIALS = 'WEB_MISSING_CREDENTIALS',
  WEB_SCRAPING_FAILED = 'WEB_SCRAPING_FAILED',
  WEB_TIMEOUT_ERROR = 'WEB_TIMEOUT_ERROR',
  WEB_INVALID_RESPONSE = 'WEB_INVALID_RESPONSE',
  
  // General errors
  GENERAL_ERROR = 'GENERAL_ERROR',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS'
}

// Format error for consistent error responses
export const formatError = (code: ErrorCode, message: string) => {
  return {
    error: `${code}: ${message}`
  };
};
