import { Cookie } from './cookie';
import { BrowserCookie } from './browser-cookie';

/**
 * Helper methods for parsing and extracting browser cookies from headers (both Set-Cookie and Cookie).
 *
 * Heavily inspired by https://github.com/nfriedly/set-cookie-parser and https://github.com/jshttp/cookie
 */
export default class CookieUtils {
    /**
     * Parse an HTTP Cookie header string and return an object with all cookie name-value pairs.
     *
     * @param cookieValue HTTP Cookie value
     * @returns Array of cookie name-value pairs
     */
    public static parseCookie(cookieValue: string): Cookie[] {
        const cookies: Cookie[] = [];

        // Split Cookie values
        const pairs = cookieValue.split(/; */);

        for (let i = 0; i < pairs.length; i += 1) {
            const pair = pairs[i];
            const eqIdx = pair.indexOf('=');

            // skip things that don't look like key=value
            if (eqIdx < 0) {
                continue;
            }

            const key = pair.substr(0, eqIdx).trim();
            const value = pair.substr(eqIdx + 1, pair.length).trim();

            cookies.push(new Cookie(key, value));
        }

        return cookies;
    }

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
            } else {
                // eslint-disable-next-line no-param-reassign
                browserCookie.maxAge = maxAge;
            }

            return true;
        }

        return false;
    }
}
