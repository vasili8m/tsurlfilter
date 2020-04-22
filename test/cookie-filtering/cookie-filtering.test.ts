import { CookieApi, CookieFiltering } from '../../src/cookie-filtering/cookie-filtering';
import { MockFilteringLog } from '../mock-filtering-log';
import { NetworkRule, Request, RequestType } from '../../src';

const createTestRequest = (requestId: number): Request => {
    const request = new Request('https://example.org', '', RequestType.Document);
    request.requestId = requestId;

    return request;
};

const createTestRequestHeaders = (cookieHeader: {name: string;value: string}): {name: string;value: string}[] => [
    { name: 'Header One', value: 'Header Value One' },
    cookieHeader,
];

// eslint-disable-next-line max-len
const createTestResponseHeaders = (setCookieHeaders: {name: string;value: string}[]): {name: string;value: string}[] => [
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

        cookieFiltering.modifyCookies(request.requestId!);
        expect(cookieManager.removeCookie).toHaveBeenLastCalledWith('c_user', 'https://example.org');

        const setCookieHeader = { name: 'set-cookie', value: 'c_user=test;' };
        const responseHeaders = createTestResponseHeaders([setCookieHeader]);
        const modifierResponse = cookieFiltering.processResponseHeaders(request, responseHeaders, rules);
        expect(modifierResponse).toBeTruthy();
        expect(setCookieHeader.value).toBe('c_user=test; Max-Age=0');
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

        cookieFiltering.modifyCookies(request.requestId!);
        expect(cookieManager.modifyCookie).toHaveBeenLastCalledWith('__cfduid', 'https://example.org');

        let setCookieHeader = { name: 'set-cookie', value: '__cfduid=test; expires=Tue, 06 Nov 1999 12:57:11 -0000' };
        let responseHeaders = createTestResponseHeaders([setCookieHeader]);
        let modifierResponse = cookieFiltering.processResponseHeaders(request, responseHeaders, rules);
        expect(modifierResponse).toBeTruthy();
        expect(setCookieHeader.value).toContain('06 Nov 1999');

        setCookieHeader = { name: 'set-cookie', value: '__cfduid=test; expires=Tue, 06 Nov 2092 12:57:11 -0000' };
        responseHeaders = createTestResponseHeaders([setCookieHeader]);
        modifierResponse = cookieFiltering.processResponseHeaders(request, responseHeaders, rules);
        expect(modifierResponse).toBeTruthy();
        expect(setCookieHeader.value).not.toContain('06 Nov 2092');

        setCookieHeader = { name: 'set-cookie', value: '__cfduid=test; max-age=100' };
        responseHeaders = createTestResponseHeaders([setCookieHeader]);
        modifierResponse = cookieFiltering.processResponseHeaders(request, responseHeaders, rules);
        expect(modifierResponse).toBeTruthy();
        expect(setCookieHeader.value).toBe('__cfduid=test; Max-Age=15; SameSite=Lax');

        setCookieHeader = { name: 'set-cookie', value: '__cfduid=test;' };
        responseHeaders = createTestResponseHeaders([setCookieHeader]);
        modifierResponse = cookieFiltering.processResponseHeaders(request, responseHeaders, rules);
        expect(modifierResponse).toBeTruthy();
        expect(setCookieHeader.value).toBe('__cfduid=test; Max-Age=15; SameSite=Lax');
    });

    it('checks weird cases', () => {
        const request = createTestRequest(1);
        const rules = [
            new NetworkRule('||example.org^$cookie=c_user', 1),
        ];

        const cookieHeader = { name: 'Smth-else', value: '' };
        const headers = createTestRequestHeaders(cookieHeader);

        const setCookieHeader = { name: 'invalid', value: '' };
        const responseHeaders = createTestResponseHeaders([setCookieHeader]);

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

        expect(cookieFiltering.processResponseHeaders(request, responseHeaders, rules)).toBeFalsy();
        // Twice
        expect(cookieFiltering.processResponseHeaders(request, responseHeaders, rules)).toBeFalsy();
        // No rules
        expect(cookieFiltering.processResponseHeaders(request, responseHeaders, [])).toBeFalsy();
        // No headers
        expect(cookieFiltering.processResponseHeaders(request, [], rules)).toBeFalsy();
        // Wrong header
        expect(cookieFiltering.processResponseHeaders(request, [{ name: 'Set-Cookie', value: '' }], rules)).toBeFalsy();
        // Wrong request
        request.requestId = 99;
        expect(cookieFiltering.processResponseHeaders(request, responseHeaders, rules)).toBeFalsy();
    });

    it('checks weird cases - remove processing', () => {
        const request = createTestRequest(1);
        const rules = [
            new NetworkRule('||example.org^$cookie=c_user', 1),
        ];

        const cookieHeader = { name: 'Cookie', value: '_octo=GH1.1.635223982.1507661197; logged_in=yes; c_user=test;' };
        const headers = createTestRequestHeaders(cookieHeader);

        const setCookieHeader = { name: 'set-cookie', value: 'c_user=test;' };
        const responseHeaders = createTestResponseHeaders([setCookieHeader]);

        expect(cookieFiltering.processRequestHeaders(request, headers, rules)).toBeTruthy();
        // Skipping cookieFiltering.modifyCookies(request.requestId);

        expect(cookieFiltering.processResponseHeaders(request, responseHeaders, rules)).toBeTruthy();
    });
});
