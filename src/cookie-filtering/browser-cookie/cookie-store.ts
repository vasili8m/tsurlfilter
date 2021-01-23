import { BrowserCookie } from './browser-cookie';
import { CookieApi, OnChangedCause } from './cookie-api';

/**
 * Cookie store interface
 * As chrome.cookies.getAll returns a huge set of entries, we need a lazy wrapper
 */
interface ICookieStore {
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

    // TODO: Probably we will need an other onChanged here to pass it in cookie-filtering?
}

/**
 * Cookie store
 * contains cache of cookies
 * listens to onChanged event
 * TODO: Use in cookie-filtering
 */
export class CookieStore implements ICookieStore {
    private cookieApi: CookieApi;

    /**
     * Cache
     */
    private cookies: BrowserCookie[]|null = null;

    /**
     * Constructor
     * @param cookieApi
     */
    constructor(cookieApi: CookieApi) {
        this.cookieApi = cookieApi;

        this.cookieApi.setOnChangedListener(this.onChangedListener.bind(this));
    }

    async getCookies(domain: string): Promise<BrowserCookie[]> {
        if (!this.cookies) {
            this.cookies = await this.cookieApi.getAllCookies();
        }

        return this.cookies!.filter((x) => x.domain === domain);
    }

    async updateCookie(cookie: BrowserCookie): Promise<void> {
        const domainCookies = await this.getCookies(cookie.domain!);
        const toRemove = domainCookies.filter((c) => c.name === cookie.name);

        this.cookies = this.cookies!.filter((c) => !toRemove.includes(c));
        this.cookies.push(cookie);
        this.cookieApi.modifyCookie(cookie, BrowserCookie.createCookieUrl(cookie));
    }

    async removeCookie(cookie: BrowserCookie): Promise<void> {
        const domainCookies = await this.getCookies(cookie.domain!);
        const toRemove = domainCookies.filter((c) => c.name === cookie.name);

        this.cookies = this.cookies!.filter((c) => !toRemove.includes(c));
        this.cookieApi.removeCookie(cookie.name, BrowserCookie.createCookieUrl(cookie));
    }

    private async onChangedListener(
        changeInfo: {removed: boolean; cookie: BrowserCookie; cause: OnChangedCause},
    ): Promise<void> {
        if (changeInfo.removed) {
            await this.removeCookie(changeInfo.cookie);
        } else {
            await this.updateCookie(changeInfo.cookie);
        }
    }
}
