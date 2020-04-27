import { CosmeticEngine } from './cosmetic-engine/cosmetic-engine';
import { NetworkEngine } from './network-engine';
import { Request, RequestType } from '../request';
import { CosmeticOption, MatchingResult } from './matching-result';
import { NetworkRule, NetworkRuleOption } from '../rules/network-rule';
import { RuleStorage } from '../filterlist/rule-storage';
import { CosmeticResult } from './cosmetic-engine/cosmetic-result';
import { config, IConfiguration } from '../configuration';

/**
 * Engine represents the filtering engine with all the loaded rules
 */
export class Engine {
    /**
     * Basic filtering rules engine
     */
    private readonly networkEngine: NetworkEngine;

    /**
     * Cosmetic rules engine
     */
    private readonly cosmeticEngine: CosmeticEngine;

    /**
     * Creates an instance of an Engine
     * Parses the filtering rules and creates a filtering engine of them
     *
     * @param ruleStorage storage
     * @param configuration optional configuration
     *
     * @throws
     */
    constructor(ruleStorage: RuleStorage, configuration?: IConfiguration | undefined) {
        this.networkEngine = new NetworkEngine(ruleStorage);
        this.cosmeticEngine = new CosmeticEngine(ruleStorage);

        if (configuration) {
            config.engine = configuration.engine;
            config.version = configuration.version;
            config.verbose = configuration.verbose;
        }
    }

    /**
     * Matches the specified request against the filtering engine and returns the matching result.
     *
     * @param request - request to check
     * @return matching result
     */
    matchRequest(request: Request): MatchingResult {
        const networkRules = Engine.applyBadfilterRules(this.networkEngine.matchAll(request), request);

        let sourceRules: NetworkRule[] = [];
        if (request.sourceUrl) {
            const sourceRequest = new Request(request.sourceUrl, '', RequestType.Document);
            sourceRules = Engine.applyBadfilterRules(this.networkEngine.matchAll(sourceRequest), sourceRequest);
        }

        return new MatchingResult(networkRules, sourceRules);
    }

    /**
     * Gets cosmetic result for the specified hostname and cosmetic options
     *
     * @param hostname host to check
     * @param option mask of enabled cosmetic types
     * @return cosmetic result
     */
    getCosmeticResult(hostname: string, option: CosmeticOption): CosmeticResult {
        const includeCss = (option & CosmeticOption.CosmeticOptionCSS) === CosmeticOption.CosmeticOptionCSS;
        const includeGenericCss = (option
            & CosmeticOption.CosmeticOptionGenericCSS) === CosmeticOption.CosmeticOptionGenericCSS;
        const includeJs = (option & CosmeticOption.CosmeticOptionJS) === CosmeticOption.CosmeticOptionJS;

        return this.cosmeticEngine.match(hostname, includeCss, includeJs, includeGenericCss);
    }

    /**
     * Looks if there are any matching $badfilter rules and applies
     * matching bad filters from the array (see the $badfilter description for more info)
     *
     * @param rules to filter
     * @param request
     * @return filtered rules
     */
    private static applyBadfilterRules(rules: NetworkRule[], request: Request): NetworkRule[] {
        const badfilterRules: NetworkRule[] = [];
        for (const rule of rules) {
            if (rule.isOptionEnabled(NetworkRuleOption.Badfilter)) {
                badfilterRules.push(rule);
            }
        }

        if (badfilterRules.length > 0) {
            const filteredRules: NetworkRule[] = [];
            for (const badfilter of badfilterRules) {
                for (const rule of rules) {
                    if (!rule.isOptionEnabled(NetworkRuleOption.Badfilter)) {
                        const result = badfilter.applyBadfilter(rule);
                        if (result && filteredRules.indexOf(result) < 0) {
                            // Check modified rule is still matching request
                            if (result.match(request)) {
                                filteredRules.push(rule);
                            }
                        }
                    }
                }
            }

            return filteredRules;
        }

        return rules;
    }
}
