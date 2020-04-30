import CookieUtils from '../../src/cookie-filtering/utils';

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
