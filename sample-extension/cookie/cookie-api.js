/* eslint-disable no-console */

/**
 * Cookie api implementation
 */
export class CookieApi {
    /**
     * Browser object
     */
    // eslint-disable-next-line no-undef
    browser = chrome;

    /**
     * Constructor
     *
     * @param browser
     */
    constructor(browser) {
        this.browser = browser;
    }

    /**
     * Sets onChanged event listener
     * @param callback
     */
    setOnChangedListener(callback) {
        this.browser.cookies.onChanged.addListener(callback);
    }

    /**
     * Removes cookie
     *
     * @param name
     * @param url
     */
    async removeCookie(name, url) {
        const cookies = await this.apiGetCookies(name, url);
        if (cookies.length > 0) {
            await this.apiRemoveCookie(name, url);
        }
    }

    /**
     * Updates cookie
     *
     * @param {BrowserApiCookie} apiCookie Cookie for update
     * @param {string} url Cookie url
     * @return {Promise<any>}
     */
    async modifyCookie(apiCookie, url) {
        const update = { url, ...apiCookie };
        /**
         * Removes domain for host-only cookies:
         * https://developer.chrome.com/extensions/cookies#method-set
         * The domain of the cookie. If omitted, the cookie becomes a host-only cookie.
         */
        if (apiCookie.hostOnly) {
            delete update.domain;
        }

        // Unsupported properties
        delete update.hostOnly;
        delete update.session;
        delete update.maxAge;

        return new Promise((resolve) => {
            this.browser.cookies.set(update, () => {
                const ex = this.browser.runtime.lastError;
                if (ex) {
                    console.error(`Error update cookie ${apiCookie.name} - ${url}: ${ex.message}`);
                }
                resolve();
            });
        });
    }

    /**
     * Get cookies
     *
     * @param url
     * @return {Array<BrowserApiCookie>}
     */
    async getCookies(url) {
        return this.apiGetCookies(undefined, url);
    }

    /**
     * Get domain cookies
     *
     * @param domain
     * @return {Array<BrowserApiCookie>}
     */
    async getDomainCookies(domain) {
        return new Promise((resolve) => {
            this.browser.cookies.getAll({
                domain,
            }, (cookies) => {
                resolve(cookies || []);
            });
        });
    }

    /**
     * Removes cookie
     *
     * @param {string} name Cookie name
     * @param {string} url Cookie url
     * @return {Promise<any>}
     */
    async apiRemoveCookie(name, url) {
        return new Promise((resolve) => {
            this.browser.cookies.remove({
                url,
                name,
            }, () => {
                const ex = this.browser.runtime.lastError;
                if (ex) {
                    console.error(`Error remove cookie ${name} - ${url}: ${ex.message}`);
                }
                resolve();
            });
        });
    }

    /**
     * Get all cookies by url
     *
     * @param {string} name Cookie name
     * @param {string} url Cookie url
     * @return {Promise<Array.<BrowserApiCookie>>} array of cookies
     */
    async apiGetCookies(name, url) {
        return new Promise((resolve) => {
            this.browser.cookies.getAll({
                name,
                url,
            }, (cookies) => {
                resolve(cookies || []);
            });
        });
    }
}
