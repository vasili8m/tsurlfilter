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
    private cookiesMap = new Map<string, BrowserCookie[]>();

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

        const domainCookies = await this.getCookies(cookie.domain!);
        const cookies = domainCookies.filter((c) => c.name !== cookie.name);
        cookies.push(cookie);

        this.cookiesMap.set(cookie.domain!, cookies);
    }

    async removeCookie(cookie: BrowserCookie): Promise<void> {
        this.cookieApi.removeCookie(cookie.name, BrowserCookie.createCookieUrl(cookie));

        const domainCookies = await this.getCookies(cookie.domain!);
        const cookies = domainCookies.filter((c) => c.name !== cookie.name);

        this.cookiesMap.set(cookie.domain!, cookies);
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
