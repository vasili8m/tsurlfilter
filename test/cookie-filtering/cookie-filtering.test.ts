/* eslint-disable max-len */
import { WebRequest } from 'webextension-polyfill-ts';
import { CookieFiltering } from '../../src/cookie-filtering/cookie-filtering';
import { MockFilteringLog } from '../mock-filtering-log';
import { NetworkRule } from '../../src';
import BrowserCookieApi from '../../src/cookie-filtering/browser-cookie/browser-cookie-api';
import OnBeforeRequestDetailsType = WebRequest.OnBeforeRequestDetailsType;
import OnBeforeSendHeadersDetailsType = WebRequest.OnBeforeSendHeadersDetailsType;
import OnHeadersReceivedDetailsType = WebRequest.OnHeadersReceivedDetailsType;
import OnCompletedDetailsType = WebRequest.OnCompletedDetailsType;
import OnErrorOccurredDetailsType = WebRequest.OnErrorOccurredDetailsType;
import HttpHeaders = WebRequest.HttpHeaders;

jest.mock('../../src/cookie-filtering/browser-cookie/browser-cookie-api');
BrowserCookieApi.prototype.removeCookie = jest.fn().mockImplementation(() => true);
BrowserCookieApi.prototype.modifyCookie = jest.fn().mockImplementation(() => true);

const createTestHeaders = (headers: {name: string;value: string}[]): {name: string;value: string}[] => [
    { name: 'Header One', value: 'Header Value One' },
    ...headers,
];

describe('Cookie filtering', () => {
    let cookieFiltering: CookieFiltering;
    let mockFilteringLog: MockFilteringLog;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let details: any;

    beforeEach(() => {
        mockFilteringLog = new MockFilteringLog();
        cookieFiltering = new CookieFiltering(mockFilteringLog);

        details = {
            frameId: 0,
            method: 'GET',
            parentFrameId: 0,
            requestId: '1',
            tabId: 0,
            thirdParty: false,
            timeStamp: 0,
            type: 'main_frame',
            url: 'https://example.org',
        };
    });

    const runCase = async (rules: NetworkRule[], requestHeaders: HttpHeaders, responseHeaders?: HttpHeaders): Promise<void> => {
        cookieFiltering.onBeforeRequest(details as OnBeforeRequestDetailsType, rules);

        cookieFiltering.onBeforeSendHeaders({
            requestHeaders,
            ...details,
        } as OnBeforeSendHeadersDetailsType);

        await cookieFiltering.onHeadersReceived({
            statusCode: 200,
            statusLine: 'OK',
            responseHeaders,
            ...details,
        } as OnHeadersReceivedDetailsType);

        cookieFiltering.onCompleted({
            statusCode: 200,
            statusLine: 'OK',
            fromCache: false,
            requestSize: 0,
            responseSize: 0,
            urlClassification: { firstParty: ['fingerprinting'], thirdParty: ['fingerprinting'] },
            ...details,
        } as OnCompletedDetailsType);
    };

    it('checks empty', async () => {
        const cookieRule = new NetworkRule('||example.org^$cookie=c_user', 1);
        const rules = [
            cookieRule,
        ];

        const requestHeaders = createTestHeaders([]);

        await runCase(rules, requestHeaders);

        expect(mockFilteringLog.addCookieEvent).not.toHaveBeenCalled();
    });

    it('checks remove rule', async () => {
        const cookieRule = new NetworkRule('||example.org^$cookie=c_user', 1);
        const rules = [
            cookieRule,
        ];

        const requestHeaders = createTestHeaders([{
            name: 'Cookie',
            value: 'c_user=test_value',
        }]);

        await runCase(rules, requestHeaders);

        expect(mockFilteringLog.addCookieEvent).toHaveBeenLastCalledWith(0, 'c_user', 'test_value', 'example.org', 1, cookieRule, false, false);
    });

    it('checks modifying rule - max age', async () => {
        const cookieRule = new NetworkRule('||example.org^$cookie=c_user;maxAge=15', 1);
        const rules = [
            cookieRule,
        ];

        const requestHeaders = createTestHeaders([{
            name: 'Cookie',
            value: 'c_user=test_value',
        }]);

        await runCase(rules, requestHeaders);

        expect(mockFilteringLog.addCookieEvent).toHaveBeenLastCalledWith(0, 'c_user', 'test_value', 'example.org', 1, cookieRule, true, false);
    });

    it('checks modifying rule - sameSite', async () => {
        const cookieRule = new NetworkRule('||example.org^$cookie=c_user;sameSite=lax', 1);
        const rules = [
            cookieRule,
        ];

        const requestHeaders = createTestHeaders([{
            name: 'Cookie',
            value: 'c_user=test_value',
        }]);

        await runCase(rules, requestHeaders);

        expect(mockFilteringLog.addCookieEvent).toHaveBeenLastCalledWith(0, 'c_user', 'test_value', 'example.org', 1, cookieRule, true, false);
    });

    it('checks remove rule - third-party cases', async () => {
        details.thirdParty = true;

        const thirdPartyCookieRule = new NetworkRule('||example.org^$third-party,cookie=third_party_user', 1);
        const rules = [
            new NetworkRule('||example.org^$cookie=c_user', 1),
            thirdPartyCookieRule,
        ];

        const requestHeaders = createTestHeaders([{
            name: 'Cookie',
            value: 'smth=test_value',
        }]);

        const setCookieHeader = { name: 'set-cookie', value: 'third_party_user=test;' };
        const responseHeaders = [setCookieHeader];

        await runCase(rules, requestHeaders, responseHeaders);

        expect(mockFilteringLog.addCookieEvent).toHaveBeenLastCalledWith(0, 'third_party_user', 'test', 'example.org', 1, thirdPartyCookieRule, false, true);
    });

    it('filters blocking rules', () => {
        const rules = [
            new NetworkRule('||example.org^$cookie=c_user', 1),
            new NetworkRule('||example.org^$third-party,cookie=third_party_user', 1),
            new NetworkRule('||example.org^$cookie=m_user;sameSite=lax', 1),
        ];

        cookieFiltering.onBeforeRequest(details as OnBeforeRequestDetailsType, rules);
        let result = cookieFiltering.getBlockingRules(details.requestId);
        expect(result).toHaveLength(2);

        result = cookieFiltering.getBlockingRules(details.requestId + 1);
        expect(result).toHaveLength(0);
    });

    it('checks invalids', async () => {
        const rules: NetworkRule[] = [];

        cookieFiltering.onBeforeRequest(details as OnBeforeRequestDetailsType, rules);

        cookieFiltering.onBeforeSendHeaders({
            requestHeaders: undefined,
            ...details,
        } as OnBeforeSendHeadersDetailsType);

        await cookieFiltering.onHeadersReceived({
            statusCode: 200,
            statusLine: 'OK',
            ...details,
        } as OnHeadersReceivedDetailsType);

        cookieFiltering.onCompleted({
            statusCode: 200,
            statusLine: 'OK',
            fromCache: false,
            requestSize: 0,
            responseSize: 0,
            urlClassification: { firstParty: ['fingerprinting'], thirdParty: ['fingerprinting'] },
            ...details,
        } as OnCompletedDetailsType);

        cookieFiltering.onErrorOccurred({
            statusCode: 200,
            statusLine: 'OK',
            fromCache: false,
            requestSize: 0,
            responseSize: 0,
            urlClassification: { firstParty: ['fingerprinting'], thirdParty: ['fingerprinting'] },
            error: 'error',
            ...details,
        } as OnErrorOccurredDetailsType);

        expect(mockFilteringLog.addCookieEvent).not.toHaveBeenCalled();

        details.requestId += 1;
        cookieFiltering.onBeforeSendHeaders({
            requestHeaders: [],
            ...details,
        } as OnBeforeSendHeadersDetailsType);

        await cookieFiltering.onHeadersReceived({
            statusCode: 200,
            statusLine: 'OK',
            ...details,
        } as OnHeadersReceivedDetailsType);

        cookieFiltering.onCompleted({
            statusCode: 200,
            statusLine: 'OK',
            fromCache: false,
            requestSize: 0,
            responseSize: 0,
            urlClassification: { firstParty: ['fingerprinting'], thirdParty: ['fingerprinting'] },
            ...details,
        } as OnCompletedDetailsType);

        expect(mockFilteringLog.addCookieEvent).not.toHaveBeenCalled();
    });
});
