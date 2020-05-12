import { Cookie } from './cookie';
import { BrowserCookie } from './browser-cookie';

/**
 * Helper methods for parsing and extracting browser cookies from headers (both Set-Cookie and Cookie).
 *
 * Heavily inspired by https://github.com/nfriedly/set-cookie-parser and https://github.com/jshttp/cookie
 */
export default class CookieUtils {
    /**
     * Parses "Set-Cookie" header value and returns a cookie object with its properties
     *
     * @param setCookieValue "Set-Cookie" header value to parse
     * @returns cookie object or null if it failed to parse the value
     */
    public static parseSetCookie(setCookieValue: string): Cookie | null {
        if (!setCookieValue) {
            return null;
        }

        const parts = setCookieValue.split(';').filter((s) => !!s);
        const nameValuePart = parts.shift();
        const nameValue = nameValuePart!.split('=');
        const name = nameValue.shift();
        // everything after the first =, joined by a "=" if there was more than one part
        const value = nameValue.join('=');

        return new Cookie(name!, value);
    }

    /**
     * Updates cookie maxAge value
     *
     * @param browserCookie Cookie to modify
     * @param maxAge
     * @return if cookie was modified
     */
    public static updateCookieMaxAge(browserCookie: BrowserCookie, maxAge: number): boolean {
        const currentTimeSec = Date.now() / 1000;

        let cookieExpiresTimeSec = null;
        if (browserCookie.maxAge) {
            cookieExpiresTimeSec = currentTimeSec + browserCookie.maxAge;
        } else if (browserCookie.expires) {
            cookieExpiresTimeSec = browserCookie.expires.getTime() / 1000;
        }

        const newCookieExpiresTimeSec = currentTimeSec + maxAge;
        if (cookieExpiresTimeSec === null || cookieExpiresTimeSec > newCookieExpiresTimeSec) {
            if (browserCookie.expires) {
                // eslint-disable-next-line no-param-reassign
                browserCookie.expires = new Date(newCookieExpiresTimeSec * 1000);
            }

            // eslint-disable-next-line no-param-reassign
            browserCookie.maxAge = maxAge;

            return true;
        }

        return false;
    }
}
