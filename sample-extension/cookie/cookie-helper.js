/* eslint-disable no-console, no-undef */

/**
 * Applies cookie rules via content-script
 *
 * @param tabId
 * @param rules
 */
export const applyCookieRules = (tabId, rules) => {
    if (!rules || rules.length === 0) {
        return;
    }

    // eslint-disable-next-line arrow-body-style
    const rulesData = rules.map((rule) => {
        return {
            ruleText: rule.getText(),
            match: rule.getAdvancedModifierValue(),
        };
    });

    chrome.tabs.executeScript(tabId, {
        code: `
                (() => {
                    const rulesData = JSON.parse('${JSON.stringify(rulesData)}');
                    
                    const { CookieController } = AGUrlFilter;
                    const cookieController = new CookieController((rule) => {
                        console.debug('Cookie rule applied');
                        console.debug(rule);
                    });
                    
                    cookieController.apply(rulesData);
                    
                    console.debug('CookieController initialized');
                })();
            `,
    });
};
