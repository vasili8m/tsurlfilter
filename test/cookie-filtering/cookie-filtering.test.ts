import { CookieFiltering } from '../../src/cookie-filtering/cookie-filtering';
import { MockFilteringLog } from '../mock-filtering-log';
import { NetworkRule, Request, RequestType } from '../../src';
import { BrowserCookie } from '../../src/cookie-filtering/browser-cookie';
import { CookieApi } from '../../src/cookie-filtering/cookie-api';

const createTestRequest = (requestId: number): Request => {
    const request = new Request('https://example.org', '', RequestType.Document);
    request.requestId = requestId;
    request.tabId = 1;

    return request;
};

const createTestHeaders = (setCookieHeaders: {name: string;value: string}[]): {name: string;value: string}[] => [
    { name: 'Header One', value: 'Header Value One' },
    ...setCookieHeaders,
];

/**
 * Mock cookie manager
 */
class CookieManager implements CookieApi {
    modifyCookie = jest.fn((): void => {
        // Do nothing
    });

    removeCookie = jest.fn((): void => {
        // Do nothing
    });

    getCookies = jest.fn((): BrowserCookie[] => this.cookies);

    private cookies: BrowserCookie[] = [];

    /**
     * Set mock cookies
     *
     * @param cookies
     */
    setCookies(cookies: BrowserCookie[]): void {
        this.cookies = cookies;
    }
}

describe('Cookie filtering', () => {
    const cookieManager = new CookieManager();
    const cookieFiltering = new CookieFiltering(cookieManager, new MockFilteringLog());

    it('checks remove rule', () => {
        const request = createTestRequest(1);
        const rules = [
            new NetworkRule('||example.org^$cookie=c_user', 1),
        ];

        // const setCookieHeader = { name: 'set-cookie', value: 'c_user=test;' };
        const responseHeaders = createTestHeaders([]);
        cookieFiltering.processResponseHeaders(request, responseHeaders);

        cookieManager.setCookies([new BrowserCookie('c_user', 'test')]);
        cookieFiltering.modifyCookies(request, rules);
        expect(cookieManager.removeCookie).toHaveBeenLastCalledWith('c_user', 'https://example.org');
    });

    it('checks modifying rule - max age', () => {
        const request = createTestRequest(1);
        const cookieOptionText = 'some_cookie;maxAge=15;sameSite=lax';
        const rules = [
            new NetworkRule(`$cookie=${cookieOptionText}`, 1),
        ];

        const responseHeaders = createTestHeaders([]);
        cookieFiltering.processResponseHeaders(request, responseHeaders);

        cookieManager.setCookies(
            [
                new BrowserCookie('an_other', 'test_value'),
                new BrowserCookie('some_cookie', 'test_value'),
            ],
        );
        cookieFiltering.modifyCookies(request, rules);
        expect(cookieManager.modifyCookie).toHaveBeenLastCalledWith({
            maxAge: 15, name: 'some_cookie', sameSite: 'lax', value: 'test_value',
        }, 'https://example.org');

        cookieManager.setCookies([new BrowserCookie('an_other', 'test_value')]);
        cookieFiltering.modifyCookies(request, rules);

        let browserCookie = new BrowserCookie('some_cookie', 'test_value');
        browserCookie.expires = new Date(Date.parse('06 Nov 1999'));
        cookieManager.setCookies([browserCookie]);
        cookieFiltering.modifyCookies(request, rules);
        expect(cookieManager.modifyCookie).toHaveBeenLastCalledWith({
            expires: new Date('1999-11-05T22:00:00.000Z'), name: 'some_cookie', sameSite: 'lax', value: 'test_value',
        }, 'https://example.org');

        browserCookie = new BrowserCookie('some_cookie', 'test_value');
        browserCookie.expires = new Date(Date.parse('06 Nov 2099'));
        cookieManager.setCookies([browserCookie]);
        cookieFiltering.modifyCookies(request, rules);

        browserCookie = new BrowserCookie('some_cookie', 'test_value');
        browserCookie.maxAge = 100;
        cookieManager.setCookies([browserCookie]);
        cookieFiltering.modifyCookies(request, rules);
        expect(cookieManager.modifyCookie).toHaveBeenLastCalledWith({
            maxAge: 15, name: 'some_cookie', sameSite: 'lax', value: 'test_value',
        }, 'https://example.org');
    });

    it('checks modifying rule - sameSite', () => {
        const request = createTestRequest(1);
        const cookieOptionText = '__cfduid;sameSite=lax';
        const rules = [
            new NetworkRule(`$cookie=${cookieOptionText}`, 1),
        ];

        cookieManager.setCookies([new BrowserCookie('__cfduid', 'test_value')]);
        cookieFiltering.modifyCookies(request, rules);
        expect(cookieManager.modifyCookie).toHaveBeenLastCalledWith({
            name: '__cfduid', sameSite: 'lax', value: 'test_value',
        }, 'https://example.org');

        const browserCookie = new BrowserCookie('__cfduid', 'test_value');
        browserCookie.sameSite = 'lax';
        cookieManager.setCookies([browserCookie]);
        cookieFiltering.modifyCookies(request, rules);
        expect(cookieManager.modifyCookie).toHaveBeenLastCalledWith({
            name: '__cfduid', sameSite: 'lax', value: 'test_value',
        }, 'https://example.org');
    });

    it('checks remove rule - third-party cases', () => {
        const request = new Request('https://example.org', 'https://source.org', RequestType.Document);
        expect(request.thirdParty).toBeTruthy();

        const rules = [
            new NetworkRule('||example.org^$cookie=c_user', 1),
            new NetworkRule('||example.org^$third-party,cookie=third_party_user', 1),
        ];

        const responseHeaders = createTestHeaders([]);
        cookieFiltering.processResponseHeaders(request, responseHeaders);

        // Cookie has not been marked as third-party
        cookieManager.setCookies([new BrowserCookie('third_party_user', 'test')]);
        cookieFiltering.modifyCookies(request, rules);

        // This is third-party cookie
        const setCookieHeader = [{ name: 'set-cookie', value: 'third_party_user=test;' }];
        cookieFiltering.processResponseHeaders(request, responseHeaders.concat(setCookieHeader));

        cookieManager.setCookies([new BrowserCookie('third_party_user', 'test')]);
        cookieFiltering.modifyCookies(request, rules);
        expect(cookieManager.removeCookie).toHaveBeenLastCalledWith('third_party_user', 'https://example.org');
    });
});
