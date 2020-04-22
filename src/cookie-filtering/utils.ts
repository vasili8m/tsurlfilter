/* eslint-disable prefer-template */
import { Cookie } from './cookie';
import { CookieHeader } from './cookie-header';

/**
 * Helper methods for parsing and extracting browser cookies from headers (both Set-Cookie and Cookie).
 *
 * Heavily inspired by https://github.com/nfriedly/set-cookie-parser and https://github.com/jshttp/cookie
 */
export default class CookieUtils {
    /**
     * RegExp to match field-content in RFC 7230 sec 3.2
     *
     * field-content = field-vchar [ 1*( SP / HTAB ) field-vchar ]
     * field-vchar   = VCHAR / obs-text
     * obs-text      = %x80-FF
     */
    // eslint-disable-next-line no-control-regex
    private static FIELD_CONTENT_REGEX = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;

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
    public static parseSetCookie(setCookieValue: string): CookieHeader | null {
        if (!setCookieValue) {
            return null;
        }

        const parts = setCookieValue.split(';').filter((s) => !!s);
        const nameValuePart = parts.shift();
        const nameValue = nameValuePart!.split('=');
        const name = nameValue.shift();
        // everything after the first =, joined by a "=" if there was more than one part
        const value = nameValue.join('=');
        const cookie = new CookieHeader(name!, value);

        parts.forEach((part) => {
            const sides = part.split('=');
            const key = sides!.shift()!.trimLeft().toLowerCase();
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
            } else if (key === 'path') {
                cookie.path = optionValue;
            }
        });

        return cookie;
    }

    /**
     * Serializes cookie data into a string suitable for Set-Cookie header.
     *
     * @param cookie A cookie object
     * @return Set-Cookie string or null if it failed to serialize object
     * @throws Thrown in case of invalid input data
     */
    public static serialize(cookie: CookieHeader): string {
        // 1. Validate fields
        if (!CookieUtils.FIELD_CONTENT_REGEX.test(cookie.name)) {
            throw new TypeError(`Cookie name is invalid: ${cookie.name}`);
        }
        if (cookie.value && !CookieUtils.FIELD_CONTENT_REGEX.test(cookie.value)) {
            throw new TypeError(`Cookie value is invalid: ${cookie.value}`);
        }
        if (cookie.domain && !CookieUtils.FIELD_CONTENT_REGEX.test(cookie.domain)) {
            throw new TypeError(`Cookie domain is invalid: ${cookie.domain}`);
        }
        if (cookie.path && !CookieUtils.FIELD_CONTENT_REGEX.test(cookie.path)) {
            throw new TypeError(`Cookie path is invalid: ${cookie.path}`);
        }

        // 2. Build Set-Cookie header value
        let setCookieValue = `${cookie.name}=${cookie.value}`;

        if (typeof cookie.maxAge === 'number' && !Number.isNaN(cookie.maxAge)) {
            setCookieValue += '; Max-Age=' + Math.floor(cookie.maxAge);
        }
        if (cookie.domain) {
            setCookieValue += '; Domain=' + cookie.domain;
        }
        if (cookie.path) {
            setCookieValue += '; Path=' + cookie.path;
        }
        if (cookie.expires) {
            setCookieValue += '; Expires=' + cookie.expires.toUTCString();
        }
        if (cookie.httpOnly) {
            setCookieValue += '; HttpOnly';
        }
        if (cookie.secure) {
            setCookieValue += '; Secure';
        }
        if (cookie.sameSite) {
            const sameSite = cookie.sameSite.toLowerCase();

            switch (sameSite) {
                case 'lax':
                    setCookieValue += '; SameSite=Lax';
                    break;
                case 'strict':
                    setCookieValue += '; SameSite=Strict';
                    break;
                case 'none':
                    setCookieValue += '; SameSite=None';
                    break;
                default:
                    throw new TypeError(`Cookie sameSite is invalid: ${cookie.sameSite}`);
            }
        }

        // Don't affected. Let it be here just in case
        // https://bugs.chromium.org/p/chromium/issues/detail?id=232693
        if (cookie.priority) {
            setCookieValue += `; Priority=${cookie.priority}`;
        }

        return setCookieValue;
    }
}
