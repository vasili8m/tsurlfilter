import { Request } from '../request';
import { FilteringLog, NetworkRule } from '..';
import CookieUtils from './utils';
import { CookieModifier } from '../modifiers/cookie-modifier';
import { CookieHeader } from './cookie-header';

/**
 * Header interface
 */
interface Header {
    name: string;
    value: string;
}

/**
 * Cookie manager interface
 * TODO: Extract file
 */
export interface CookieApi {
    /**
     * Removes cookie
     *
     * @param name
     * @param url
     */
    removeCookie(name: string, url: string): void;

    /**
     * Modifies cookie
     *
     * @param name
     * @param url
     */
    modifyCookie(name: string, url: string): void;
}

/**
 * Cookie filtering module
 * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/961
 *
 * Modifies Cookie/Set-Cookie headers.
 *
 * Let's look at an example:
 *
 * 1. ||example.org^$cookie=i_track_u should block the i_track_u cookie coming from example.org
 * 2. We've intercepted a request sent to https://example.org/count
 * 3. Cookie header value is i_track_u=1; JSESSIONID=321321
 * 4. First of all, modify the Cookie header so that the server doesn't receive the i_track_u value.
 *    Modified value: JSESSIONID=321321
 * 5. Wait for the response and check all the Set-Cookie headers received from the server.
 * 6. Remove the one that sets the i_track_u cookie (or modify it and strip that cookie if it contains more than one)
 * 7. Now we need to make sure that browser deletes that cookie.
 *    In order to do it, we should add a new Set-Cookie header that sets i_track_u with a negative
 *    expiration date: Set-Cookie: i_track_u=1; expires=[CURRENT_DATETIME]; path=/; domain=.example.org.
 *
 * Step 7 must not be executed when the rule has the third-party modifier.
 * third-party means that there is a case (first-party) when cookies must not be removed, i.e.
 * they can be actually useful, and removing them can be counterproductive.
 * For instance, Google and Facebook rely on their SSO cookies and forcing a browser to remove
 * them will also automatically log you out.
 */
export class CookieFiltering {
    /**
     * Contains cookie to modify for each request
     */
    private cookiesMap: Map<number, { remove: boolean;cookie: { name: string; url: string }}[]> = new Map();

    /**
     * Cookie api implementation
     */
    private cookieManager: CookieApi;

    /**
     * Filtering log
     */
    private filteringLog: FilteringLog;

    constructor(cookieManager: CookieApi, filteringLog: FilteringLog) {
        this.cookieManager = cookieManager;
        this.filteringLog = filteringLog;
    }

    /**
     * Modifies request headers according to matching $cookie rules.
     * TODO: Handle stealth cookie rules
     *
     * @param request
     * @param requestHeaders Request headers
     * @return True if headers were modified
     */
    public processRequestHeaders(request: Request, requestHeaders: Header[], cookieRules: NetworkRule[]): boolean {
        if ((cookieRules.length === 0)) {
            // Nothing to apply
            return false;
        }

        const {
            requestId, url,
        } = request;

        const cookieHeader = CookieFiltering.findHeaderByName(requestHeaders, 'Cookie');
        if (!cookieHeader) {
            return false;
        }

        const cookies = CookieUtils.parseCookie(cookieHeader.value);
        if (cookies.length === 0) {
            return false;
        }

        let cookieHeaderModified = false;

        let iCookies = cookies.length;
        // modifying cookies here is safe because we're iterating in reverse order
        // eslint-disable-next-line no-cond-assign
        while (iCookies -= 1) {
            const cookie = cookies[iCookies];
            const cookieName = cookie.name;

            const bRule = CookieFiltering.lookupNotModifyingRule(cookieName, cookieRules);
            if (bRule) {
                if (!bRule.isWhitelist()) {
                    cookies.splice(iCookies, 1);
                    cookieHeaderModified = true;
                }
                this.scheduleProcessingCookie(requestId!, cookieName, url, true);
            }

            const mRules = CookieFiltering.lookupModifyingRules(cookieName, cookieRules);
            if (mRules && mRules.length > 0) {
                this.scheduleProcessingCookie(requestId!, cookieName, url, false);
            }
        }

        if (cookieHeaderModified) {
            cookieHeader.value = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
        }

        return cookieHeaderModified;
    }

    /**
     * Modifies response headers according to matching $cookie rules.
     *
     * @param request
     * @param responseHeaders Response headers
     * @param cookieRules
     * @return True if headers were modified
     */
    public processResponseHeaders(request: Request, responseHeaders: Header[], cookieRules: NetworkRule[]): boolean {
        /**
         * TODO: These two issues might change the way we're going to implement this:
         * https://bugs.chromium.org/p/chromium/issues/detail?id=827582
         * https://bugs.chromium.org/p/chromium/issues/detail?id=898461
         */

        if ((cookieRules.length === 0)) {
            // Nothing to apply
            return false;
        }

        /**
         * Collects cookies that will be blocked or modified via Set-Cookie header
         * @type {Array.<string>}
         */
        const processedCookies = [];

        let setCookieHeaderModified = false;

        let iResponseHeaders = responseHeaders.length;
        // modifying responseHeaders array here is safe because we're iterating
        // in reverse order
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

            const cookieName = setCookie.name;
            const bRule = CookieFiltering.lookupNotModifyingRule(cookieName, cookieRules);
            if (bRule) {
                if (!bRule.isWhitelist()) {
                    delete setCookie.expires;
                    setCookie.maxAge = 0;
                    header.value = CookieUtils.serialize(setCookie);

                    setCookieHeaderModified = true;
                }
                processedCookies.push(cookieName);
                // TODO: Add filtering log event
                // addCookieLogEvent(tab, cookieName, cookieValue, cookieDomain, thirdParty, [bRule], false);
            }

            const mRules = CookieFiltering.lookupModifyingRules(cookieName, cookieRules);
            if (CookieFiltering.processSetCookieHeader(setCookie, header, mRules)) {
                setCookieHeaderModified = true;
                processedCookies.push(cookieName);
            }
        }

        this.removeProcessingCookies(request.requestId!, processedCookies);
        return setCookieHeaderModified;
    }

    /**
     * Modifies cookies with browser.api
     * TODO: Add filtering log events
     *
     * @param requestId Request identifier
     */
    public async modifyCookies(requestId: number): Promise<void> {
        const values = this.cookiesMap.get(requestId);
        if (!values || values.length === 0) {
            return;
        }

        for (const value of values) {
            const cookie = value.cookie || {};

            if (value.remove) {
                this.cookieManager.removeCookie(cookie.name, cookie.url);
            } else {
                this.cookieManager.modifyCookie(cookie.name, cookie.url);
            }
        }

        this.cookiesMap.delete(requestId);
    }

    /**
     * Persist cookie for further processing
     *
     * @param {string} requestId
     * @param {string} name
     * @param {string} url
     * @param {boolean} remove
     */
    private scheduleProcessingCookie(requestId: number, name: string, url: string, remove: boolean): void {
        let values = this.cookiesMap.get(requestId);
        if (!values) {
            values = [];
            this.cookiesMap.set(requestId, values);
        }

        values.push({
            remove,
            cookie: { name, url },
        });
    }

    /**
     * Removes cookies from processing
     *
     * @param {string} requestId
     * @param {Array.<string>} cookieNames Cookies to remove
     */
    private removeProcessingCookies(requestId: number, cookieNames: string[]): void {
        const values = this.cookiesMap.get(requestId);
        if (!values) {
            return;
        }

        let iValues = values.length;
        // eslint-disable-next-line no-cond-assign
        while (iValues -= 1) {
            const value = values[iValues];
            // eslint-disable-next-line prefer-destructuring
            const cookie = value.cookie;
            if (cookieNames.indexOf(cookie.name) >= 0) {
                values.splice(iValues, 1);
            }
        }
        if (values.length === 0) {
            this.cookiesMap.delete(requestId);
        }
    }

    /**
     * Process Set-Cookie header modification by rules.
     * Adds corresponding event to the filtering log.
     *
     * @param setCookie Cookie to modify
     * @param header Header to modify
     * @param rules Cookie matching rules
     * @return True if Set-Cookie header were modified
     */
    private static processSetCookieHeader(
        setCookie: CookieHeader,
        header: Header,
        rules: NetworkRule[],
    ): boolean {
        if (rules.length === 0) {
            return false;
        }

        const applied = CookieFiltering.applyRuleToSetCookieHeaderValue(setCookie, rules);

        if (applied.length > 0) {
            // eslint-disable-next-line no-param-reassign
            header.value = CookieUtils.serialize(setCookie);
            // TODO: Filtering log
            // addCookieLogEvent(tab, cookieName, cookieValue, cookieDomain, thirdParty, rules, true);
            return true;
        }

        return false;
    }

    /**
     * Modifies set-cookie header with rules
     *
     * @param setCookie Cookie header to modify
     * @param rules Cookie matching rules
     * @return applied rules
     */
    private static applyRuleToSetCookieHeaderValue(setCookie: CookieHeader, rules: NetworkRule[]): NetworkRule[] {
        const appliedRules = [];

        for (let i = 0; i < rules.length; i += 1) {
            const rule = rules[i];
            const cookieModifier = rule.getAdvancedModifier() as CookieModifier;

            let modified = false;

            // eslint-disable-next-line prefer-destructuring
            const sameSite = cookieModifier.getSameSite();
            if (sameSite && setCookie.sameSite !== sameSite) {
                // eslint-disable-next-line no-param-reassign
                setCookie.sameSite = sameSite;
                modified = true;
            }

            const maxAge = cookieModifier.getMaxAge();
            if (maxAge) {
                if (CookieFiltering.updateSetCookieMaxAge(setCookie, maxAge)) {
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
     * Updates set-cookie maxAge value
     * TODO: Move to utils
     *
     * @param setCookie Cookie to modify
     * @param maxAge
     * @return if cookie was modified
     */
    private static updateSetCookieMaxAge(setCookie: CookieHeader, maxAge: number): boolean {
        const currentTimeSec = Date.now() / 1000;

        let cookieExpiresTimeSec = null;
        if (setCookie.maxAge) {
            cookieExpiresTimeSec = currentTimeSec + setCookie.maxAge;
        } else if (setCookie.expires) {
            cookieExpiresTimeSec = setCookie.expires.getTime() / 1000;
        }

        const newCookieExpiresTimeSec = currentTimeSec + maxAge;
        if (cookieExpiresTimeSec === null || cookieExpiresTimeSec > newCookieExpiresTimeSec) {
            if (setCookie.expires) {
                // eslint-disable-next-line no-param-reassign
                setCookie.expires = new Date(newCookieExpiresTimeSec * 1000);
            } else {
                // eslint-disable-next-line no-param-reassign
                setCookie.maxAge = maxAge;
            }

            return true;
        }

        return false;
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
     * Finds a rule that doesn't modify cookie: i.e. this rule cancels cookie or it's a whitelist rule.
     *
     * @param cookieName Cookie name
     * @param rules Matching rules
     * @return Found rule or null
     */
    private static lookupNotModifyingRule(cookieName: string, rules: NetworkRule[]): NetworkRule | null {
        if (rules && rules.length > 0) {
            for (let i = 0; i < rules.length; i += 1) {
                const rule = rules[i];
                const cookieModifier = rule.getAdvancedModifier() as CookieModifier;
                if (cookieModifier.matches(cookieName) && !CookieFiltering.isModifyingRule(rule)) {
                    return rule;
                }
            }
        }

        return null;
    }

    /**
     * Finds rules that modify cookie
     *
     * @param cookieName Cookie name
     * @param rules Matching rules
     * @return Modifying rules
     */
    private static lookupModifyingRules(cookieName: string, rules: NetworkRule[]): NetworkRule[] {
        const result = [];
        if (rules && rules.length > 0) {
            for (let i = 0; i < rules.length; i += 1) {
                const rule = rules[i];
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
     * Finds header object by header name (case insensitive)
     *
     * @param headers Headers collection
     * @param headerName Header name
     * @returns header
     */
    private static findHeaderByName(headers: Header[], headerName: string): Header | null {
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
}
