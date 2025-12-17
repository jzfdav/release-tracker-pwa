import { isValidQuarter, isValidYear, isValidReleaseType } from './validation.js';

function toLowerQuarter(quarter) {
    return quarter.toLowerCase();
}

/**
 * Derives the feature branch name dynamically.
 * Format: fb-common-dev-{{quarter}}{{year}}
 */
export function getFeatureBranchName(quarter, year) {
    if (!isValidQuarter(quarter) || !isValidYear(year)) {
        throw new Error('Invalid quarter or year for feature branch generation');
    }
    const q = toLowerQuarter(quarter);
    return `fb-common-dev-${q}${year}`;
}

/**
 * Derives the release branch name dynamically based on type.
 * QR: release_{{quarter}}{{year}}
 * MR: release_minor_{{quarter}}{{year}}
 */
export function getReleaseBranchName(quarter, year, type) {
    if (!isValidQuarter(quarter) || !isValidYear(year) || !isValidReleaseType(type)) {
        throw new Error('Invalid parameters for release branch generation');
    }
    const q = toLowerQuarter(quarter);

    if (type === 'QR') {
        return `release_${q}${year}`;
    } else {
        // MR
        return `release_minor_${q}${year}`;
    }
}
