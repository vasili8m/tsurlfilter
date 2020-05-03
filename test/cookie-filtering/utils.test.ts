import CookieUtils from '../../src/cookie-filtering/utils';
import { BrowserCookie } from '../../src/cookie-filtering/browser-cookie';

describe('Cookie utils - Cookie parsing', () => {
    it('checks parse simple', () => {
        const cookieValue = 'value=123';
        const cookies = CookieUtils.parseCookie(cookieValue);

        expect(cookies).toHaveLength(1);
        expect(cookies[0].name).toBe('value');
        expect(cookies[0].value).toBe('123');
    });

    it('checks parse complicated', () => {
        // eslint-disable-next-line max-len
        const cookieValue = '_octo=GH1.1.635223982.1507661197; logged_in=yes; dotcom_user=ameshkov; user_session=wBDJ5-apskjfjkas124192-e5; __Host-user_session_same_site=wBDJ5-apskjfjkas124192-e5; _ga=GA1.2.1719384528.1507661197; tz=Europe%2FMoscow; has_recent_activity=1; _gh_sess=VWo3R1VsRWxp';
        const cookies = CookieUtils.parseCookie(cookieValue);

        expect(cookies).toHaveLength(9);
        expect(cookies[0].name).toBe('_octo');
        expect(cookies[0].value).toBe('GH1.1.635223982.1507661197');
        expect(cookies[1].name).toBe('logged_in');
        expect(cookies[1].value).toBe('yes');
    });

    it('checks parse empty', () => {
        const cookieValue = 'value=';
        const cookies = CookieUtils.parseCookie(cookieValue);

        expect(cookies).toHaveLength(1);
        expect(cookies[0].name).toBe('value');
        expect(cookies[0].value).toBe('');
    });

    it('checks parse invalid', () => {
        const cookieValue = 'value';
        const cookies = CookieUtils.parseCookie(cookieValue);

        expect(cookies).toHaveLength(0);
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
        expect(cookie.maxAge).not.toBeDefined();
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
