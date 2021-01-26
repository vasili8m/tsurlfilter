/**
 * This class applies cookie rules in page context
 */
export default class CookieController {
    /**
     * On rule applied callback
     */
    private readonly onRuleAppliedCallback: (ruleText: string) => void;

    /**
     * Constructor
     *
     * @param callback
     */
    constructor(callback: (ruleText: string) => void) {
        this.onRuleAppliedCallback = callback;
    }

    /**
     * Applies rules
     * Inspired by remove-cookie scriptlet
     * https://github.com/AdguardTeam/Scriptlets/blob/master/src/scriptlets/remove-cookie.js
     *
     * @param rules
     */
    public apply(
        rules: {
            ruleText: string;
            match: string;
        }[],
    ): void {
        this.applyRules(rules);

        window.addEventListener('beforeunload', () => {
            this.applyRules(rules);
        });
    }

    /**
     * Applies rules to document cookies
     *
     * @param rules
     */
    private applyRules(
        rules: {
            ruleText: string;
            match: string;
        }[],
    ): void {
        document.cookie.split(';').forEach((cookieStr) => {
            const pos = cookieStr.indexOf('=');
            if (pos === -1) {
                return;
            }

            // TODO: Detect if this cookie is third-party
            // The cookie is considered third-party if
            // - it has been set in third-party iframe
            // eslint-disable-next-line max-len
            // - https://stackoverflow.com/questions/14344319/can-i-be-notified-of-cookie-changes-in-client-side-javascript
            // TODO: use Method 1: Periodic Polling
            // Use rule thirdparty flag

            const cookieName = cookieStr.slice(0, pos).trim();
            rules.forEach((rule) => {
                this.applyRule(rule.match, cookieName, rule.ruleText);
            });
        });
    }

    /**
     * Applies rule
     *
     * @param match
     * @param cookieName
     * @param ruleText
     */
    private applyRule(match: string, cookieName: string, ruleText: string): void {
        const regex = match ? CookieController.toRegExp(match) : CookieController.toRegExp('/.?/');
        if (!regex.test(cookieName)) {
            return;
        }

        const hostParts = document.location.hostname.split('.');
        for (let i = 0; i <= hostParts.length - 1; i += 1) {
            const hostName = hostParts.slice(i).join('.');
            if (hostName) {
                this.removeCookieFromHost(cookieName, hostName);
                this.onRuleAppliedCallback(ruleText);
            }
        }
    }

    /**
     * Removes cookie for host
     *
     * @param cookieName
     * @param hostName
     */
    private removeCookieFromHost(cookieName: string, hostName: string): void {
        const cookieSpec = `${cookieName}=`;
        const domain1 = `; domain=${hostName}`;
        const domain2 = `; domain=.${hostName}`;
        const path = '; path=/';
        const expiration = '; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = cookieSpec + expiration;
        document.cookie = cookieSpec + domain1 + expiration;
        document.cookie = cookieSpec + domain2 + expiration;
        document.cookie = cookieSpec + path + expiration;
        document.cookie = cookieSpec + domain1 + path + expiration;
        document.cookie = cookieSpec + domain2 + path + expiration;
    }

    /**
     * Converts cookie rule match to regular expression
     *
     * @param str
     */
    private static toRegExp(str: string): RegExp {
        if (str[0] === '/' && str[str.length - 1] === '/') {
            return new RegExp(str.slice(1, -1));
        }
        const escaped = str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(escaped);
    }
}
