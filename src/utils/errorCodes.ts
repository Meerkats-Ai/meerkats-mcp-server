// Error codes for the application
export enum ErrorCode {
  // Web scraping related errors
  WEB_INVALID_URL = 'WEB_INVALID_URL',
  WEB_MISSING_CREDENTIALS = 'WEB_MISSING_CREDENTIALS',
  WEB_SCRAPING_FAILED = 'WEB_SCRAPING_FAILED',
  WEB_TIMEOUT_ERROR = 'WEB_TIMEOUT_ERROR',
  WEB_INVALID_RESPONSE = 'WEB_INVALID_RESPONSE',
  
  // Google SERP and Maps related errors
  SERP_INVALID_QUERY = 'SERP_INVALID_QUERY',
  SERP_SEARCH_FAILED = 'SERP_SEARCH_FAILED',
  SERP_MAP_SEARCH_FAILED = 'SERP_MAP_SEARCH_FAILED',
  SERP_DATABASE_ERROR = 'SERP_DATABASE_ERROR',
  
  // Configuration errors
  INVALID_CONFIG = 'INVALID_CONFIG',
  
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
