import { CookieJournal } from '../../src/cookie-filtering/cookie-journal';
import { BrowserCookie } from '../../src/cookie-filtering/browser-cookie/browser-cookie';

describe('Cookie journal', () => {
    const journal = new CookieJournal();

    it('checks general functionality', () => {
        const cookie = new BrowserCookie('test_name', 'test_value');

        expect(journal.isProcessed(cookie)).toBeFalsy();
        expect(journal.isThirdParty(cookie)).toBeFalsy();

        journal.setProcessed(cookie);
        expect(journal.isProcessed(cookie)).toBeTruthy();
        expect(journal.isThirdParty(cookie)).toBeFalsy();

        journal.setThirdParty(cookie.name, cookie.domain!, false);
        expect(journal.isProcessed(cookie)).toBeTruthy();
        expect(journal.isThirdParty(cookie)).toBeFalsy();

        journal.setThirdParty(cookie.name, cookie.domain!, true);
        expect(journal.isProcessed(cookie)).toBeTruthy();
        expect(journal.isThirdParty(cookie)).toBeTruthy();

        journal.remove(cookie);
        expect(journal.isProcessed(cookie)).toBeFalsy();
        expect(journal.isThirdParty(cookie)).toBeFalsy();

        const anOtherCookie = new BrowserCookie('other_test_name', 'test_value');

        expect(journal.isProcessed(anOtherCookie)).toBeFalsy();
        expect(journal.isThirdParty(anOtherCookie)).toBeFalsy();

        journal.setThirdParty(anOtherCookie.name, anOtherCookie.domain!, true);
        expect(journal.isProcessed(anOtherCookie)).toBeFalsy();
        expect(journal.isThirdParty(anOtherCookie)).toBeTruthy();
    });
});
