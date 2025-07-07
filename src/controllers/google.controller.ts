import { ErrorCode, formatError } from '../utils/errorCodes.js';
import logger from '../utils/logger.js';
import { scrapeUrl } from '../scraper/scraper.js';
import { LgResult } from '../interface.js';
import axios from 'axios';

// Interface for Google Places API v1 response
interface GooglePlaceV1 {
    name: string;
    id: string;
    types: string[];
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    formattedAddress: string;
    addressComponents?: Array<{
        longText: string;
        shortText: string;
        types: string[];
        languageCode: string;
    }>;
    plusCode?: {
        globalCode: string;
        compoundCode: string;
    };
    location: {
        latitude: number;
        longitude: number;
    };
    viewport?: {
        low: {
            latitude: number;
            longitude: number;
        };
        high: {
            latitude: number;
            longitude: number;
        };
    };
    rating?: number;
    googleMapsUri: string;
    websiteUri?: string;
    regularOpeningHours?: {
        openNow: boolean;
        periods: Array<{
            open: {
                day: number;
                hour: number;
                minute: number;
                date?: {
                    year: number;
                    month: number;
                    day: number;
                };
            };
            close: {
                day: number;
                hour: number;
                minute: number;
                date?: {
                    year: number;
                    month: number;
                    day: number;
                };
            };
        }>;
        weekdayDescriptions: string[];
        nextOpenTime?: string;
    };
    utcOffsetMinutes?: number;
    adrFormatAddress?: string;
    businessStatus?: string;
    userRatingCount?: number;
    iconMaskBaseUri?: string;
    iconBackgroundColor?: string;
    displayName?: {
        text: string;
        languageCode: string;
    };
    primaryTypeDisplayName?: {
        text: string;
        languageCode: string;
    };
    currentOpeningHours?: {
        openNow: boolean;
        periods: Array<any>;
        weekdayDescriptions: string[];
        nextOpenTime?: string;
    };
    primaryType?: string;
    shortFormattedAddress?: string;
    reviews?: Array<{
        name: string;
        relativePublishTimeDescription: string;
        rating: number;
        text: {
            text: string;
            languageCode: string;
        };
        originalText: {
            text: string;
            languageCode: string;
        };
        authorAttribution: {
            displayName: string;
            uri: string;
            photoUri: string;
        };
        publishTime: string;
        flagContentUri: string;
        googleMapsUri: string;
    }>;
    photos?: Array<{
        name: string;
        widthPx: number;
        heightPx: number;
        authorAttributions: Array<{
            displayName: string;
            uri: string;
            photoUri: string;
        }>;
        flagContentUri: string;
        googleMapsUri: string;
    }>;
    restroom?: boolean;
    paymentOptions?: {
        acceptsCreditCards: boolean;
        acceptsDebitCards: boolean;
        acceptsCashOnly: boolean;
        acceptsNfc: boolean;
    };
    accessibilityOptions?: {
        wheelchairAccessibleEntrance: boolean;
        wheelchairAccessibleRestroom: boolean;
    };
    containingPlaces?: Array<{
        name: string;
        id: string;
    }>;
    addressDescriptor?: any;
    googleMapsLinks?: {
        directionsUri: string;
        placeUri: string;
        writeAReviewUri: string;
        reviewsUri: string;
        photosUri: string;
    };
    timeZone?: {
        id: string;
    };
    postalAddress?: {
        regionCode: string;
        languageCode: string;
        postalCode: string;
        administrativeArea: string;
        locality: string;
        addressLines: string[];
    };
}

// Interface for Google Places API v1 photo
interface GooglePlacePhotoV1 {
    name: string;
    widthPx: number;
    heightPx: number;
    authorAttributions: Array<{
        displayName: string;
        uri: string;
        photoUri: string;
    }>;
    flagContentUri: string;
    googleMapsUri: string;
}

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
 * Uses the official Google Maps Places API v1 instead of web scraping
 * Implements pagination to retrieve up to 200 records
 */
export const GoogleMapPlaces = async (args: any) => {
    try {
        const { query, location, googleApiKey } = args;
        const maxResults = 200;
        
        if (!query) {
            return {
                status: false,
                error: formatError(ErrorCode.INVALID_PARAMETERS, 'Search query is required').error
            };
        }

        // Construct the text query based on the provided parameters
        let textQuery = query;
        
        // If location is provided, add it to the query
        if (location) {
            // Check if it's a zipcode (simple check for numeric-only string)
            if (/^\d+$/.test(location)) {
                textQuery += ` at ${location} USA`;
                logger.info(`Using zipcode in query: ${textQuery}`);
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
                            // For coordinates, we could try to get a nearby city/region name
                            // But for now, we'll just use the coordinates in the query
                            textQuery += ` near ${latNum},${lngNum}`;
                            logger.info(`Using coordinates in query: ${textQuery}`);
                        } else {
                            logger.warn(`Coordinates out of valid range: ${location}`);
                            // Add as text anyway
                            textQuery += ` ${location}`;
                        }
                    } else {
                        logger.warn(`Invalid coordinate format (not numeric): ${location}`);
                        // Add as text anyway
                        textQuery += ` ${location}`;
                    }
                } else {
                    logger.warn(`Invalid coordinate format (wrong format): ${location}`);
                    // Add as text anyway
                    textQuery += ` ${location}`;
                }
            }
        }
        
        // Use the Places API v1 to search for places
        const url = 'https://places.googleapis.com/v1/places:searchText?fields=*';
        logger.info(`Making request to Google Places API v1: ${url}`);
        logger.info(`Text Query: ${textQuery}`);

        // Array to store all places from multiple requests
        let allPlaces: GooglePlaceV1[] = [];
        let pagesFetched = 0;
        let hasMore = false;
        let pageToken = '';
        
        // Function to make a request to the Places API
        const fetchPlacesPage = async (token?: string) => {
            const requestBody: any = {
                textQuery: textQuery
            };
            
            // Add page token if provided
            if (token) {
                requestBody.pageToken = token;
            }
            
            // Make the request with the new API format
            const response = await axios.post(url, requestBody, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': googleApiKey
                }
            });
            
            return response;
        };
        
        // Make the initial request
        let response = await fetchPlacesPage();
        
        if (response.status !== 200) {
            return {
                status: false,
                error: formatError(ErrorCode.API_REQUEST_FAILED, 'Failed to get places from Google Maps API').error
            };
        }
        
        // Check if we have places in the response
        if (!response.data.places || !Array.isArray(response.data.places)) {
            return {
                status: false,
                error: formatError(ErrorCode.API_REQUEST_FAILED, 'No places found in API response').error
            };
        }
        
        // Add places from the first page
        allPlaces = [...response.data.places];
        pagesFetched = 1;
        
        // Check if there's a next page token
        if (response.data.nextPageToken) {
            pageToken = response.data.nextPageToken;
            hasMore = true;
        }
        
        // Fetch additional pages if needed to reach maxResults
        while (hasMore && allPlaces.length < maxResults && pagesFetched < 20) {
            try {
                // Wait a short delay before making the next request (API may require this)
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                logger.info(`Fetching page ${pagesFetched + 1} with token: ${pageToken}`);
                
                // Make the next request with the page token
                response = await fetchPlacesPage(pageToken);
                
                if (response.status === 200 && response.data.places && Array.isArray(response.data.places)) {
                    // Add places from this page
                    allPlaces = [...allPlaces, ...response.data.places];
                    pagesFetched++;
                    
                    logger.info(`Retrieved page ${pagesFetched}, total places: ${allPlaces.length}`);
                    
                    // Check if there's another page token
                    if (response.data.nextPageToken) {
                        pageToken = response.data.nextPageToken;
                        hasMore = true;
                    } else {
                        hasMore = false;
                    }
                } else {
                    logger.warn(`Failed to get next page: ${response.status}`);
                    hasMore = false;
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                logger.error(`Error fetching next page: ${errorMessage}`);
                hasMore = false;
            }
            
            // Stop if we've reached the maximum number of results
            if (allPlaces.length >= maxResults) {
                break;
            }
        }
        
        logger.info(`Total places retrieved: ${allPlaces.length} in ${pagesFetched} pages`);
        
        // Transform the results into the desired format
        const formattedResults = allPlaces.map((place: GooglePlaceV1) => {
            // Extract available data from the place result
            const {
                id,
                displayName,
                formattedAddress,
                location,
                rating,
                userRatingCount,
                types,
                photos,
                nationalPhoneNumber,
                internationalPhoneNumber,
                websiteUri,
                regularOpeningHours,
                primaryType
            } = place;

            // Construct image URLs if photos are available
            const imageUrl = photos ? photos.map((photo: GooglePlacePhotoV1) => {
                return {
                    name: photo.name,
                    widthPx: photo.widthPx,
                    heightPx: photo.heightPx,
                    authorAttributions: photo.authorAttributions,
                    googleMapsUri: photo.googleMapsUri
                };
            }) : [];

            // Construct a link to Google Maps for this place
            const detailLink = place.googleMapsUri || (id ? 
                `https://www.google.com/maps/place/?q=place_id:${id}` : 
                '');

            // Get the name from displayName or fallback
            const name = displayName?.text || 'Unnamed Place';

            // Use formattedAddress as the address
            const address = formattedAddress || '';

            // Use types as description
            const description = types?.join(', ') || '';

            // Format opening hours if available
            const hours = regularOpeningHours?.weekdayDescriptions?.join(', ') || '';

            // Combine all text content for the snippet
            const fullText = [name, address, description].filter(Boolean).join(' - ');

            // Return the formatted place object
            return {
                name,
                title: name,
                ratings: rating || 0,
                reviews: userRatingCount || 0,
                description,
                address,
                phone: nationalPhoneNumber || internationalPhoneNumber || '',
                website: websiteUri || '',
                hours,
                type: types || [],
                primaryType: primaryType || '',
                images: imageUrl,
                link: detailLink,
                snippet: fullText,
                // Include coordinates if available
                coordinates: location ? {
                    lat: location.latitude,
                    lng: location.longitude
                } : null,
                // Include the original data from Google Places API
                originalData: place
            };
        });

        // Limit results to maxResults if needed
        const limitedResults = formattedResults.length > maxResults ? 
            formattedResults.slice(0, maxResults) : 
            formattedResults;

        return {
            status: true,
            places: limitedResults,
            total_results: limitedResults.length,
            pages_fetched: pagesFetched,
            has_more: hasMore
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
