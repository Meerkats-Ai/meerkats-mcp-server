import { ErrorCode, formatError } from '../utils/errorCodes.js';
import logger from '../utils/logger.js';
import { scrapeUrl } from '../scraper/scraper.js';
import { LgResult } from '../interface.js';
import axios from 'axios';
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
                places: data.serpData,
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

/**
 * Get Google Maps Places API data for a location
 * Uses the official Google Maps Places API instead of web scraping
 */
export const GoogleMapPlaces = async (args: any) => {
    try {
        const { query, location, radius = 10000, maxResults = 60, googleApiKey } = args;
        
        if (!query) {
            return { 
                status: false, 
                error: formatError(ErrorCode.INVALID_PARAMETERS, 'Search query is required').error 
            };
        }
        let url = '';
        let params: any = {
            key: googleApiKey,
            query: query,
            radius: radius
        };

        // If location is provided, check if it's valid lat,lng coordinates or a zipcode
        if (location) {
            // Check if it's a zipcode (simple check for numeric-only string)
            if (/^\d+$/.test(location)) {
                // It's a zipcode, use geocoding API to convert to coordinates
                logger.info(`Converting zipcode ${location} to coordinates`);
                try {
                    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json`;
                    const geocodeResponse = await axios.get(geocodeUrl, {
                        params: {
                            address: location,
                            key: googleApiKey
                        }
                    });

                    if (geocodeResponse.data.status === 'OK' && geocodeResponse.data.results.length > 0) {
                        const { lat, lng } = geocodeResponse.data.results[0].geometry.location;
                        params.location = `${lat},${lng}`;
                        logger.info(`Converted zipcode to coordinates: ${params.location}`);
                    } else {
                        logger.warn(`Failed to convert zipcode to coordinates: ${geocodeResponse.data.status}`);
                        // Continue with just the query parameter
                    }
                } catch (error) {
                    logger.error(`Error converting zipcode to coordinates: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    // Continue with just the query parameter
                }
            } else {
                // Check if it looks like lat,lng format
                const latLng = location.split(',');
                if (latLng.length === 2) {
                    const [lat, lng] = latLng;
                    
                    // Check if both parts are valid numbers
                    if (!isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
                        // Check if coordinates are in valid ranges
                        const latNum = parseFloat(lat);
                        const lngNum = parseFloat(lng);
                        
                        if (latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180) {
                            // Valid lat,lng coordinates
                            params.location = location.replace(/ /g, '');
                            logger.info(`Using coordinates: ${params.location}`);
                        } else {
                            logger.warn(`Coordinates out of valid range: ${location}`);
                            // Continue with just the query parameter
                        }
                    } else {
                        logger.warn(`Invalid coordinate format (not numeric): ${location}`);
                        // Continue with just the query parameter
                    }
                } else {
                    logger.warn(`Invalid coordinate format (wrong format): ${location}`);
                    // Continue with just the query parameter
                }
            }
        }

        // Use the Places API to search for places
        url = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
        logger.info(`Making request to Google Places API: ${url}`);
        logger.info(`Params: ${JSON.stringify(params)}`);

        // Make the initial request
        const response = await axios.get(url, { params });
        
        if (response.status !== 200) {
            return { 
                status: false, 
                error: formatError(ErrorCode.API_REQUEST_FAILED, 'Failed to get places from Google Maps API').error 
            };
        }
        
        // Initialize results array with the first page of results
        let allResults = [...response.data.results];
        let nextPageToken = response.data.next_page_token;
        let pageCount = 1;
        
        // Google Places API can return up to 3 pages (60 results total)
        // Each request with a page token needs a short delay (at least 2 seconds)
        while (nextPageToken && allResults.length < maxResults && pageCount < 10) {
            logger.info(`Fetching next page of results with token: ${nextPageToken}`);
            
            // The next_page_token isn't immediately usable - need to wait for it to become valid
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            try {
                const nextPageResponse = await axios.get(url, { 
                    params: { 
                        key: googleApiKey,
                        pagetoken: nextPageToken
                    } 
                });
                
                if (nextPageResponse.status === 200) {
                    allResults = [...allResults, ...nextPageResponse.data.results];
                    nextPageToken = nextPageResponse.data.next_page_token;
                    pageCount++;
                    
                    logger.info(`Retrieved page ${pageCount}, total results: ${allResults.length}`);
                } else {
                    logger.warn(`Failed to get next page: ${nextPageResponse.status}`);
                    break;
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                logger.error(`Error fetching next page: ${errorMessage}`);
                break;
            }
        }
        
        // Limit results to maxResults if needed
        if (allResults.length > maxResults) {
            allResults = allResults.slice(0, maxResults);
        }
        
        // Transform the results into the desired format
        const formattedResults = allResults.map(place => {
            // Extract available data from the place result
            const {
                name,
                rating,
                user_ratings_total: reviews,
                formatted_address,
                vicinity,
                types,
                photos,
                place_id,
                plus_code,
                geometry
            } = place;
            
            // Define interface for Google Places API photo object
            interface PlacePhoto {
                photo_reference: string;
                width: number;
                height: number;
                html_attributions: string[];
            }
            
            // Construct image URLs if photos are available
            const imageUrl = photos ? photos.map((photo: PlacePhoto) => {
                // If we have a photo_reference, we could construct a URL to fetch the image
                // Note: This would require an additional API call to fetch the actual image
                return {
                    reference: photo.photo_reference,
                    width: photo.width,
                    height: photo.height
                };
            }) : [];
            
            // Construct a link to Google Maps for this place
            const detailLink = place_id ? 
                `https://www.google.com/maps/place/?q=place_id:${place_id}` : 
                '';
            
            // Use formatted_address or vicinity as the address
            const address = formatted_address || vicinity || '';
            
            // Use vicinity as description if available
            const description = vicinity || '';
            
            // Combine all text content for the snippet
            const fullText = [name, address, description].filter(Boolean).join(' - ');
            
            // Return the formatted place object
            return {
                name,
                title: name,
                ratings: rating || 0,
                reviews: reviews || 0,
                description,
                address: address || description,
                phone: '', // Would require a Place Details request
                website: '', // Would require a Place Details request
                hours: '', // Would require a Place Details request
                type: types || [],
                images: imageUrl,
                link: detailLink,
                snippet: fullText,
                // Include coordinates if available
                coordinates: geometry?.location ? {
                    lat: geometry.location.lat,
                    lng: geometry.location.lng
                } : null,
                // Include the original data from Google Places API
                originalData: place
            };
        });
        
        return {
            status: true,
            places: formattedResults,
            total_results: formattedResults.length,
            pages_fetched: pageCount,
            has_more: !!nextPageToken
        };
    } catch (error: unknown) {
        console.log(error);
        const errorMessage = error instanceof Error ? error.message : 'Google Maps Places API request failed';
        logger.error(`Google Maps Places API error: ${errorMessage}`);
        return { status: false, error: errorMessage };
    }
};

export default {
    GoogleSerp,
    GoogleMap,
    GoogleMapPlaces
};
// GoogleMapPlaces({ query: 'petrol pump', location: '29.1937,73.2046', radius: 10000 })
