// Controller for managing system connections and credentials

// Mock implementation for system connections
// In a real application, this would likely connect to a database or config service
const systemConnections: Record<string, string> = {
  // SCRAPPER_CALLBACK_API_URL: process.env.SCRAPPER_CALLBACK_API_URL || 'https://prod-api-126608443486.us-central1.run.app',
  SCRAPPER_CALLBACK_API_URL: 'https://crawlee-scrapper-126608443486.us-central1.run.app',
  // SCRAPPER_API_URL: process.env.SCRAPPER_API_URL || 'https://prod-scrapper-126608443486.us-central1.run.app',
  SCRAPPER_API_URL: 'https://crawlee-scrapper-126608443486.us-central1.run.app',
  MEERKATS_API_KEY: process.env.MEERKATS_API_KEY || ''
};

// Get system connection values by keys
export const getSystemConnection = async (keys: string[]): Promise<Record<string, string>> => {
  const result: Record<string, string> = {};
  
  for (const key of keys) {
    result[key] = systemConnections[key] || '';
  }
  
  return result;
};

// Get connection by name, optionally for a specific user
export const getConnectionByName = async (name: string, userId?: string): Promise<string> => {
  // In a real application, this might look up user-specific connection settings
  // For now, we'll just return the system connection
  return systemConnections[name] || '';
};
