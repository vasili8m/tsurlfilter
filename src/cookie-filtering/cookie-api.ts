import { BrowserCookie } from './browser-cookie';

/**
 * Cookie manager interface
 * Should be implemented with browser cookie api or smth similar
 * Used in CookieFiltering module
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
     * @param setCookie
     * @param url
     */
    modifyCookie(setCookie: BrowserCookie, url: string): void;

    /**
     * Fetch cookies
     *
     * @param url
     */
    getCookies(url: string): BrowserCookie[];
}
