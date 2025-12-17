import { isValidString, isValidQuarter, isValidYear, isValidReleaseType } from './validation.js';

export function parseReleaseName(name) {
    if (!isValidString(name)) {
        throw new Error('Release name must be a non-empty string');
    }

    // format: "1Q QR 2026"
    const parts = name.split(' ');
    if (parts.length !== 3) {
        throw new Error('Release name must match format: "1Q QR 2026"');
    }

    const [quarter, type, year] = parts;

    if (!isValidQuarter(quarter)) {
        throw new Error(`Invalid quarter: ${quarter}`);
    }
    if (!isValidReleaseType(type)) {
        throw new Error(`Invalid release type: ${type}`);
    }
    if (!isValidYear(year)) {
        throw new Error(`Invalid year: ${year}`);
    }

    return { quarter, type, year };
}

export function createRelease(id, name, createdAt) {
    if (!isValidString(id)) {
        throw new Error('Release ID is required');
    }
    if (!isValidString(createdAt)) {
        throw new Error('Release createdAt timestamp is required');
    }

    const { quarter, type, year } = parseReleaseName(name);

    return {
        id,
        name,
        quarter,
        type,
        year,
        createdAt
    };
}
