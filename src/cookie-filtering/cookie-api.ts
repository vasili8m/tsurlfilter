import { BrowserCookie } from './browser-cookie';

/**
 * The underlying reason behind the cookie's change.
 * If a cookie was inserted, or removed via an explicit call to "chrome.cookies.remove", "cause" will be "explicit".
 * If a cookie was automatically removed due to expiry, "cause" will be "expired".
 * If a cookie was removed due to being overwritten with an already-expired expiration date,
 * "cause" will be set to "expired_overwrite".
 * If a cookie was automatically removed due to garbage collection, "cause" will be "evicted".
 * If a cookie was automatically removed due to a "set" call that overwrote it, "cause" will be "overwrite".
 */
export enum OnChangedCause {
    Evicted = 'evicted',
    Expired = 'expired',
    Explicit = 'explicit',
    ExpiredOverwrite = 'expired_overwrite',
    Overwrite = 'overwrite'
}

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

    /**
     * Fired when a cookie is set or removed.
     * As a special case, note that updating a cookie's properties is implemented as a two step process:
     * the cookie to be updated is first removed entirely, generating a notification with "cause" of "overwrite" .
     * Afterwards, a new cookie is written with the updated values,
     * generating a second notification with "cause" "explicit".
     * @param callback
     */
    setOnChangedListener(
        callback: (changeInfo: {
            removed: boolean;
            cookie: BrowserCookie;
            cause: OnChangedCause;
        }) => void
    ): void;
}
