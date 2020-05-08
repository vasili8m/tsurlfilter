import { Request } from '../request';
import { FilteringLog } from '../filtering-log';
import { NetworkRule, NetworkRuleOption } from '../rules/network-rule';
import CookieUtils from './utils';
import { CookieModifier } from '../modifiers/cookie-modifier';
import { BrowserCookie } from './browser-cookie';
import { CookieApi } from './cookie-api';
import { Cookie } from './cookie';

/**
 * Header interface
 */
interface Header {
    name: string;
    value: string;
}

/**
 * Cookie filtering module
 *
 * What do we do here:
 *
 * onResponseHeadersReceived:
 * - parse set-cookie header, only to detect if the cookie in header will be set from third-party request
 * - save third-party flag for this cookie
 *
 * onCompleted/onErrorOccurred:
 * - get all cookies for request url
 * - get third-party flag for each
 * - apply rules
 *
 * onCompleted:
 * - apply blocking first-party rules via content script
 */
interface ICookieFiltering {
    /**
     * Parses response header set-cookie.
     * Saves cookie third-party flag
     *
     * @param request
     * @param responseHeaders Response headers
     */
    processResponseHeaders(request: Request, responseHeaders: Header[]): void;

    /**
     * Modifies cookies with browser.api
     *
     * @param request Request
     * @param cookieRules rules
     */
    modifyCookies(request: Request, cookieRules: NetworkRule[]): void;

    /**
     * Filters blocking first-party rules
     *
     * @param rules
     */
    getBlockingRules(rules: NetworkRule[]): NetworkRule[];
}

/**
 * Cookie filtering module implementation
 */
export class CookieFiltering implements ICookieFiltering {
    /**
     * Cookie api implementation
     */
    private cookieManager: CookieApi;

    /**
     * Filtering log
     */
    private filteringLog: FilteringLog;

    /**
     * Constructor
     *
     * @param cookieManager
     * @param filteringLog
     */
    constructor(cookieManager: CookieApi, filteringLog: FilteringLog) {
        this.cookieManager = cookieManager;
        this.filteringLog = filteringLog;
    }

    /**
     * Parses response header set-cookie.
     * Saves cookie third-party flag
     *
     * @param request
     * @param responseHeaders Response headers
     */
    public processResponseHeaders(request: Request, responseHeaders: Header[]): void {
        const { requestId, thirdParty } = request;

        let iResponseHeaders = responseHeaders.length;
        while (iResponseHeaders > 0) {
            iResponseHeaders -= 1;
            const header = responseHeaders[iResponseHeaders];
            if (!header.name || header.name.toLowerCase() !== 'set-cookie') {
                continue;
            }

            const setCookie = CookieUtils.parseSetCookie(header.value);
            if (!setCookie) {
                continue;
            }

            this.saveCookieInfo(requestId!, setCookie, !!thirdParty);
        }
    }

    /**
     * Modifies cookies with browser.api
     *
     * @param request Request
     * @param cookieRules rules
     */
    public modifyCookies(request: Request, cookieRules: NetworkRule[]): void {
        const {
            requestId, url, tabId,
        } = request;

        const cookies = this.cookieManager.getCookies(url);

        for (const cookie of cookies) {
            const isThirdParty = this.getCookieInfo(requestId!, cookie);

            this.applyRulesToCookie(url, cookie, isThirdParty, cookieRules, tabId!);
        }

        this.cookiesMap.delete(requestId!);
    }

    /**
     * Filters blocking first-party rules
     *
     * @param rules
     */
    // eslint-disable-next-line class-methods-use-this
    public getBlockingRules(rules: NetworkRule[]): NetworkRule[] {
        const result = [];
        for (let i = 0; i < rules.length; i += 1) {
            const rule = rules[i];
            if (!CookieFiltering.matchThirdParty(rule, false)) {
                continue;
            }

            if (CookieFiltering.isModifyingRule(rule)) {
                continue;
            }

            result.push(rule);
        }

        return result;
    }

    /**
     * Applies rules to cookie
     *
     * @param url
     * @param cookie
     * @param isThirdPartyCookie
     * @param cookieRules
     * @param tabId
     */
    private applyRulesToCookie(
        url: string,
        cookie: BrowserCookie,
        isThirdPartyCookie: boolean,
        cookieRules: NetworkRule[],
        tabId: number,
    ): void {
        const cookieName = cookie.name;

        const bRule = CookieFiltering.lookupNotModifyingRule(cookieName, cookieRules, isThirdPartyCookie);
        if (bRule) {
            this.cookieManager.removeCookie(cookie.name, url);
            this.filteringLog.addCookieEvent(tabId, cookie.name, [bRule]);
            return;
        }

        const mRules = CookieFiltering.lookupModifyingRules(cookieName, cookieRules, isThirdPartyCookie);
        if (mRules.length > 0) {
            const appliedRules = CookieFiltering.applyRuleToBrowserCookie(cookie, mRules);
            if (appliedRules.length > 0) {
                this.cookieManager.modifyCookie(cookie, url);
                this.filteringLog.addCookieEvent(tabId, cookie.name, appliedRules);
            }
        }
    }

    /**
     * Modifies set-cookie header with rules
     *
     * @param cookie Cookie header to modify
     * @param rules Cookie matching rules
     * @return applied rules
     *
     */
    private static applyRuleToBrowserCookie(cookie: BrowserCookie, rules: NetworkRule[]): NetworkRule[] {
        const appliedRules = [];

        for (let i = 0; i < rules.length; i += 1) {
            const rule = rules[i];
            const cookieModifier = rule.getAdvancedModifier() as CookieModifier;

            let modified = false;

            // eslint-disable-next-line prefer-destructuring
            const sameSite = cookieModifier.getSameSite();
            if (sameSite && cookie.sameSite !== sameSite) {
                // eslint-disable-next-line no-param-reassign
                cookie.sameSite = sameSite;
                modified = true;
            }

            const maxAge = cookieModifier.getMaxAge();
            if (maxAge) {
                if (CookieUtils.updateCookieMaxAge(cookie, maxAge)) {
                    modified = true;
                }
            }

            if (modified) {
                appliedRules.push(rule);
            }
        }

        return appliedRules;
    }

    /**
     * Finds a rule that doesn't modify cookie: i.e. this rule cancels cookie or it's a whitelist rule.
     *
     * @param cookieName Cookie name
     * @param rules Matching rules
     * @param isThirdPartyCookie
     * @return Found rule or null
     */
    private static lookupNotModifyingRule(
        cookieName: string,
        rules: NetworkRule[],
        isThirdPartyCookie: boolean,
    ): NetworkRule | null {
        for (let i = 0; i < rules.length; i += 1) {
            const rule = rules[i];
            if (!CookieFiltering.matchThirdParty(rule, isThirdPartyCookie)) {
                continue;
            }

            const cookieModifier = rule.getAdvancedModifier() as CookieModifier;
            if (cookieModifier.matches(cookieName) && !CookieFiltering.isModifyingRule(rule)) {
                return rule;
            }
        }

        return null;
    }

    /**
     * Checks if rule and third party flag matches
     *
     * @param rule
     * @param isThirdParty
     */
    private static matchThirdParty(rule: NetworkRule, isThirdParty: boolean): boolean {
        if (!rule.isOptionEnabled(NetworkRuleOption.ThirdParty)) {
            return true;
        }

        return isThirdParty;
    }

    /**
     * Checks if $cookie rule is modifying
     *
     * @param rule $cookie rule
     * @return result
     */
    private static isModifyingRule(rule: NetworkRule): boolean {
        const cookieModifier = rule.getAdvancedModifier() as CookieModifier;
        return cookieModifier.getSameSite() !== null
            || (cookieModifier.getMaxAge() !== null && cookieModifier.getMaxAge()! > 0);
    }

    /**
     * Finds rules that modify cookie
     *
     * @param cookieName Cookie name
     * @param rules Matching rules
     * @param isThirdPartyCookie
     * @return Modifying rules
     */
    private static lookupModifyingRules(
        cookieName: string,
        rules: NetworkRule[],
        isThirdPartyCookie: boolean,
    ): NetworkRule[] {
        const result = [];
        if (rules && rules.length > 0) {
            for (let i = 0; i < rules.length; i += 1) {
                const rule = rules[i];
                if (!CookieFiltering.matchThirdParty(rule, isThirdPartyCookie)) {
                    continue;
                }

                const cookieModifier = rule.getAdvancedModifier() as CookieModifier;
                if (!cookieModifier.matches(cookieName)) {
                    continue;
                }

                // Blocking or whitelist rule exists
                if (!CookieFiltering.isModifyingRule(rule)) {
                    return [];
                }

                result.push(rule);
            }
        }
        return result;
    }

    /**
     * Map with third-arty cookie flags
     */
    private cookiesMap: Map<number, {
        cookieName: string;
        thirdParty: boolean;
    }[]> = new Map();

    /**
     * Saves third-party flag for cookie
     *
     * @param requestId
     * @param cookie
     * @param isThirdPartyRequest
     */
    private saveCookieInfo(requestId: number, cookie: Cookie, isThirdPartyRequest: boolean): void {
        let values = this.cookiesMap.get(requestId);
        if (!values) {
            values = [];
            this.cookiesMap.set(requestId, values);
        }

        values.push({
            cookieName: cookie.name,
            thirdParty: isThirdPartyRequest,
        });
    }

    /**
     * Gets third-party flag for cookie
     *
     * @param requestId
     * @param cookie
     */
    private getCookieInfo(requestId: number, cookie: BrowserCookie): boolean {
        const values = this.cookiesMap.get(requestId);
        if (values && values.length > 0) {
            for (const info of values!) {
                if (info.cookieName === cookie.name) {
                    return info.thirdParty;
                }
            }
        }

        return false;
    }
}
