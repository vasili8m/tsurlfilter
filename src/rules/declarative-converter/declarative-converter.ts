/* eslint-disable class-methods-use-this */
/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-DomainType
 */
import { NetworkRule, NetworkRuleOption } from '../network-rule';
import { RuleFactory } from '../rule-factory';
import { RequestType } from '../../request-type';

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
    excludedResourceTypes?: ResourceType[];
    isUrlFilterCaseSensitive?: boolean;
    regexFilter?: string;
    resourceTypes?: ResourceType[];
    urlFilter?: string;
};

/**
 * https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-Rule
 */
type DeclarativeRule = {
    id: number;
    priority?: number;
    action: RuleAction;
    condition: RuleCondition;
};

const DECLARATIVE_RESOURCE_TYPES_MAP = {
    [ResourceType.main_frame]: RequestType.Document,
    [ResourceType.sub_frame]: RequestType.Subdocument,
    [ResourceType.stylesheet]: RequestType.Stylesheet,
    [ResourceType.script]: RequestType.Script,
    [ResourceType.image]: RequestType.Image,
    [ResourceType.font]: RequestType.Font,
    [ResourceType.object]: RequestType.Object,
    [ResourceType.xmlhttprequest]: RequestType.XmlHttpRequest,
    [ResourceType.ping]: RequestType.Ping,
    // [ResourceType.csp_report]: RequestType.Document, // TODO what should match this resource type?
    [ResourceType.media]: RequestType.Media,
    [ResourceType.websocket]: RequestType.Websocket,
    [ResourceType.other]: RequestType.Other,
};

export class DeclarativeConverter {
    private getResourceTypes(requestTypes: RequestType): ResourceType[] {
        return Object.entries(DECLARATIVE_RESOURCE_TYPES_MAP)
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            .filter(([resourceTypeKey, requestType]) => (requestTypes & requestType) === requestType)
            .map(([resourceTypeKey]) => ResourceType[resourceTypeKey as ResourceType]);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getPriority(rule: NetworkRule): number | null {
        // TODO set priority
        return null;
    }

    getAction(rule: NetworkRule): RuleAction {
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

        return action;
    }

    getCondition(rule: NetworkRule): RuleCondition {
        const condition = {} as RuleCondition;

        // TODO
        //  - resourceTypes?: ResourceType[];
        //  - excludedResource?: ResourceType[];
        //  - isUrlFilterCaseSensitive?: boolean;
        //  - regexFilter?: string;
        //  - urlFilter?: string;
        const pattern = rule.getPattern();
        if (pattern) {
            // FIXME check if "||" in the pattern has the same meaning as in the declarative rules
            condition.urlFilter = pattern;
        }

        // set domainType
        if (rule.isOptionEnabled(NetworkRuleOption.ThirdParty)) {
            condition.domainType = DomainType.thirdParty;
        } else if (rule.isOptionDisabled(NetworkRuleOption.ThirdParty)) {
            condition.domainType = DomainType.firstParty;
        }

        // FIXME
        //  - The entries must consist of only ascii characters.
        //  - Use punycode encoding for internationalized domains.
        // set domains
        const permittedDomains = rule.getPermittedDomains();
        if (permittedDomains && permittedDomains.length > 0) {
            condition.domains = permittedDomains;
        }

        // FIXME
        //  - The entries must consist of only ascii characters.
        //  - Use punycode encoding for internationalized domains.
        // set excludedDomains
        const excludedDomains = rule.getRestrictedDomains();
        if (excludedDomains && excludedDomains.length > 0) {
            condition.excludedDomains = excludedDomains;
        }

        // set excludedResourceTypes
        const restrictedRequestTypes = rule.getRestrictedRequestTypes();
        const hasExcludedResourceTypes = restrictedRequestTypes !== 0;
        if (hasExcludedResourceTypes) {
            condition.excludedResourceTypes = this.getResourceTypes(restrictedRequestTypes);
        }

        // set resourceTypes
        const permittedRequestTypes = rule.getPermittedRequestTypes();
        if (!hasExcludedResourceTypes && permittedRequestTypes !== 0) {
            condition.resourceTypes = this.getResourceTypes(permittedRequestTypes);
        }

        // eslint-disable-next-line no-param-reassign
        return condition;
    }

    convert(ruleText: string, id: number): DeclarativeRule | null {
        // TODO RuleConverter.convertRule before creating rule
        const rule = RuleFactory.createRule(ruleText, 1);

        // only network rules could be converted to declarative rules
        if (!(rule instanceof NetworkRule)) {
            return null;
        }

        const declarativeRule = {} as DeclarativeRule;

        const priority = this.getPriority(rule);
        if (priority) {
            declarativeRule.priority = priority;
        }
        declarativeRule.id = id;
        declarativeRule.action = this.getAction(rule);
        declarativeRule.condition = this.getCondition(rule);

        return declarativeRule;
    }
}
