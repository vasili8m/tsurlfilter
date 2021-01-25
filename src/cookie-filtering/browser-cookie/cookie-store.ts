import { BrowserCookie } from './browser-cookie';
import { CookieApi, OnChangedCause } from './cookie-api';

/**
 * Cookie store interface
 * As chrome.cookies.getAll returns a huge set of entries, we need a lazy wrapper
 */
export interface ICookieStore {
    /**
     * Returns set of cookies for specified domain
     * @param domain
     */
    getCookies(domain: string): Promise<BrowserCookie[]>;

    /**
     * Updates cookie
     * @param cookie
     */
    updateCookie(cookie: BrowserCookie): Promise<void>;

    /**
     * Removes cookie
     * @param cookie
     */
    removeCookie(cookie: BrowserCookie): Promise<void>;

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

/**
 * Cookie store
 * contains cache of cookies
 * listens to onChanged event
 */
export class CookieStore implements ICookieStore {
    private cookieApi: CookieApi;

    /**
     * Cache
     */
    private cookiesMap = new Map<string, BrowserCookie[]>();

    /**
     * On changed callback
     */
    private onChangedCallback: ((changeInfo: {
        removed: boolean;
        cookie: BrowserCookie;
        cause: OnChangedCause;
    }) => void) | null = null;

    /**
     * Constructor
     * @param cookieApi
     */
    constructor(cookieApi: CookieApi) {
        this.cookieApi = cookieApi;

        this.cookieApi.setOnChangedListener(this.onChangedListener.bind(this));
    }

    async getCookies(domain: string): Promise<BrowserCookie[]> {
        let cookies = this.cookiesMap.get(domain);
        if (!cookies) {
            cookies = await this.cookieApi.getDomainCookies(domain);
            this.cookiesMap.set(domain, cookies);
        }

        return cookies;
    }

    async updateCookie(cookie: BrowserCookie): Promise<void> {
        this.cookieApi.modifyCookie(cookie, BrowserCookie.createCookieUrl(cookie));
        await this.update(cookie);
    }

    async removeCookie(cookie: BrowserCookie): Promise<void> {
        this.cookieApi.removeCookie(cookie.name, BrowserCookie.createCookieUrl(cookie));
        await this.remove(cookie);
    }

    private async update(cookie: BrowserCookie): Promise<void> {
        const domainCookies = await this.getCookies(cookie.domain!);
        const cookies = domainCookies.filter((c) => c.name !== cookie.name);
        cookies.push(cookie);

        this.cookiesMap.set(cookie.domain!, cookies);
    }

    private async remove(cookie: BrowserCookie): Promise<void> {
        const domainCookies = await this.getCookies(cookie.domain!);
        const cookies = domainCookies.filter((c) => c.name !== cookie.name);

        this.cookiesMap.set(cookie.domain!, cookies);
    }

    setOnChangedListener(
        callback: (changeInfo: { removed: boolean; cookie: BrowserCookie; cause: OnChangedCause }) => void,
    ): void {
        this.onChangedCallback = callback;
    }

    private async onChangedListener(
        changeInfo: {removed: boolean; cookie: BrowserCookie; cause: OnChangedCause},
    ): Promise<void> {
        if (this.onChangedCallback) {
            this.onChangedCallback(changeInfo);
        }

        if (changeInfo.removed) {
            await this.remove(changeInfo.cookie);
        } else {
            await this.update(changeInfo.cookie);
        }
    }
}
