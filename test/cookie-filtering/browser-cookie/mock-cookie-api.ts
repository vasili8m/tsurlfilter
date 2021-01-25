/* eslint-disable max-classes-per-file,max-len */
import { CookieApi, OnChangedCause } from '../../../src/cookie-filtering/browser-cookie/cookie-api';
import { BrowserCookie } from '../../../src/cookie-filtering/browser-cookie/browser-cookie';

/**
 * Mock cookie manager
 */
export class MockCookieApi implements CookieApi {
    private cookies: BrowserCookie[] = [];

    private onChanged: (changeInfo: { removed: boolean; cookie: BrowserCookie; cause: OnChangedCause }) => void = () => {};

    modifyCookie = jest.fn((): void => {
        // Do nothing
    });

    removeCookie = jest.fn((): void => {
        // Do nothing
    });

    getCookies = jest.fn((): BrowserCookie[] => this.cookies);

    getDomainCookies = jest.fn((domain: string): BrowserCookie[] => this.cookies.filter((c) => c.domain === domain));

    setOnChangedListener(cb: (changeInfo: { removed: boolean; cookie: BrowserCookie; cause: OnChangedCause }) => void): void {
        this.onChanged = cb;
    }

    /**
     * Set mock cookies
     *
     * @param cookies
     */
    setCookies(cookies: BrowserCookie[]): void {
        this.cookies = cookies;
    }

    /**
     * Trigger mock on changed
     *
     * @param cookie
     * @param removed
     */
    async triggerOnChanged(cookie: BrowserCookie, removed: boolean): Promise<void> {
        await this.onChanged({
            removed,
            cookie,
            cause: OnChangedCause.Explicit,
        });
    }
}
