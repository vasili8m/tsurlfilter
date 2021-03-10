import { DeclarativeConverter } from '../../../src/rules/declarative-converter/declarative-converter';

describe('DeclarativeConverter', () => {
    const declarativeConverter = new DeclarativeConverter();

    it('converts simple blocking rules', () => {
        const ruleText = '||example.org^';
        const ruleId = 1;
        const declarativeRule = declarativeConverter.convert(ruleText, ruleId);
        expect(declarativeRule).toEqual({
            id: ruleId,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
            },
        });
    });

    it('converts simple allowlist rules', () => {
        const ruleText = '@@||example.org^';
        const ruleId = 1;
        const declarativeRule = declarativeConverter.convert(ruleText, ruleId);
        expect(declarativeRule).toEqual({
            id: ruleId,
            action: {
                type: 'allow',
            },
            condition: {
                urlFilter: '||example.org^',
            },
        });
    });

    it('converts rules with $third-party modifiers', () => {
        const thirdPartyRuleText = '||example.org^$third-party';
        const ruleId = 1;
        const thirdPartyDeclarative = declarativeConverter.convert(thirdPartyRuleText, ruleId);
        expect(thirdPartyDeclarative).toEqual({
            id: ruleId,
            action: {
                type: 'block',
            },
            condition: {
                domainType: 'thirdParty',
                urlFilter: '||example.org^',
            },
        });

        const firstPartyRuleText = '||example.org^$~third-party';
        const firstPartyDeclarative = declarativeConverter.convert(firstPartyRuleText, ruleId);
        expect(firstPartyDeclarative).toEqual({
            id: ruleId,
            action: {
                type: 'block',
            },
            condition: {
                domainType: 'firstParty',
                urlFilter: '||example.org^',
            },
        });
    });

    it('converts rules with $first-party modifiers', () => {
        const firstPartyRuleText = '||example.org^$first-party';
        const ruleId = 1;
        const firstPartyDeclarative = declarativeConverter.convert(firstPartyRuleText, ruleId);
        expect(firstPartyDeclarative).toEqual({
            id: ruleId,
            action: {
                type: 'block',
            },
            condition: {
                domainType: 'firstParty',
                urlFilter: '||example.org^',
            },
        });

        const negateFirstPartyRuleText = '||example.org^$~first-party';
        const negateFirstPartyDeclarative = declarativeConverter.convert(negateFirstPartyRuleText, ruleId);
        expect(negateFirstPartyDeclarative).toEqual({
            id: ruleId,
            action: {
                type: 'block',
            },
            condition: {
                domainType: 'thirdParty',
                urlFilter: '||example.org^',
            },
        });
    });

    it('converts rules with $domain modifiers', () => {
        const domainRuleText = '||example.org^$domain=example.com';
        const ruleId = 1;
        const domainDeclarative = declarativeConverter.convert(domainRuleText, ruleId);
        expect(domainDeclarative).toEqual({
            id: ruleId,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
                domains: ['example.com'],
            },
        });

        const multipleDomainRuleText = '||example.org^$domain=example.com|example2.com|~example3.com|~example4.com';
        const multipleDomainDeclarative = declarativeConverter.convert(multipleDomainRuleText, ruleId);
        expect(multipleDomainDeclarative).toEqual({
            id: ruleId,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
                domains: ['example.com', 'example2.com'],
                excludedDomains: ['example3.com', 'example4.com'],
            },
        });

        const negateDomainRuleText = '||example.org^$domain=~example.com';
        const negateDomainDeclarative = declarativeConverter.convert(negateDomainRuleText, ruleId);
        expect(negateDomainDeclarative).toEqual({
            id: ruleId,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
                excludedDomains: ['example.com'],
            },
        });
    });

    it('converts rules with specified request types', () => {
        const scriptRuleText = '||example.org^$script';
        const ruleId = 1;
        const scriptRuleDeclarative = declarativeConverter.convert(scriptRuleText, ruleId);
        expect(scriptRuleDeclarative).toEqual({
            id: ruleId,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
                resourceTypes: ['script'],
            },
        });

        const negatedScriptRule = '||example.org^$~script';
        const negatedScriptRuleDeclarative = declarativeConverter.convert(negatedScriptRule, ruleId);
        expect(negatedScriptRuleDeclarative).toEqual({
            id: ruleId,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
                excludedResourceTypes: ['script'],
            },
        });

        const multipleRequestTypesRule = '||example.org^$script,image,media';
        const multipleDeclarativeRule = declarativeConverter.convert(multipleRequestTypesRule, ruleId);
        expect(multipleDeclarativeRule!.condition?.resourceTypes?.sort())
            .toEqual(['script', 'image', 'media'].sort());

        const multipleNegatedRequestTypesRule = '||example.org^$~script,~subdocument';
        const multipleNegatedDeclarativeRule = declarativeConverter.convert(multipleNegatedRequestTypesRule, ruleId);
        expect(multipleNegatedDeclarativeRule!.condition?.excludedResourceTypes?.sort())
            .toEqual(['script', 'sub_frame'].sort());
    });
});
