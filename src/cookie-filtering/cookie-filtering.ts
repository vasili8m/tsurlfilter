import { Request } from '../request';
import { FilteringLog } from '../filtering-log';
import { NetworkRule, NetworkRuleOption } from '../rules/network-rule';
import CookieUtils from './utils';
import { CookieModifier } from '../modifiers/cookie-modifier';
import { BrowserCookie } from './browser-cookie/browser-cookie';
import { CookieApi, OnChangedCause } from './browser-cookie/cookie-api';
import { CookieStore, ICookieStore } from './browser-cookie/cookie-store';
import { CookieJournal } from './cookie-journal';
import { RulesFinder } from './rules-finder';

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
 *
 * onCookieChanged:
 * - get third-party flag for updated cookie
 * - get rules for cookie
 * - apply rules
 *
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
    modifyCookies(request: Request, cookieRules: NetworkRule[]): Promise<void>;

    /**
     * Filters blocking first-party rules
     *
     * @param rules
     */
    getBlockingRules(rules: NetworkRule[]): NetworkRule[];

    /**
     * On cookie changed handler
     *
     * - check if cookie has been handled already
     * - get third-party flag for updated cookie
     * - get rules for cookie
     * - apply rules
     *
     * @param changeInfo
     */
    onCookieChanged(changeInfo: {
        removed: boolean;
        cookie: BrowserCookie;
        cause: OnChangedCause;
    }): void;
}

/**
 * Cookie filtering module implementation
 */
export class CookieFiltering implements ICookieFiltering {
    /**
     * Cookie store
     */
    private cookieStore: ICookieStore;

    /**
     * Filtering log
     */
    private filteringLog: FilteringLog;

    /**
     * Cookie journal
     */
    private journal: CookieJournal;

    /**
     * Cookie rules finder implementation
     */
    private rulesFinder: RulesFinder;

    /**
     * Constructor
     *
     * @param cookieManager
     * @param filteringLog
     * @param rulesFinder
     */
    constructor(cookieManager: CookieApi, filteringLog: FilteringLog, rulesFinder: RulesFinder) {
        this.cookieStore = new CookieStore(cookieManager);
        this.filteringLog = filteringLog;
        this.journal = new CookieJournal();
        this.rulesFinder = rulesFinder;

        this.cookieStore.setOnChangedListener(this.onCookieChanged.bind(this));
    }

    /**
     * On cookie changed handler
     *
     * - check if cookie has been handled already
     * - get third-party flag for updated cookie
     * - get rules for cookie
     * - apply rules
     *
     * @param changeInfo
     */
    public onCookieChanged(changeInfo: {
        removed: boolean;
        cookie: BrowserCookie;
        cause: OnChangedCause;
    }): void {
        const { cookie } = changeInfo;

        if (changeInfo.removed) {
            this.journal.remove(cookie);
            // Skip removed cookies
            return;
        }

        if (this.journal.isProcessed(cookie)) {
            this.journal.remove(cookie);
            /**
             * This cookie has been handled already
             * We don't process it again cause:
             * - in case page restores it, we will stuck here
             * - we don't want to store dead records
             */
            return;
        }

        const cookieUrl = BrowserCookie.createCookieUrl(cookie);
        const isThirdParty = this.journal.isThirdParty(cookie);
        const cookieRules = this.rulesFinder.getRulesForCookie(cookieUrl, isThirdParty);

        this.applyRulesToCookie(cookieUrl, cookie, isThirdParty, cookieRules, undefined);

        this.journal.setProcessed(cookie);
    }

    /**
     * Parses response header set-cookie.
     * Saves cookie third-party flag
     *
     * @param request
     * @param responseHeaders Response headers
     */
    public processResponseHeaders(request: Request, responseHeaders: Header[]): void {
        const { thirdParty, domain } = request;

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

            this.journal.setThirdParty(setCookie.name, domain, !!thirdParty);
        }
    }

    /**
     * Modifies cookies with browser.api
     *
     * @param request Request
     * @param cookieRules rules
     */
    public async modifyCookies(request: Request, cookieRules: NetworkRule[]): Promise<void> {
        const { url, tabId } = request;

        const cookies = await this.cookieStore.getCookies(request.domain);

        const promises = await cookies.map(async (cookie) => {
            const isThirdParty = this.journal.isThirdParty(cookie);
            // The cookie is also considered as third-party if it was not present in request headers,
            // therefore it is not present in journal
            await this.applyRulesToCookie(url, cookie, isThirdParty, cookieRules, tabId!);

            this.journal.setProcessed(cookie);
        });

        await Promise.all(promises);
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
    private async applyRulesToCookie(
        url: string,
        cookie: BrowserCookie,
        isThirdPartyCookie: boolean,
        cookieRules: NetworkRule[],
        tabId: number | undefined,
    ): Promise<void> {
        const cookieName = cookie.name;

        const bRule = CookieFiltering.lookupNotModifyingRule(cookieName, cookieRules, isThirdPartyCookie);
        if (bRule) {
            await this.cookieStore.removeCookie(cookie);
            this.filteringLog.addCookieEvent(tabId, cookie.name, [bRule]);
            return;
        }

        const mRules = CookieFiltering.lookupModifyingRules(cookieName, cookieRules, isThirdPartyCookie);
        if (mRules.length > 0) {
            const appliedRules = CookieFiltering.applyRuleToBrowserCookie(cookie, mRules);
            if (appliedRules.length > 0) {
                await this.cookieStore.updateCookie(cookie);
                this.filteringLog.addCookieEvent(tabId, cookie.name, appliedRules);
            }
        }
    }

    /**
     * Modifies instance of BrowserCookie with provided rules
     *
     * @param cookie Cookie modify
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
}
