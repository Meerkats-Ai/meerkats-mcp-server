import axios from 'axios';
import logger from '../utils/logger.js';
import { getSystemConnection, getConnectionByName } from '../controllers/connection.controller.js';
import { ErrorCode, formatError } from '../utils/errorCodes.js';
import { logError, ScraperError } from '../utils/errorLogger.js';
import { LgResult } from '../interface.js';

export interface PageOptions {
    excludeTags?: string[];
    includeOnlyTags?: string[];
    waitForMs?: number;
    extractMainContentOnly?: boolean;
    includeHtmlContent?: boolean;
    captureScreenshot?: boolean;
    timeout?: number;
}

export interface ScrapeRequest {
    url?: string;
    pageOptions?: PageOptions;
    query?: string;
    instant?: boolean;
}

export interface ScrapeResult {
    status: boolean;
    markdown?: string;
    html?: string;
    error?: string;
}

// Main function to call the scraper engine
const limit = 100
let failed = 0
let success = 0
export const scraperEngineCall = async (payload: ScrapeRequest, retry = 0): Promise<ScrapeResult> => {
    console.log(failed, success)
    const startTime = Date.now();
    const connectionsObj = await getSystemConnection(['SCRAPPER_CALLBACK_API_URL', 'SCRAPPER_API_URL', 'MEERKATS_API_KEY']);
    if (!connectionsObj.MEERKATS_API_KEY) {
        return { status: false, error: formatError(ErrorCode.WEB_MISSING_CREDENTIALS, 'API key is required').error };
    }
    const apiUrl = `${connectionsObj.SCRAPPER_API_URL}/api/scraper/scrape`;
    // return axios.post(`https://cs.meerkats.ai/api/scraper/scrape`, payload, {
    return axios.post(apiUrl, payload, {
        headers: {
            'x-api-key': connectionsObj.MEERKATS_API_KEY ?? '',
        }
    }).then(res => {
        success++
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        logger.info(duration.toString())
        return {
            status: true,
            markdown: res?.data.markdown
        }
    }).catch(err => {
        failed++
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        logger.info(JSON.stringify({status:err?.response?.status, failed, duration}))
        const errorCode = err?.response?.status;
            const errorText = err?.response?.statusText;
        return {
            status: false,
            error: errorCode ? `${errorCode}: ${errorText}` : 'Failed'
        }
    })
    // const connectionsObj = await getSystemConnection(['SCRAPPER_CALLBACK_API_URL', 'SCRAPPER_API_URL', 'MEERKATS_API_KEY']);
    // if (!connectionsObj.MEERKATS_API_KEY) {
    //     return { status: false, error: formatError(ErrorCode.WEB_MISSING_CREDENTIALS, 'API key is required').error };
    // }

    // const isGoogleMaps = payload?.url?.includes('.google.com/maps');
    // const shouldApplyTimeout = !isGoogleMaps

    // const apiUrl = `${connectionsObj.SCRAPPER_API_URL}/api/scraper/scrape`;
    // logger.info(apiUrl);
    // logger.info(JSON.stringify(payload, null, 2));
    // const startTime = Date.now();
    // // const timeout = shouldApplyTimeout ? 65000 : 300000;
    // return axios
    //     .post(apiUrl, payload, {
    //         headers: {
    //             'X-API-Key': connectionsObj.MEERKATS_API_KEY ?? '',
    //             'X-API-connection': 'abc',
    //             'x-user-id': 'abc',
    //             'Content-Type': 'application/json'
    //         },
    //         // timeout
    //     })
    //     .then(async (res: any) => {
    //         return res.data;
    //     })
    //     .catch(async (error: any) => {
    //         const isForbidden = error?.response?.status === 403 || error?.response?.status === 429 || error?.response?.status === 503 || error?.response?.status === 500 || error?.response?.status === 502
    //         const errorCode = error?.response?.status;
    //         const errorText = error?.response?.statusText;
    //         if (!errorCode) {
    //             logger.error(error);
    //         }
    //         logger.info(`Scrape engine call response, ${JSON.stringify({ errorCode, errorText, isForbidden, retry }, null, 2)}`);
    //         if ((isForbidden || !errorCode) && retry < 3) {
    //             logger.info(`Scrape engine call response isForbidden`);
    //             await new Promise((resolve) => setTimeout(resolve, 10000));
    //             return scraperEngineCall(payload, retry + 1);
    //         }

    //         const endTime = Date.now();
    //         const diff = endTime - startTime;
    //         logger.info('Scrape engine call time', diff / 1000);
    //         logger.error('error', errorCode);
    //         return { status: false, error: `ERR_0002: Scrape engine failed ${error?.messsage ?? errorCode}`, shouldRetry: true };
    //     });
};

// Function to scrape a URL and return markdown content
export const ScrapeUrlReturnMarkdown = async (url?: string, query?: string, wait?: number): Promise<LgResult> => {
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
            instant: wait ? false : true
        };

        const engineResult: ScrapeResult = await scraperEngineCall(payload);
        if (engineResult.status === false) {
            if (engineResult.error === 'NS_ERROR_PROXY_CONNECTION_REFUSED') {
                engineResult.error = `SYSTEM_ERROR: ${engineResult.error}`
            }
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
    query = (query ?? '').replace(/['"]/g, '');
    return ScrapeUrlReturnMarkdown('', query, 0);
};

// Function to scrape a URL (wrapper around scraperEngineCall)
export const scrapeUrl = async (params: ScrapeRequest) => {
    return await scraperEngineCall(params);
};
