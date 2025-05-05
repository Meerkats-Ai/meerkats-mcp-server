import { ErrorCode } from './errorCodes.js';
import logger from './logger.js';

// Interface for structured error logging
export interface ScraperError {
  code: ErrorCode;
  message: string;
  stack?: string;
  batchId?: string;
}

// Log errors in a structured way
export const logError = (error: ScraperError) => {
  logger.error(`Error [${error.code}]: ${error.message}`);
  
  if (error.stack) {
    logger.error(`Stack: ${error.stack}`);
  }
  
  if (error.batchId) {
    logger.error(`Batch ID: ${error.batchId}`);
  }
  
  // Here you could add additional error logging logic
  // such as sending errors to a monitoring service
};
