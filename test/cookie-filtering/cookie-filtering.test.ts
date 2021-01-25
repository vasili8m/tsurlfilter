/* eslint-disable max-classes-per-file,max-len */
import { CookieFiltering } from '../../src/cookie-filtering/cookie-filtering';
import { MockFilteringLog } from '../mock-filtering-log';
import { NetworkRule, Request, RequestType } from '../../src';
import { BrowserCookie } from '../../src/cookie-filtering/browser-cookie/browser-cookie';
import { RulesFinder } from '../../src/cookie-filtering/rules-finder';
import { MockCookieApi } from './browser-cookie/mock-cookie-api';

const createTestRequest = (requestId: number): Request => {
    const request = new Request('http://example.org', '', RequestType.Document);
    request.requestId = requestId;
    request.tabId = 1;

    return request;
};

const createTestHeaders = (setCookieHeaders: {name: string;value: string}[]): {name: string;value: string}[] => [
    { name: 'Header One', value: 'Header Value One' },
    ...setCookieHeaders,
];

/**
 * Mock rules finder
 */
class MockRulesFinder implements RulesFinder {
    private rules: NetworkRule[] = [];

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getRulesForCookie(url: string, thirdParty: boolean): NetworkRule[] {
        return this.rules;
    }

    setRules(rules: NetworkRule[]): void {
        this.rules = rules;
    }
}

describe('Cookie filtering', () => {
    const rulesFinder = new MockRulesFinder();

    let cookieManager = new MockCookieApi();
    let cookieFiltering = new CookieFiltering(cookieManager, new MockFilteringLog(), rulesFinder);

    beforeEach(() => {
        cookieManager = new MockCookieApi();
        cookieFiltering = new CookieFiltering(cookieManager, new MockFilteringLog(), rulesFinder);
    });

    it('checks remove rule', async () => {
        const request = createTestRequest(1);
        const rules = [
            new NetworkRule('||example.org^$cookie=c_user', 1),
        ];

        const responseHeaders = createTestHeaders([]);
        cookieFiltering.processResponseHeaders(request, responseHeaders);

        cookieManager.setCookies([new BrowserCookie('c_user', 'test', 'example.org')]);
        await cookieFiltering.modifyCookies(request, rules);
        expect(cookieManager.removeCookie).toHaveBeenLastCalledWith('c_user', 'http://example.org');
    });

    it('checks modifying rule - max age', async () => {
        const request = createTestRequest(1);
        const cookieOptionText = 'some_cookie;maxAge=15;sameSite=lax';
        const rules = [
            new NetworkRule(`$cookie=${cookieOptionText}`, 1),
        ];

        const responseHeaders = createTestHeaders([]);
        cookieFiltering.processResponseHeaders(request, responseHeaders);

        cookieManager.setCookies(
            [
                new BrowserCookie('an_other', 'test_value', 'example.org'),
                new BrowserCookie('some_cookie', 'test_value', 'example.org'),
            ],
        );

        await cookieFiltering.modifyCookies(request, rules);
        expect(cookieManager.modifyCookie).toHaveBeenLastCalledWith({
            maxAge: 15, name: 'some_cookie', sameSite: 'lax', value: 'test_value', domain: 'example.org',
        }, 'http://example.org');

        cookieManager.setCookies([new BrowserCookie('an_other', 'test_value', 'example.org')]);
        await cookieFiltering.modifyCookies(request, rules);

        let browserCookie = new BrowserCookie('some_cookie', 'test_value', 'example.org');
        browserCookie.expires = new Date(Date.parse('06 Nov 2099'));
        cookieManager.setCookies([browserCookie]);
        await cookieFiltering.modifyCookies(request, rules);

        browserCookie = new BrowserCookie('some_cookie', 'test_value', 'example.org');
        browserCookie.maxAge = 100;
        cookieManager.setCookies([browserCookie]);
        await cookieFiltering.modifyCookies(request, rules);
        expect(cookieManager.modifyCookie).toHaveBeenLastCalledWith({
            maxAge: 15, name: 'some_cookie', sameSite: 'lax', value: 'test_value', domain: 'example.org',
        }, 'http://example.org');
    });

    it('checks modifying rule - max age - expires', async () => {
        const request = createTestRequest(1);
        const cookieOptionText = 'some_cookie;maxAge=15;sameSite=lax';
        const rules = [
            new NetworkRule(`$cookie=${cookieOptionText}`, 1),
        ];

        const responseHeaders = createTestHeaders([]);
        cookieFiltering.processResponseHeaders(request, responseHeaders);

        const browserCookie = new BrowserCookie('some_cookie', 'test_value', 'example.org');
        browserCookie.expires = new Date('1999-11-06T20:00:00.000Z');
        cookieManager.setCookies([browserCookie]);
        await cookieFiltering.modifyCookies(request, rules);
        expect(cookieManager.modifyCookie).toHaveBeenLastCalledWith({
            expires: new Date('1999-11-06T20:00:00.000Z'), name: 'some_cookie', sameSite: 'lax', value: 'test_value', domain: 'example.org',
        }, 'http://example.org');
    });

    it('checks modifying rule - sameSite', async () => {
        const request = createTestRequest(1);
        const cookieOptionText = '__cfduid;sameSite=lax';
        const rules = [
            new NetworkRule(`$cookie=${cookieOptionText}`, 1),
        ];

        cookieManager.setCookies([new BrowserCookie('__cfduid', 'test_value', 'example.org')]);
        await cookieFiltering.modifyCookies(request, rules);
        expect(cookieManager.modifyCookie).toHaveBeenLastCalledWith({
            name: '__cfduid', sameSite: 'lax', value: 'test_value', domain: 'example.org',
        }, 'http://example.org');

        const browserCookie = new BrowserCookie('__cfduid', 'test_value', 'example.org');
        browserCookie.sameSite = 'lax';
        cookieManager.setCookies([browserCookie]);
        await cookieFiltering.modifyCookies(request, rules);
        expect(cookieManager.modifyCookie).toHaveBeenLastCalledWith({
            name: '__cfduid', sameSite: 'lax', value: 'test_value', domain: 'example.org',
        }, 'http://example.org');
    });

    it('checks remove rule - third-party cases', async () => {
        const request = new Request('https://example.org', 'https://source.org', RequestType.Document);
        expect(request.thirdParty).toBeTruthy();

        const rules = [
            new NetworkRule('||example.org^$cookie=c_user', 1),
            new NetworkRule('||example.org^$third-party,cookie=third_party_user', 1),
        ];

        const responseHeaders = createTestHeaders([]);
        cookieFiltering.processResponseHeaders(request, responseHeaders);

        const browserCookie = new BrowserCookie('third_party_user', 'test', 'example.org');
        browserCookie.domain = 'example.org';

        // Cookie has not been marked as third-party
        cookieManager.setCookies([browserCookie]);
        await cookieFiltering.modifyCookies(request, rules);
        expect(cookieManager.removeCookie).not.toHaveBeenCalled();

        // This is third-party cookie
        const setCookieHeader = [{ name: 'set-cookie', value: 'third_party_user=test;' }];
        cookieFiltering.processResponseHeaders(request, responseHeaders.concat(setCookieHeader));

        cookieManager.setCookies([browserCookie]);
        await cookieFiltering.modifyCookies(request, rules);
        expect(cookieManager.removeCookie).toHaveBeenLastCalledWith('third_party_user', 'http://example.org');
    });

    it('filters blocking rules', () => {
        const rules = [
            new NetworkRule('||example.org^$cookie=c_user', 1),
            new NetworkRule('||example.org^$third-party,cookie=third_party_user', 1),
            new NetworkRule('||example.org^$cookie=m_user;sameSite=lax', 1),
        ];

        const result = cookieFiltering.getBlockingRules(rules);
        expect(result).toHaveLength(1);
    });

    it('checks onChanged mechanics', async () => {
        const rules = [
            new NetworkRule('||example.org^$cookie=dynamic_changed', 1),
        ];

        rulesFinder.setRules(rules);

        const browserCookie = new BrowserCookie('some_other', 'test', 'example.org');
        await cookieManager.triggerOnChanged(browserCookie, true);
        expect(cookieManager.removeCookie).not.toHaveBeenCalled();

        const dynamicCookie = new BrowserCookie('dynamic_changed', 'test', 'example.org');
        await cookieManager.triggerOnChanged(dynamicCookie, false);
        expect(cookieManager.removeCookie).toHaveBeenLastCalledWith('dynamic_changed', 'http://example.org');
        cookieManager.removeCookie.mockClear();

        await cookieManager.triggerOnChanged(dynamicCookie, true);
        expect(cookieManager.removeCookie).not.toHaveBeenCalled();

        await cookieManager.triggerOnChanged(dynamicCookie, false);
        expect(cookieManager.removeCookie).toHaveBeenLastCalledWith('dynamic_changed', 'http://example.org');
        cookieManager.removeCookie.mockClear();
        await cookieManager.triggerOnChanged(dynamicCookie, false);
        expect(cookieManager.removeCookie).not.toHaveBeenCalled();
    });
});
