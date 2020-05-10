import { NetworkRule } from '../rules/network-rule';

/**
 * Rules finder interface
 * In case we only need to get cookie rules for specified url we only need this functionality in cookie filtering
 */
export interface RulesFinder {
    /**
     * Finds cookie rules for specified url
     *
     * @param url cookie url (domain)
     * @param thirdParty cookie third-party flag
     */
    getRulesForCookie(url: string, thirdParty: boolean): NetworkRule[];
}
