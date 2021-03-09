/* eslint-disable class-methods-use-this */
/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-DomainType
 */
import { NetworkRule, NetworkRuleOption } from '../network-rule';
import { RuleFactory } from '../rule-factory';

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-DomainType
 */
enum DomainType {
    'firstParty' = 'firstParty',
    'thirdParty' = 'thirdParty',
}

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-ResourceType
 */
enum ResourceType {
    'main_frame' = 'main_frame',
    'sub_frame' = 'sub_frame',
    'stylesheet' = 'stylesheet',
    'script' = 'script',
    'image' = 'image',
    'font' = 'font',
    'object' = 'object',
    'xmlhttprequest' = 'xmlhttprequest',
    'ping' = 'ping',
    'csp_report' = 'csp_report',
    'media' = 'media',
    'websocket' = 'websocket',
    'other' = 'other',
}

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-QueryKeyValue
 */
type QueryKeyValue = {
    key: string;
    value: string;
};

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-QueryTransform
 */
type QueryTransform = {
    addOrReplaceParams?: QueryKeyValue[];
    removeParams?: string[];
};

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-URLTransform
 */
type URLTransform = {
    fragment?: string;
    host?: string;
    password?: string;
    path?: string;
    port?: string;
    query?: string;
    queryTransform?: QueryTransform;
    scheme?: string;
    username?: string;
};

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-Redirect
 */
type Redirect = {
    extensionPath?: string;
    regexSubstitution?: string;
    transform?: URLTransform;
    url?: string;
};

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-HeaderOperation
 */
enum HeaderOperation {
    append = 'append',
    set = 'set',
    remove = 'remove',
}

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-ModifyHeaderInfo
 */
type ModifyHeaderInfo = {
    header: string;
    operation: HeaderOperation;
    value?: string;
};

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-RuleActionType
 */
enum RuleActionType {
    'block' = 'block',
    'redirect' = 'redirect',
    'allow' = 'allow',
    'upgradeScheme' = 'upgradeScheme',
    'modifyHeaders' = 'modifyHeaders',
    'allowAllRequests' = 'allowAllRequests',
}

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-RuleAction
 */
type RuleAction = {
    redirect?: Redirect;
    requestHeaders?: ModifyHeaderInfo[];
    responseHeaders?: ModifyHeaderInfo[];
    type: RuleActionType;
};

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-RuleCondition
 */
type RuleCondition = {
    domainType?: DomainType;
    domains?: string[];
    excludedDomains?: string[];
    excludedResource?: ResourceType[];
    isUrlFilterCaseSensitive?: boolean;
    regexFilter?: string;
    resourceTypes?: ResourceType[];
    urlFilter?: string;
};

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-Rule
 */
type Rule = {
    id: number;
    priority?: number;
    action: RuleAction;
    condition: RuleCondition;
};

type RowRule = Partial<Rule>;

type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

export class DeclarativeConverter {
    setPriority(declarativeRule: RowRule, rule: NetworkRule): RowRule {
        // TODO set priority
        return declarativeRule;
    }

    setAction(declarativeRule: RowRule, rule: NetworkRule): RequiredBy<RowRule, 'action'> {
        const action = {} as RuleAction;

        // TODO RuleAction
        //  - redirect?: Redirect;
        //  - requestHeaders?: ModifyHeaderInfo[];
        //  - responseHeaders?: ModifyHeaderInfo[];
        //  - type: RuleActionType;
        // TODO RuleActionType
        //  - 'block' = 'block',
        //  - 'allow' = 'allow',
        //  - 'redirect' = 'redirect',
        //  - 'upgradeScheme' = 'upgradeScheme',
        //  - 'modifyHeaders' = 'modifyHeaders',
        //  - 'allowAllRequests' = 'allowAllRequests',

        if (rule.isWhitelist()) {
            action.type = RuleActionType.allow;
        } else {
            action.type = RuleActionType.block;
        }

        return { ...declarativeRule, action };
    }

    setCondition(declarativeRule: RowRule, rule: NetworkRule): RequiredBy<RowRule, 'condition'> {
        const condition = {} as RuleCondition;

        // TODO
        //  - resourceTypes?: ResourceType[];
        //  - excludedResource?: ResourceType[];
        //  - isUrlFilterCaseSensitive?: boolean;
        //  - regexFilter?: string;
        //  - urlFilter?: string;
        const pattern = rule.getPattern();
        if (pattern) {
            condition.urlFilter = pattern;
        }

        // set domainType
        if (rule.isOptionEnabled(NetworkRuleOption.ThirdParty)) {
            condition.domainType = DomainType.thirdParty;
        } else if (rule.isOptionDisabled(NetworkRuleOption.ThirdParty)) {
            condition.domainType = DomainType.firstParty;
        }

        // TODO
        //  - The entries must consist of only ascii characters.
        //  - Use punycode encoding for internationalized domains.
        // set domains
        const permittedDomains = rule.getPermittedDomains();
        if (permittedDomains && permittedDomains.length > 0) {
            condition.domains = permittedDomains;
        }

        // TODO
        //  - The entries must consist of only ascii characters.
        //  - Use punycode encoding for internationalized domains.
        // set excludedDomains
        const excludedDomains = rule.getRestrictedDomains();
        if (excludedDomains && excludedDomains.length > 0) {
            condition.excludedDomains = excludedDomains;
        }

        // eslint-disable-next-line no-param-reassign
        return { ...declarativeRule, condition };
    }

    toDeclarativeRule(rowRule: RowRule): Rule {
        const {
            id,
            priority,
            action,
            condition,
        } = rowRule;

        if (!id || !action || !condition) {
            throw new Error('id, action and condition are required');
        }

        const result: Rule = { id, action, condition };

        if (priority) {
            result.priority = rowRule.priority;
        }

        return result;
    }

    convert(ruleText: string, id: number): Rule | null {
        // TODO RuleConverter.convertRule before creating rule
        const rule = RuleFactory.createRule(ruleText, 1);

        // only network rules could be converted to declarative rules
        if (!(rule instanceof NetworkRule)) {
            return null;
        }

        let rowRule: RowRule = {
            id,
        };

        rowRule = this.setPriority(rowRule, rule);
        rowRule = this.setAction(rowRule, rule);
        rowRule = this.setCondition(rowRule, rule);

        return this.toDeclarativeRule(rowRule);
    }
}
