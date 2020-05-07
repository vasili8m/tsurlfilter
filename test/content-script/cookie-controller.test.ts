/**
 * @jest-environment jsdom
 */

import CookieController from '../../src/content-script/cookie-controller';
import { NetworkRule } from '../../src';

describe('CssHitsCounter', () => {
    it('checks apply simple rule', () => {
        const rules = [
            new NetworkRule('||example.org^$cookie=user_one', 1),
        ];

        const rulesData = rules.map((rule) => ({
            ruleText: rule.getText()!,
            match: rule.getAdvancedModifierValue()!,
        }));

        const callback = jest.fn(() => {});

        const controller = new CookieController(callback);
        controller.apply(rulesData);
        expect(callback).not.toBeCalled();

        document.cookie = 'user_one=test';

        controller.apply(rulesData);
        expect(callback).toHaveBeenLastCalledWith('||example.org^$cookie=user_one');
    });

    it('checks apply wildcard rule', () => {
        const rules = [
            new NetworkRule('||example.org^$cookie', 1),
        ];

        const rulesData = rules.map((rule) => ({
            ruleText: rule.getText()!,
            match: rule.getAdvancedModifierValue()!,
        }));

        const callback = jest.fn(() => {});

        const controller = new CookieController(callback);
        document.cookie = 'user_one=test';
        controller.apply(rulesData);

        expect(callback).toHaveBeenLastCalledWith('||example.org^$cookie');
    });

    it('checks apply regexp rule', () => {
        const rules = [
            new NetworkRule('||example.org^$cookie=/user/', 1),
        ];

        const rulesData = rules.map((rule) => ({
            ruleText: rule.getText()!,
            match: rule.getAdvancedModifierValue()!,
        }));

        const callback = jest.fn(() => {});

        const controller = new CookieController(callback);
        document.cookie = 'user_one=test';
        controller.apply(rulesData);

        expect(callback).toHaveBeenLastCalledWith('||example.org^$cookie=/user/');
    });
});
