/* eslint-disable no-console, import/extensions, import/no-unresolved */
import * as AGUrlFilter from './engine.js';
import { applyCss, applyScripts } from './cosmetic.js';
import { FilteringLog } from './filtering-log/filtering-log.js';
import { CookieApi } from './cookie/cookie-api.js';

/**
 * Extension application class
 */
export class Application {
    /**
     * TS Engine instance
     */
    engine;

    /**
     * Filtering log
     */
    filteringLog = new FilteringLog();

    // eslint-disable-next-line no-undef
    browser = chrome;

    /**
     * Content filtering support
     *
     * @type {boolean}
     */
    responseContentFilteringSupported = (typeof this.browser.webRequest !== 'undefined'
        && typeof this.browser.webRequest.filterResponseData !== 'undefined');

    /**
     * Content filtering module
     */
    contentFiltering = null;

    /**
     * Cookie filtering module
     */
    cookieFiltering = null;

    /**
     * Initializes engine instance
     *
     * @param rulesText
     */
    startEngine(rulesText) {
        console.log('Starting url filter engine');

        const list = new AGUrlFilter.StringRuleList(1, rulesText, false);
        const ruleStorage = new AGUrlFilter.RuleStorage([list]);
        const config = {
            engine: 'extension',
            // eslint-disable-next-line no-undef
            version: chrome.runtime.getManifest().version,
            verbose: true,
        };

        this.engine = new AGUrlFilter.Engine(ruleStorage, config);
        this.contentFiltering = new AGUrlFilter.ContentFiltering(this.filteringLog);
        this.cookieFiltering = new AGUrlFilter.CookieFiltering(new CookieApi(this.browser), this.filteringLog);

        console.log('Starting url filter engine..ok');
    }

    /**
     * On before request handler
     *
     * @param details request details
     */
    // eslint-disable-next-line consistent-return
    onBeforeRequest(details) {
        console.debug('Processing request..');
        console.debug(details);

        const requestType = Application.transformRequestType(details.type);
        const request = new AGUrlFilter.Request(details.url, details.initiator, requestType);
        const result = this.engine.matchRequest(request);

        console.debug(result);

        const requestRule = result.getBasicResult();

        if (details.type === 'main_frame') {
            this.filteringLog.addHttpRequestEvent(details.tabId, details.url, requestRule);
        }

        if (requestRule
            && !requestRule.isWhitelist()) {
            // eslint-disable-next-line consistent-return
            return { cancel: true };
        }
    }

    /**
     * Applies cosmetic rules to request tab
     *
     * @param details request details
     */
    applyCosmetic(details) {
        const { tabId, url } = details;

        console.debug(`Processing tab ${tabId} changes..`);

        // This is a mock request, to do it properly we should pass main frame request with correct cosmetic option
        const { hostname } = new URL(url);
        const cosmeticResult = this.engine.getCosmeticResult(hostname, AGUrlFilter.CosmeticOption.CosmeticOptionAll);
        console.debug(cosmeticResult);

        applyCss(tabId, cosmeticResult);
        applyScripts(tabId, cosmeticResult);

        cosmeticResult.JS.specific.forEach((scriptRule) => {
            this.filteringLog.addScriptInjectionEvent(
                tabId,
                url,
                scriptRule,
            );
        });
    }

    /**
     * On response headers received handler
     *
     * @param details
     * @return {{responseHeaders: *}}
     */
    // eslint-disable-next-line consistent-return
    onResponseHeadersReceived(details) {
        let responseHeaders = details.responseHeaders || [];

        const requestType = Application.transformRequestType(details.type);

        // TODO: Refactor request constructor
        const request = new AGUrlFilter.Request(details.url, details.initiator, requestType);
        request.requestId = details.requestId;
        request.tabId = details.tabId;

        // Apply Html filtering and replace rules
        if (this.responseContentFilteringSupported) {
            const contentType = Application.getHeaderValueByName(responseHeaders, 'content-type');
            const replaceRules = this.getReplaceRules(request);
            const htmlRules = this.getHtmlRules(details);

            request.statusCode = details.statusCode;
            request.method = details.method;

            this.contentFiltering.apply(
                this.browser.webRequest.filterResponseData(details.requestId),
                request,
                contentType,
                replaceRules,
                htmlRules,
            );
        }

        let responseHeadersModified = false;
        if (details.type === 'main_frame') {
            const cspHeaders = this.getCSPHeaders(details);
            console.debug(cspHeaders);

            if (cspHeaders && cspHeaders.length > 0) {
                responseHeaders = responseHeaders.concat(cspHeaders);
                responseHeadersModified = true;
            }
        }

        if (responseHeadersModified) {
            console.debug('Response headers modified');
            return { responseHeaders };
        }
    }

    /**
     * Called before request is sent to the remote endpoint.
     *
     * @param details Request details
     * @returns {*} headers to send
     */
    // eslint-disable-next-line consistent-return
    onBeforeSendHeaders(details) {
        const requestHeaders = details.requestHeaders || [];

        const requestType = Application.transformRequestType(details.type);
        const request = new AGUrlFilter.Request(details.url, details.initiator, requestType);
        request.requestId = details.requestId;
        request.tabId = details.tabId;

        let requestHeadersModified = false;
        if (this.processRequestHeaders(request, requestHeaders)) {
            requestHeadersModified = true;
        }

        if (requestHeadersModified) {
            console.debug('Request headers modified');
            return { requestHeaders };
        }
    }

    /**
     * Wrapper for webRequest.onCompleted event
     *
     * @param details
     */
    onCompleted(details) {
        console.debug('Processing onCompleted event');

        // Permission is not granted
        if (!this.browser.cookies) {
            return false;
        }

        return this.cookieFiltering.modifyCookies(details.requestId);
    }

    /**
     * Wrapper for webRequest.onErrorOccurred event
     *
     * @param details
     */
    onErrorOccurred(details) {
        console.debug('Processing onErrorOccurred event');

        // Permission is not granted
        if (!this.browser.cookies) {
            return false;
        }

        return this.cookieFiltering.modifyCookies(details.requestId);
    }

    /**
     * Returns cookie rules matching request details
     *
     * @param request
     * @return {NetworkRule[]}
     */
    getCookieRules(request) {
        const result = this.engine.matchRequest(request);
        return result.getCookieRules();
    }

    /**
     * Modifies request headers
     *
     * @param request
     * @param headers
     * @return {null}
     */
    processRequestHeaders(request, headers) {
        console.debug('Processing request headers');
        console.debug(headers);

        // Permission is not granted
        if (!this.browser.cookies) {
            return false;
        }

        const cookieRules = this.getCookieRules(request);
        return this.cookieFiltering.processRequestHeaders(request, headers, cookieRules);
    }

    /**
     * Modify CSP header to block WebSocket, prohibit data: and blob: frames and WebWorkers
     *
     * @param details
     * @returns {{responseHeaders: *}} CSP headers
     */
    getCSPHeaders(details) {
        const request = new AGUrlFilter.Request(details.url, details.initiator, AGUrlFilter.RequestType.Document);
        const result = this.engine.matchRequest(request);

        const cspHeaders = [];
        const cspRules = result.getCspRules();
        if (cspRules) {
            for (let i = 0; i < cspRules.length; i += 1) {
                const rule = cspRules[i];
                cspHeaders.push({
                    name: 'Content-Security-Policy',
                    value: rule.getAdvancedModifierValue(),
                });
            }
        }

        return cspHeaders;
    }

    /**
     * Returns replace rules matching request details
     *
     * @param request
     */
    getReplaceRules(request) {
        // TODO: Cache match result at on before request step
        const result = this.engine.matchRequest(request);

        return result.getReplaceRules();
    }

    /**
     * Returns replace rules matching request details
     *
     * @param details
     */
    getHtmlRules(details) {
        const { hostname } = new URL(details.url);
        const cosmeticResult = this.engine.getCosmeticResult(hostname, AGUrlFilter.CosmeticOption.CosmeticOptionHtml);

        return cosmeticResult.Html.getRules();
    }

    /**
     * Transform string to Request type object
     *
     * @param requestType
     * @return {RequestType}
     */
    static transformRequestType(requestType) {
        switch (requestType) {
            case 'main_frame':
                return AGUrlFilter.RequestType.Document;
            case 'document':
                return AGUrlFilter.RequestType.Subdocument;
            case 'stylesheet':
                return AGUrlFilter.RequestType.Stylesheet;
            case 'font':
                return AGUrlFilter.RequestType.Font;
            case 'image':
                return AGUrlFilter.RequestType.Image;
            case 'media':
                return AGUrlFilter.RequestType.Media;
            case 'script':
                return AGUrlFilter.RequestType.Script;
            case 'xmlhttprequest':
                return AGUrlFilter.RequestType.XmlHttpRequest;
            case 'websocket':
                return AGUrlFilter.RequestType.Websocket;
            default:
                return AGUrlFilter.RequestType.Other;
        }
    }

    /**
     * Finds header object by header name (case insensitive)
     * @param headers Headers collection
     * @param headerName Header name
     * @returns {*}
     */
    static findHeaderByName(headers, headerName) {
        if (headers) {
            for (let i = 0; i < headers.length; i += 1) {
                const header = headers[i];
                if (header.name.toLowerCase() === headerName.toLowerCase()) {
                    return header;
                }
            }
        }
        return null;
    }

    /**
     * Finds header value by name (case insensitive)
     * @param headers Headers collection
     * @param headerName Header name
     * @returns {null}
     */
    static getHeaderValueByName(headers, headerName) {
        const header = this.findHeaderByName(headers, headerName);
        return header ? header.value : null;
    }
}
