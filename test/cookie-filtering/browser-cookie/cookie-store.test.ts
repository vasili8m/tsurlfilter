/* eslint-disable max-classes-per-file,max-len */
import { CookieStore } from '../../../src/cookie-filtering/browser-cookie/cookie-store';
import { BrowserCookie } from '../../../src/cookie-filtering/browser-cookie/browser-cookie';
import { CookieApi, OnChangedCause } from '../../../src/cookie-filtering/browser-cookie/cookie-api';

/**
 * Mock cookie manager
 */
class MockCookieManager implements CookieApi {
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

const createTestCookie = (): BrowserCookie => {
    const testCookie = new BrowserCookie('test_name', 'test_value');
    testCookie.domain = 'example.org';

    return testCookie;
};

describe('Cookie Store Tests', () => {
    it('checks general functionality', async () => {
        const cookieManager = new MockCookieManager();
        cookieManager.setCookies([createTestCookie()]);
        const store = new CookieStore(cookieManager);

        const empty = await store.getCookies('an-other-domain.com');
        expect(empty).toHaveLength(0);

        const testCookie = createTestCookie();
        let cookies = await store.getCookies(testCookie.domain!);
        expect(cookies).toHaveLength(1);
        expect(cookies[0].name).toBe(testCookie.name);
        expect(cookies[0].value).toBe(testCookie.value);

        testCookie.value = 'updated';
        await store.updateCookie(testCookie);
        expect(cookieManager.modifyCookie).toHaveBeenLastCalledWith({
            name: testCookie.name, value: testCookie.value, domain: testCookie.domain,
        }, 'http://example.org');

        cookies = await store.getCookies(testCookie.domain!);
        expect(cookies).toHaveLength(1);
        expect(cookies[0].name).toBe(testCookie.name);
        expect(cookies[0].value).toBe(testCookie.value);

        await store.removeCookie(testCookie);
        expect(cookieManager.removeCookie).toHaveBeenLastCalledWith(testCookie.name, 'http://example.org');

        cookies = await store.getCookies(testCookie.domain!);
        expect(cookies).toHaveLength(0);
    });

    it('checks onChanged listener', async () => {
        const cookieManager = new MockCookieManager();
        cookieManager.setCookies([createTestCookie()]);
        const store = new CookieStore(cookieManager);

        const testCookie = createTestCookie();
        let cookies = await store.getCookies(testCookie.domain!);
        expect(cookies).toHaveLength(1);
        expect(cookies[0].name).toBe(testCookie.name);
        expect(cookies[0].value).toBe(testCookie.value);

        testCookie.value = 'updated';
        await cookieManager.triggerOnChanged(testCookie, false);
        cookies = await store.getCookies(testCookie.domain!);
        expect(cookies).toHaveLength(1);
        expect(cookies[0].name).toBe(testCookie.name);
        expect(cookies[0].value).toBe(testCookie.value);

        await cookieManager.triggerOnChanged(testCookie, true);
        cookies = await store.getCookies(testCookie.domain!);
        expect(cookies).toHaveLength(0);
    });
});
