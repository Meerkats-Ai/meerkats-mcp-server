import { ErrorCode, formatError } from '../utils/errorCodes.js';
import logger from '../utils/logger.js';
import { scrapeUrl } from '../scraper/scraper.js';
import { LgResult } from '../interface.js';

// Interface for scrape request
interface ScrapeRequest {
    url: string;
    pageOptions?: {
        scrollToBottom?: boolean;
        waitForMs?: number;
        timeout?: number;
        isSearch?: boolean;
        pages?: number;
        [key: string]: any;
    };
    callback?: {
        userId: string;
        tableId: string;
        batchId: string;
        cellId: string;
        rowId: string;
    };
    instant?: boolean;
}

// Interface for scrape result
interface ScrapeResult {
    status: boolean;
    error?: string;
    serpData?: any;
}

/**
 * Get Google SERP data for search query with page limit
 */
export const GoogleSerp = async (args: any) => {
    try {
        const { query, limit } = args;
        
        if (!query) {
            return { 
                status: false, 
                error: formatError(ErrorCode.INVALID_PARAMETERS, 'Search query is required').error 
            };
        }

        const baseUrl = `https://www.google.com/search?hl=en&q=`;
        const encodedQuery = encodeURIComponent(query);
        const url = `${baseUrl}${encodedQuery}`;
        logger.info(url);

        let pages = 0;
        if (limit > 10) {
            pages = limit ? Math.ceil(limit / 10) : 10;
        }

        const payload: ScrapeRequest = {
            url,
            pageOptions: {
                isSearch: true,
                pages
            },
            instant: false
        };

        const data: ScrapeResult = await scrapeUrl(payload);
        
        if (data && data.status === true && data.serpData) {
            return data;
        }
        
        return { 
            status: false, 
            error: formatError(ErrorCode.WEB_SCRAPING_FAILED, 'Failed to get search results').error 
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Search failed';
        logger.error(`Google SERP error: ${errorMessage}`);
        return { status: false, error: errorMessage };
    }
};

/**
 * Get Google Map data from query, optionally at a specific location
 */
export const GoogleMap = async (args: any) => {
    try {
        const { query, location, limit } = args;
        
        if (!query) {
            return { 
                status: false, 
                error: formatError(ErrorCode.INVALID_PARAMETERS, 'Search query is required').error 
            };
        }

        const baseUrl = `https://www.google.com/maps/search/`;
        const encodedQuery = encodeURIComponent(query);
        let url = '';
        let pageOptions = {};

        // If location is provided, check if it's valid lat,lng coordinates
        if (location) {
            const latLng = location.split(',');
            
            // Check if it looks like lat,lng format (two parts separated by comma)
            if (latLng.length === 2) {
                const [lat, lng] = latLng;
                
                // Check if both parts are valid numbers
                if (!isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
                    // Check if coordinates are in valid ranges
                    const latNum = parseFloat(lat);
                    const lngNum = parseFloat(lng);
                    
                    if (latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180) {
                        // Valid lat,lng coordinates - use them for specific location search
                        const cleanLocation = location.replace(/ /g, '');
                        url = `${baseUrl}${encodedQuery}/@${cleanLocation},14z/data=!3m1!4b1?hl=en`;
                        
                        pageOptions = {
                            scrollToBottom: true,
                            waitForMs: 10000,
                            timeout: 3 * 60 * 1000
                        };
                        
                        logger.info(`Using coordinates search with: ${cleanLocation}`);
                    } else {
                        // Coordinates out of valid range - treat as part of query
                        const enhancedQuery = `${query} ${location}`;
                        const encodedEnhancedQuery = encodeURIComponent(enhancedQuery);
                        url = `${baseUrl}${encodedEnhancedQuery}?hl=en`;
                        
                        logger.info(`Treating location as part of query due to invalid coordinate ranges: ${enhancedQuery}`);
                    }
                } else {
                    // Not valid numbers - treat as part of query
                    const enhancedQuery = `${query} ${location}`;
                    const encodedEnhancedQuery = encodeURIComponent(enhancedQuery);
                    url = `${baseUrl}${encodedEnhancedQuery}?hl=en`;
                    
                    logger.info(`Treating location as part of query (not numeric): ${enhancedQuery}`);
                }
            } else {
                // Not in lat,lng format - treat as part of query
                const enhancedQuery = `${query} ${location}`;
                const encodedEnhancedQuery = encodeURIComponent(enhancedQuery);
                url = `${baseUrl}${encodedEnhancedQuery}?hl=en`;
                
                logger.info(`Treating location as part of query (wrong format): ${enhancedQuery}`);
            }
            
            // Set page options for regular search if not already set for coordinates search
            if (!url.includes('@')) {
                let pages = 0;
                if (limit > 10) {
                    pages = limit ? Math.ceil(limit / 10) : 10;
                }
                
                pageOptions = {
                    isSearch: true,
                    pages
                };
            }
        } else {
            // Regular map search without specific location
            url = `${baseUrl}${encodedQuery}?hl=en`;
            
            let pages = 0;
            if (limit > 10) {
                pages = limit ? Math.ceil(limit / 10) : 10;
            }
            
            pageOptions = {
                isSearch: true,
                pages
            };
        }

        logger.info(url);

        const payload: ScrapeRequest = {
            url,
            pageOptions,
            instant: false
        };

        const data: ScrapeResult = await scrapeUrl(payload);
        
        if (data && data.status === true && data.serpData) {
            return { 
                status: true, 
                result: data.serpData,
                serpData: data.serpData
            };
        } else if (data && data.status === false) {
            return { status: false, error: data.error };
        }
        
        return { 
            status: false, 
            error: formatError(ErrorCode.WEB_SCRAPING_FAILED, 'Failed to get map search results').error 
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Map search failed';
        logger.error(`Google Map error: ${errorMessage}`);
        return { status: false, error: errorMessage };
    }
};

export default {
    GoogleSerp,
    GoogleMap
};
