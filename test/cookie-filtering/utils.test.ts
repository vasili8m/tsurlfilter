import CookieUtils from '../../src/cookie-filtering/utils';
import { CookieHeader } from '../../src/cookie-filtering/cookie-header';

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
        expect(cookie!.path).toBe('/');
        expect(cookie!.expires!.getTime()).toBe(1541509031000);
        expect(cookie!.secure).toBeTruthy();
        expect(cookie!.httpOnly).toBeTruthy();
        expect(cookie!.maxAge).toBe(100);
        expect(cookie!.sameSite).toBe('Lax');
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

describe('Cookie utils - Serializing', () => {
    it('checks serialize simple', () => {
        const cookie = new CookieHeader('_octo', 'GH1.1.635223982.1507661197');

        const result = CookieUtils.serialize(cookie);
        expect(result).toBe('_octo=GH1.1.635223982.1507661197');
    });

    it('checks serialize complicated', () => {
        const cookie = new CookieHeader('_octo', 'GH1.1.635223982.1507661197');
        cookie.path = '/';
        cookie.expires = new Date('Tue, 23 Oct 2018 13:40:11 -0000');
        cookie.secure = true;
        cookie.httpOnly = true;
        cookie.sameSite = 'lax';
        cookie.domain = 'test';
        cookie.maxAge = 100;
        cookie.priority = 'test';

        const result = CookieUtils.serialize(cookie);
        // eslint-disable-next-line max-len
        expect(result).toBe('_octo=GH1.1.635223982.1507661197; Max-Age=100; Domain=test; Path=/; Expires=Tue, 23 Oct 2018 13:40:11 GMT; HttpOnly; Secure; SameSite=Lax; Priority=test');
    });

    it('checks serialize sameSite', () => {
        const cookie = new CookieHeader('test', 'test');
        cookie.sameSite = 'lax';

        expect(CookieUtils.serialize(cookie)).toBe('test=test; SameSite=Lax');

        cookie.sameSite = 'strict';
        expect(CookieUtils.serialize(cookie)).toBe('test=test; SameSite=Strict');

        cookie.sameSite = 'none';
        expect(CookieUtils.serialize(cookie)).toBe('test=test; SameSite=None');

        cookie.sameSite = 'invalid';
        expect(() => {
            CookieUtils.serialize(cookie);
        }).toThrowError();
    });

    it('checks serialize invalid', () => {
        expect(() => {
            CookieUtils.serialize(new CookieHeader('тест', 'invalid'));
        }).toThrowError(/Cookie name is invalid: */);

        expect(() => {
            CookieUtils.serialize(new CookieHeader('test', 'тест'));
        }).toThrowError(/Cookie value is invalid: */);

        expect(() => {
            const cookie = new CookieHeader('test', 'test');
            cookie.path = 'тест';
            CookieUtils.serialize(cookie);
        }).toThrowError(/Cookie path is invalid: */);

        expect(() => {
            const cookie = new CookieHeader('test', 'test');
            cookie.domain = 'тест';
            CookieUtils.serialize(cookie);
        }).toThrowError(/Cookie domain is invalid: */);
    });

    it('checks serialize invalid same site', () => {
        const cookie = new CookieHeader('test', 'invalid');
        cookie.sameSite = 'invalid';

        expect(() => {
            CookieUtils.serialize(cookie);
        }).toThrowError(/Cookie sameSite is invalid: */);
    });
});
