import { CookieStore } from '../../../src/cookie-filtering/browser-cookie/cookie-store';
import { BrowserCookie } from '../../../src/cookie-filtering/browser-cookie/browser-cookie';
import { MockCookieApi } from './mock-cookie-api';

const createTestCookie = (): BrowserCookie => new BrowserCookie('test_name', 'test_value', 'example.org');

describe('Cookie Store Tests', () => {
    it('checks general functionality', async () => {
        const cookieManager = new MockCookieApi();
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
        const cookieManager = new MockCookieApi();
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
