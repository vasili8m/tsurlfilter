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
        const update = {
            url,
            name: apiCookie.name,
            value: apiCookie.value,
            domain: apiCookie.domain,
            path: apiCookie.path,
            secure: apiCookie.secure,
            httpOnly: apiCookie.httpOnly,
            sameSite: apiCookie.sameSite,
            expirationDate: apiCookie.expirationDate,
        };
        /**
         * Removes domain for host-only cookies:
         * https://developer.chrome.com/extensions/cookies#method-set
         * The domain of the cookie. If omitted, the cookie becomes a host-only cookie.
         */
        if (apiCookie.hostOnly) {
            delete update.domain;
        }

        return new Promise((resolve) => {
            this.browser.cookies.set(update, () => {
                const ex = this.browser.runtime.lastError;
                if (ex) {
                    console.error(`Error update cookie ${apiCookie.name} - ${url}: ${ex}`);
                }
                resolve();
            });
        });
    }

    /**
     * Get cookies
     *
     * @param name
     * @param url
     * @return {Array<BrowserApiCookie>}
     */
    async getCookies(name, url) {
        return this.apiGetCookies(name, url);
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
                    console.error(`Error remove cookie ${name} - ${url}: ${ex}`);
                }
                resolve();
            });
        });
    }

    /**
     * Get all cookies by name and url
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
