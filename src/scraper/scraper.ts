import axios from 'axios';
import logger from '../utils/logger.js';
import { getSystemConnection, getConnectionByName } from '../controllers/connection.controller.js';
import { ErrorCode, formatError } from '../utils/errorCodes.js';
import { logError, ScraperError } from '../utils/errorLogger.js';
import { LgResult } from '../interface.js';

// Interfaces for scraper operations
export interface GoogleSearchResult {
    title: string;
    link: string;
    snippet: string;
}

export interface GoogleMapsSearchResult {
    title: string;
    address: string;
    rating: string;
    reviews: string;
    link: string;
    snippet: string;
    phone: string;
    website: string;
    hours: string;
    photos: string;
    directions: string;
}

export interface CrawlerOptions {
    limit?: number;
    maxDepth?: number;
    useSitemap?: boolean;
    allowBackwardsLinks?: boolean;
    excludePaths?: string[];
    includeOnlyPaths?: string[];
}

export interface PageOptions {
    excludeTags?: string[];
    includeOnlyTags?: string[];
    waitForMs?: number;
    extractMainContentOnly?: boolean;
    includeHtmlContent?: boolean;
    includePageLinks?: boolean;
    isSearch?: boolean;
    scrollToBottom?: boolean;
    captureScreenshot?: boolean;
    pages?: number;
    isProxyRequired?: boolean;
    rowExpander?: boolean;
    country?: string;
    state?: string;
    city?: string;
    timeout?: number;
    companies?: string[];
    innerTextOnly?: boolean;
}

export interface CallbackParams {
    scrapperCallbackUrl?: string;
    userId?: string;
    cellId?: string;
    tableId?: string;
    rowId?: string;
    batchId?: string;
}

export interface ScrapeRequest {
    url?: string;
    pageOptions?: PageOptions;
    callback?: CallbackParams;
    cookies?: any;
    proxy_url?: string;
    query?: string;
    instant?: boolean;
}

export interface link {
    url: string | null;
    text: string | null;
}

export interface ScrapeResult {
    status: boolean;
    serpData?: GoogleSearchResult[];
    markdown?: string;
    html?: string;
    error?: string;
    links?: link[];
    shouldRetry?: boolean;
    post?: any;
    posts?: any;
}

// Main function to call the scraper engine
export const scraperEngineCall = async (payload: ScrapeRequest, retry = 0): Promise<ScrapeResult> => {
    const isTest = false;
    if (isTest) {
        return {
            status: true,
            markdown: 'ok'
        };
    }
    
    const connectionsObj = await getSystemConnection(['SCRAPPER_CALLBACK_API_URL', 'SCRAPPER_API_URL', 'MEERKATS_API_KEY']);
    const customUrl = await getConnectionByName('SCRAPPER_API_URL', payload.callback?.userId);
    
    if (!connectionsObj.MEERKATS_API_KEY) {
        return { status: false, error: formatError(ErrorCode.WEB_MISSING_CREDENTIALS, 'API key is required').error };
    }
    
    const isGoogleMaps = payload?.url?.includes('.google.com/maps');
    const isLinkedin = payload?.url?.startsWith('https://www.linkedin.com') || payload?.url?.startsWith('https://linkedin.com');
    const shouldApplyTimeout = !isGoogleMaps && !isLinkedin;
    
    const apiUrl = customUrl ? `${customUrl}/api/scraper/scrape` : `${connectionsObj.SCRAPPER_API_URL}/api/scraper/scrape`;
    
    let apiPayload: ScrapeRequest = {
        ...payload,
        callback: {
            ...payload.callback,
            scrapperCallbackUrl: connectionsObj.SCRAPPER_CALLBACK_API_URL
        }
    };
    
    if (customUrl) {
        apiPayload = {
            ...apiPayload,
            pageOptions: {
                ...apiPayload.pageOptions,
                isProxyRequired: true
            }
        };
    }
    
    if (apiPayload.pageOptions?.waitForMs) {
        let wait = apiPayload.pageOptions.waitForMs;
        wait = wait ? (isNaN(parseInt(wait.toString())) ? 0 : parseInt(wait.toString())) : 0;
        apiPayload.pageOptions.waitForMs = wait;
    }
    
    const startTime = Date.now();
    const timeout = shouldApplyTimeout ? 65000 : 300000;
    console.log({ timeout });
    
    return axios
        .post(apiUrl, apiPayload, {
            headers: {
                'X-API-Key': connectionsObj.MEERKATS_API_KEY ?? '',
                'X-API-connection': 'abc',
                'x-user-id': 'abc',
                'Content-Type': 'application/json'
            },
            timeout
        })
        .then(async (res: any) => {
            const endTime = Date.now();
            const diff = endTime - startTime;
            console.log('Scrape engine call time', diff / 1000);
            console.log(`Scrape engine call response`, res.status);
            
            if (res.status == 200 && res.data) {
                const toreturn = {
                    ...res.data,
                    duration: diff / 1000
                };
                return toreturn;
            } else {
                return {
                    duration: diff / 1000,
                    status: false,
                    error: formatError(ErrorCode.WEB_SCRAPING_FAILED, 'Error in scraping').error,
                    shouldRetry: true
                };
            }
        })
        .catch(async (error: any) => {
            const isForbidden = error?.response?.status === 403 || error?.response?.status === 429 || error?.response?.status === 503;
            const errorCode = error?.response?.status;
            const errorText = error?.response?.statusText;

            console.log(`Scrape engine call response`, { errorCode, errorText, isForbidden, retry });
            if (isForbidden && retry < 3) {
                console.log(`Scrape engine call response isForbidden`);
                await new Promise((resolve) => setTimeout(resolve, 10000));
                return scraperEngineCall(payload, retry + 1);
            }
            
            const endTime = Date.now();
            const diff = endTime - startTime;
            console.log('Scrape engine call time', diff / 1000);
            logger.error('error', errorCode);
            return { status: false, error: `ERR_0002: Scrape engine failed ${error?.messsage ?? errorCode}`, shouldRetry: true };
        });
};

// Function to scrape a URL and return markdown content
export const ScrapeUrlReturnMarkdown = async (url?: string, query?: string,  wait?: number): Promise<LgResult> => {
    if (!url && !query) {
        return { error: formatError(ErrorCode.WEB_INVALID_URL, 'Invalid URL format').error, status: false };
    }
    
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
    }
    
    try {
        const payload: ScrapeRequest = {
            url,
            query,
            pageOptions: {
                waitForMs: wait ? wait * 1000 : 0,
            },
            instant: true
        };
        
        const engineResult: ScrapeResult = await scraperEngineCall(payload);
        if (engineResult.status === false) {
            return engineResult;
        }

        const data: ScrapeResult = engineResult;
        if (data.status === false || data.error) {
            return { error: formatError(ErrorCode.WEB_SCRAPING_FAILED, data.error || 'Scraping failed').error, status: false };
        }
        
        if (data?.markdown) {
            let md = data.markdown.replace(/---/g, '');
            return { ...data, markdown: md, result: md, status: true };
        }
        
        return { error: formatError(ErrorCode.WEB_SCRAPING_FAILED, 'No content found').error, status: false };
    } catch (error: unknown) {
        const scraperError: ScraperError = {
            code: error instanceof Error && error.message.includes('timeout') ? ErrorCode.WEB_TIMEOUT_ERROR : ErrorCode.WEB_SCRAPING_FAILED,
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        };

        logError(scraperError);

        logger.error('error', scraperError.message);
        return {
            error: formatError(scraperError.code, scraperError.message).error,
            status: false
        };
    }
};

// Function to search Google using the Meerkats agent
export const WebSearch = async (query: string): Promise<any> => {
    query = query ? query.replace(/"/g, '') : '';
    return ScrapeUrlReturnMarkdown(undefined, query, 0);
};

// Function to scrape a URL (wrapper around scraperEngineCall)
export const scrapeUrl = async (params: ScrapeRequest) => {
    return await scraperEngineCall(params);
};
