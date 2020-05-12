import CookieUtils from '../../src/cookie-filtering/utils';
import { BrowserCookie } from '../../src/cookie-filtering/browser-cookie';

describe('Cookie utils - Set-Cookie parsing', () => {
    it('checks parse simple', () => {
        const cookie = CookieUtils.parseSetCookie('value=123');
        expect(cookie).not.toBeNull();
        expect(cookie!.name).toBe('value');
        expect(cookie!.value).toBe('123');
    });

    it('checks parse complicated', () => {
        // eslint-disable-next-line max-len
        const cookie = CookieUtils.parseSetCookie('user_session=wBDJ5-apskjfjkas124192--e5; path=/; expires=Tue, 06 Nov 2018 12:57:11 -0000; secure; HttpOnly; SameSite=Lax; Max-Age=100');
        expect(cookie).not.toBeNull();
        expect(cookie!.name).toBe('user_session');
        expect(cookie!.value).toBe('wBDJ5-apskjfjkas124192--e5');
    });

    it('checks parse invalid', () => {
        let cookie = CookieUtils.parseSetCookie('');
        expect(cookie).toBeNull();

        cookie = CookieUtils.parseSetCookie('empty');
        expect(cookie).not.toBeNull();
        expect(cookie!.name).toBe('empty');
        expect(cookie!.value).toBe('');
    });
});

describe('Cookie utils - update max age', () => {
    const cookie = new BrowserCookie('test', 'test');

    it('checks update - max age', () => {
        cookie.maxAge = undefined;
        cookie.expires = undefined;

        expect(CookieUtils.updateCookieMaxAge(cookie, 1)).toBeTruthy();
        expect(cookie.maxAge).toBe(1);
        expect(cookie.expires).not.toBeDefined();
    });

    it('checks add - max age', () => {
        cookie.maxAge = 2;
        cookie.expires = undefined;

        expect(CookieUtils.updateCookieMaxAge(cookie, 1)).toBeTruthy();
        expect(cookie.maxAge).toBe(1);
        expect(cookie.expires).not.toBeDefined();
    });

    it('checks no update - max age', () => {
        cookie.maxAge = 1;
        cookie.expires = undefined;

        expect(CookieUtils.updateCookieMaxAge(cookie, 2)).toBeFalsy();
        expect(cookie.maxAge).toBe(1);
        expect(cookie.expires).not.toBeDefined();
    });

    it('checks add - expires', () => {
        cookie.maxAge = undefined;
        cookie.expires = new Date(new Date().getTime() + 5 * 1000);

        expect(CookieUtils.updateCookieMaxAge(cookie, 2)).toBeTruthy();
        expect(cookie.maxAge).toBe(2);
        expect(cookie.expires).toBeDefined();
    });

    it('checks no update - expires', () => {
        cookie.maxAge = undefined;
        cookie.expires = new Date();

        expect(CookieUtils.updateCookieMaxAge(cookie, 2)).toBeFalsy();
        expect(cookie.maxAge).not.toBeDefined();
        expect(cookie.expires).toBeDefined();
    });
});
