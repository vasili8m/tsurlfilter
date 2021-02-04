import {Cookies, WebRequest} from 'webextension-polyfill-ts';
import ParsedCookie from './parsed-cookie';
import HttpHeadersItemType = WebRequest.HttpHeadersItemType;
import HttpHeaders = WebRequest.HttpHeaders;
import Cookie = Cookies.Cookie;

/**
 * Utils
 */
export default class CookieUtils {
    /**
     * Parses set-cookie headers for cookie objects
     *
     * @param responseHeaders
     * @returns array of parsed cookies
     */
    static parseSetCookieHeaders(responseHeaders: HttpHeadersItemType[]): ParsedCookie[] {
        const result = [];
        let iResponseHeaders = responseHeaders.length;
        while (iResponseHeaders > 0) {
            iResponseHeaders -= 1;
            const header = responseHeaders[iResponseHeaders];
            if (!header.name || header.name.toLowerCase() !== 'set-cookie') {
                continue;
            }

            if (!header.value) {
                continue;
            }

            const setCookie = CookieUtils.parseSetCookie(header.value);
            if (!setCookie) {
                continue;
            }

            result.push(setCookie);
        }

        return result;
    }

    /**
     * Finds header object by header name (case insensitive)
     *
     * @param headers Headers collection
     * @param headerName Header name
     * @returns header value
     */
    static findHeaderByName(headers: HttpHeaders, headerName: string): HttpHeadersItemType | null {
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
     * Parse an HTTP Cookie header string and return an object with all cookie name-value pairs.
     *
     * @param cookieValue HTTP Cookie value
     * @returns Array of cookie name-value pairs
     */
    static parseCookies(cookieValue: string): ParsedCookie[] {
        const cookies = [];

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

            cookies.push(new ParsedCookie(key, value));
        }

        return cookies;
    }

    /**
     * Parses "Set-Cookie" header value and returns a cookie object with its properties
     *
     * @param setCookieValue "Set-Cookie" header value to parse
     * @returns cookie object or null if it failed to parse the value
     */
    static parseSetCookie(setCookieValue: string): ParsedCookie | null {
        const parts = setCookieValue.split(';').filter((s) => !!s);
        const nameValuePart = parts.shift();
        if (!nameValuePart) {
            return null;
        }

        const nameValue = nameValuePart.split('=');
        const name = nameValue.shift();
        // everything after the first =, joined by a "=" if there was more than one part
        const value = nameValue.join('=');
        const cookie = new ParsedCookie(name!, value);

        parts.forEach((part) => {
            const sides = part.split('=');
            const key = sides
                .shift()!
                .trimLeft()
                .toLowerCase();
            const optionValue = sides.join('=');
            if (key === 'expires') {
                cookie.expires = new Date(optionValue);
            } else if (key === 'max-age') {
                cookie.maxAge = parseInt(optionValue, 10);
            } else if (key === 'secure') {
                cookie.secure = true;
            } else if (key === 'httponly') {
                cookie.httpOnly = true;
            } else if (key === 'samesite') {
                cookie.sameSite = optionValue;
            }
        });

        return cookie;
    }

    /**
     * Updates cookie maxAge value
     *
     * @param browserCookie Cookie to modify
     * @param maxAge
     * @return if cookie was modified
     */
    public static updateCookieMaxAge(browserCookie: Cookie, maxAge: number): boolean {
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
