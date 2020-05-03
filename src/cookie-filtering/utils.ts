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
