import { BrowserCookie } from './browser-cookie';
import { fastHash } from '../utils/utils';

/**
 * Cookie journal class
 * Stores useful info for cookies
 */
export class CookieJournal {
    /**
     * Internal storage
     */
    private storage: Map<number, {
        isProcessed: boolean;
        isThirdParty: boolean;
    }> = new Map();

    /**
     * Sets cookie processed
     *
     * @param cookie
     */
    public setProcessed(cookie: BrowserCookie): void {
        const saved = this.getInfo(cookie);
        if (saved) {
            saved.isProcessed = true;
        } else {
            this.storage.set(CookieJournal.getHash(cookie.name, cookie.domain), {
                isProcessed: true,
                isThirdParty: false,
            });
        }
    }

    /**
     * Returns cookie processed status
     *
     * @param cookie
     */
    public isProcessed(cookie: BrowserCookie): boolean {
        const saved = this.getInfo(cookie);
        if (saved) {
            return saved.isProcessed;
        }

        return false;
    }

    /**
     * Removes cookie from journal
     *
     * @param cookie
     */
    public remove(cookie: BrowserCookie): void {
        const saved = this.getInfo(cookie);
        if (saved) {
            this.storage.delete(CookieJournal.getHash(cookie.name, cookie.domain));
        }
    }

    /**
     * Returns cookie third-party status
     *
     * @param cookie
     */
    public isThirdParty(cookie: BrowserCookie): boolean {
        const saved = this.getInfo(cookie);
        if (saved) {
            return saved.isThirdParty;
        }

        return false;
    }

    /**
     * Sets cookie third-party
     *
     * @param cookieName
     * @param cookieDomain
     * @param isThirdParty
     */
    public setThirdParty(cookieName: string, cookieDomain: string, isThirdParty: boolean): void {
        const hash = CookieJournal.getHash(cookieName, cookieDomain);
        const saved = this.storage.get(hash);
        if (saved) {
            saved.isThirdParty = isThirdParty;
        } else {
            this.storage.set(hash, {
                isProcessed: false,
                isThirdParty,
            });
        }
    }

    /**
     * Gets cookie stored info
     *
     * @param cookie
     */
    private getInfo(cookie: BrowserCookie): {
        isProcessed: boolean;
        isThirdParty: boolean;
    } | undefined {
        return this.storage.get(CookieJournal.getHash(cookie.name, cookie.domain));
    }

    /**
     * Gets identifier hasg
     *
     * @param name
     * @param domain
     */
    private static getHash(name: string, domain: string | undefined): number {
        return fastHash(name + (domain ? domain! : ''));
    }
}
