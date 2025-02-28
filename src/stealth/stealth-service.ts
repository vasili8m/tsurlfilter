import { WebRequest } from 'webextension-polyfill-ts';
import { Request } from '../request';
import { NetworkRule } from '../rules/network-rule';
import { findHeaderByName, removeHeader } from '../utils/headers';
import { getHost, isThirdPartyRequest, cleanUrlParam } from '../utils/url';
import { RequestType } from '../request-type';
import HttpHeaders = WebRequest.HttpHeaders;

/**
 * Stealth action bitwise masks
 */
export enum StealthActions {
    HIDE_REFERRER = 1 << 0,
    HIDE_SEARCH_QUERIES = 1 << 1,
    BLOCK_CHROME_CLIENT_DATA= 1 << 2,
    SEND_DO_NOT_TRACK = 1 << 3,
    STRIPPED_TRACKING_URL = 1 << 4,
    FIRST_PARTY_COOKIES= 1 << 5,
    THIRD_PARTY_COOKIES= 1 << 6,
}

/**
 * Stealth service configuration
 */
export interface StealthConfig {
    /**
     * Is strip tracking query params enabled
     */
    stripTrackingParameters: boolean;

    /**
     * Parameters to clean
     */
    trackingParameters: string;

    /**
     * Is destruct first-party cookies enabled
     */
    selfDestructFirstPartyCookies: boolean;

    /**
     * Cookie maxAge in minutes
     */
    selfDestructFirstPartyCookiesTime: number;

    /**
     * Is destruct third-party cookies enabled
     */
    selfDestructThirdPartyCookies: boolean;

    /**
     * Cookie maxAge in minutes
     */
    selfDestructThirdPartyCookiesTime: number;

    /**
     * Remove referrer for third-party requests
     */
    hideReferrer: boolean;

    /**
     * Hide referrer in case of search engine is referrer
     */
    hideSearchQueries: boolean;

    /**
     * Remove X-Client-Data header
     */
    blockChromeClientData: boolean;

    /**
     * Adding Do-Not-Track (DNT) header
     */
    sendDoNotTrack: boolean;
}

/**
 * Stealth service module
 */
export class StealthService {
    /**
     * Headers
     */
    private static readonly HEADERS = {
        REFERRER: 'Referrer',
        X_CLIENT_DATA: 'X-Client-Data',
        DO_NOT_TRACK: 'DNT',
    };

    /**
     * Header values
     */
    private static readonly HEADER_VALUES = {
        DO_NOT_TRACK: {
            name: 'DNT',
            value: '1',
        },
    };

    /**
     * Search engines regexps
     *
     * @type {Array.<string>}
     */
    private static readonly SEARCH_ENGINES = [
        /https?:\/\/(www\.)?google\./i,
        /https?:\/\/(www\.)?yandex\./i,
        /https?:\/\/(www\.)?bing\./i,
        /https?:\/\/(www\.)?yahoo\./i,
        /https?:\/\/(www\.)?go\.mail\.ru/i,
        /https?:\/\/(www\.)?ask\.com/i,
        /https?:\/\/(www\.)?aol\.com/i,
        /https?:\/\/(www\.)?baidu\.com/i,
        /https?:\/\/(www\.)?seznam\.cz/i,
    ];

    /**
     * Configuration
     */
    private readonly config: StealthConfig;

    /**
     * Constructor
     *
     * @param config
     */
    constructor(config: StealthConfig) {
        this.config = config;
    }

    /**
     * Strips out the tracking codes/parameters from a URL and return the cleansed URL
     *
     * @param url
     */
    public removeTrackersFromUrl(url: string): string | null {
        if (!this.config.stripTrackingParameters) {
            return null;
        }

        const params = this.config.trackingParameters
            .trim()
            .split(',')
            .map((x) => x.replace('=', '').replace(/\*/g, '[^&#=]*').trim())
            .filter((x) => x);

        const result = cleanUrlParam(url, params);

        if (result !== url) {
            return result;
        }

        return null;
    }

    /**
     * Returns synthetic set of rules matching the specified request
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public getCookieRules(request: Request): NetworkRule[] {
        const result: NetworkRule[] = [];

        // Remove cookie header for first-party requests
        const blockCookies = this.config.selfDestructFirstPartyCookies;
        if (blockCookies) {
            result.push(StealthService.generateRemoveRule(this.config.selfDestructFirstPartyCookiesTime));
        }

        const blockThirdPartyCookies = this.config.selfDestructThirdPartyCookies;
        if (!blockThirdPartyCookies) {
            return result;
        }

        // eslint-disable-next-line prefer-destructuring
        const thirdParty = request.thirdParty;
        const isMainFrame = request.requestType === RequestType.Document;

        if (thirdParty && !isMainFrame) {
            result.push(StealthService.generateRemoveRule(this.config.selfDestructThirdPartyCookiesTime));
        }

        return result;
    }

    /**
     * Applies stealth actions to request headers
     *
     * @param requestUrl
     * @param requestType
     * @param requestHeaders
     */
    public processRequestHeaders(
        requestUrl: string, requestType: RequestType, requestHeaders: HttpHeaders,
    ): StealthActions {
        let stealthActions = 0;

        // Remove referrer for third-party requests
        if (this.config.hideReferrer) {
            const refHeader = findHeaderByName(requestHeaders, StealthService.HEADERS.REFERRER);
            if (refHeader
                && refHeader.value
                && isThirdPartyRequest(requestUrl, refHeader.value)) {
                refHeader.value = StealthService.createMockRefHeaderUrl(requestUrl);
                stealthActions |= StealthActions.HIDE_REFERRER;
            }
        }

        // Hide referrer in case of search engine is referrer
        const isMainFrame = requestType === RequestType.Document;
        if (this.config.hideSearchQueries && isMainFrame) {
            const refHeader = findHeaderByName(requestHeaders, StealthService.HEADERS.REFERRER);
            if (refHeader
                && refHeader.value
                && StealthService.isSearchEngine(refHeader.value)
                && isThirdPartyRequest(requestUrl, refHeader.value)) {
                refHeader.value = StealthService.createMockRefHeaderUrl(requestUrl);
                stealthActions |= StealthActions.HIDE_SEARCH_QUERIES;
            }
        }

        // Remove X-Client-Data header
        if (this.config.blockChromeClientData) {
            if (removeHeader(requestHeaders, StealthService.HEADERS.X_CLIENT_DATA)) {
                stealthActions |= StealthActions.BLOCK_CHROME_CLIENT_DATA;
            }
        }

        // Adding Do-Not-Track (DNT) header
        if (this.config.sendDoNotTrack) {
            requestHeaders.push(StealthService.HEADER_VALUES.DO_NOT_TRACK);
            stealthActions |= StealthActions.SEND_DO_NOT_TRACK;
        }

        return stealthActions;
    }

    /**
     * Generates rule removing cookies
     *
     * @param {number} maxAgeMinutes Cookie maxAge in minutes
     */
    private static generateRemoveRule(maxAgeMinutes: number): NetworkRule {
        const maxAgeOption = maxAgeMinutes > 0 ? `;maxAge=${maxAgeMinutes * 60}` : '';
        const rule = new NetworkRule(`$cookie=/.+/${maxAgeOption}`, 0);
        rule.isStealthModeRule = true;
        return rule;
    }

    /**
     * Crops url path
     *
     * @param url URL
     * @return URL without path
     */
    private static createMockRefHeaderUrl(url: string): string {
        const host = getHost(url);
        return `${(url.indexOf('https') === 0 ? 'https://' : 'http://') + host}/`;
    }

    /**
     * Is url search engine
     *
     * @param url
     */
    private static isSearchEngine(url: string): boolean {
        return StealthService.SEARCH_ENGINES.some((searchEngineRegex) => searchEngineRegex.test(url));
    }
}
