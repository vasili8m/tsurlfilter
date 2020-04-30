import { CookieApi, CookieFiltering } from '../../src/cookie-filtering/cookie-filtering';
import { MockFilteringLog } from '../mock-filtering-log';
import { NetworkRule, Request, RequestType } from '../../src';
import { BrowserCookie } from '../../src/cookie-filtering/browser-cookie';

const createTestRequest = (requestId: number): Request => {
    const request = new Request('https://example.org', '', RequestType.Document);
    request.requestId = requestId;

    return request;
};

const createTestRequestHeaders = (cookieHeader: {name: string;value: string}): {name: string;value: string}[] => [
    { name: 'Header One', value: 'Header Value One' },
    cookieHeader,
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

        const cookieHeader = { name: 'Cookie', value: '_octo=GH1.1.635223982.1507661197; logged_in=yes; c_user=test;' };
        const headers = createTestRequestHeaders(cookieHeader);
        const modifiedRequest = cookieFiltering.processRequestHeaders(request, headers, rules);
        expect(modifiedRequest).toBeTruthy();
        expect(headers).toContain(cookieHeader);
        expect(cookieHeader.value).toBe('_octo=GH1.1.635223982.1507661197; logged_in=yes');

        cookieManager.setCookies([new BrowserCookie('c_user', 'test')]);
        cookieFiltering.modifyCookies(request.requestId!);
        expect(cookieManager.removeCookie).toHaveBeenLastCalledWith('c_user', 'https://example.org');
    });

    it('checks modifying rule - max age', () => {
        const request = createTestRequest(1);
        const cookieOptionText = '__cfduid;maxAge=15;sameSite=lax';
        const rules = [
            new NetworkRule(`$cookie=${cookieOptionText}`, 1),
        ];

        const cookieHeader = { name: 'Cookie', value: '__cfduid=test_value; logged_in=yes;' };
        const headers = createTestRequestHeaders(cookieHeader);
        const modifiedRequest = cookieFiltering.processRequestHeaders(request, headers, rules);
        expect(modifiedRequest).toBeFalsy();
        expect(headers).toContain(cookieHeader);
        expect(cookieHeader.value).toBe('__cfduid=test_value; logged_in=yes;');

        cookieManager.setCookies(
            [
                new BrowserCookie('an_other', 'test_value'),
                new BrowserCookie('__cfduid', 'test_value'),
            ],
        );
        cookieFiltering.modifyCookies(request.requestId!);
        expect(cookieManager.modifyCookie).toHaveBeenLastCalledWith({
            maxAge: 15, name: '__cfduid', sameSite: 'lax', value: 'test_value',
        }, 'https://example.org');

        cookieManager.setCookies([new BrowserCookie('an_other', 'test_value')]);
        cookieFiltering.modifyCookies(request.requestId!);

        cookieFiltering.processRequestHeaders(request, headers, rules);
        let browserCookie = new BrowserCookie('some_cookie', 'test_value');
        browserCookie.expires = new Date(Date.parse('06 Nov 1999'));
        cookieManager.setCookies([browserCookie]);
        cookieFiltering.modifyCookies(request.requestId!);
        expect(cookieManager.modifyCookie).toHaveBeenLastCalledWith({
            expires: new Date('1999-11-05T22:00:00.000Z'), name: 'some_cookie', sameSite: 'lax', value: 'test_value',
        }, 'https://example.org');

        cookieFiltering.processRequestHeaders(request, headers, rules);
        browserCookie = new BrowserCookie('some_cookie', 'test_value');
        browserCookie.expires = new Date(Date.parse('06 Nov 2099'));
        cookieManager.setCookies([browserCookie]);
        cookieFiltering.modifyCookies(request.requestId!);

        cookieFiltering.processRequestHeaders(request, headers, rules);
        browserCookie = new BrowserCookie('some_cookie', 'test_value');
        browserCookie.maxAge = 100;
        cookieManager.setCookies([browserCookie]);
        cookieFiltering.modifyCookies(request.requestId!);
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

        const cookieHeader = { name: 'Cookie', value: '__cfduid=test_value; logged_in=yes;' };
        const headers = createTestRequestHeaders(cookieHeader);
        const modifiedRequest = cookieFiltering.processRequestHeaders(request, headers, rules);
        expect(modifiedRequest).toBeFalsy();
        expect(headers).toContain(cookieHeader);
        expect(cookieHeader.value).toBe('__cfduid=test_value; logged_in=yes;');

        cookieManager.setCookies([new BrowserCookie('__cfduid', 'test_value')]);
        cookieFiltering.modifyCookies(request.requestId!);
        expect(cookieManager.modifyCookie).toHaveBeenLastCalledWith({
            name: '__cfduid', sameSite: 'lax', value: 'test_value',
        }, 'https://example.org');

        const browserCookie = new BrowserCookie('__cfduid', 'test_value');
        browserCookie.sameSite = 'lax';
        cookieManager.setCookies([browserCookie]);
        cookieFiltering.processRequestHeaders(request, headers, rules);
        cookieFiltering.modifyCookies(request.requestId!);
        expect(cookieManager.modifyCookie).toHaveBeenLastCalledWith({
            name: '__cfduid', sameSite: 'lax', value: 'test_value',
        }, 'https://example.org');
    });

    it('checks weird cases', () => {
        const request = createTestRequest(1);
        const rules = [
            new NetworkRule('||example.org^$cookie=c_user', 1),
        ];

        const cookieHeader = { name: 'Smth-else', value: '' };
        const headers = createTestRequestHeaders(cookieHeader);

        expect(cookieFiltering.processRequestHeaders(request, headers, rules)).toBeFalsy();
        // One more time
        expect(cookieFiltering.processRequestHeaders(request, headers, rules)).toBeFalsy();
        // No rules
        expect(cookieFiltering.processRequestHeaders(request, headers, [])).toBeFalsy();
        // No headers
        expect(cookieFiltering.processRequestHeaders(request, [], rules)).toBeFalsy();
        // Wrong header
        expect(cookieFiltering.processRequestHeaders(request, [{ name: 'Cookie', value: '' }], rules)).toBeFalsy();

        // Wrong request
        cookieFiltering.modifyCookies(request.requestId! + 100);
    });
});
