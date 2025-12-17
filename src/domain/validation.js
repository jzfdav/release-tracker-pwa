export const RELEASE_TYPES = ['QR', 'MR'];
export const QUARTERS = ['1Q', '2Q', '3Q', '4Q'];
export const TASK_STATUSES = ['PLANNED', 'DONE', 'NOT_APPLICABLE'];

export function isValidString(str) {
    return typeof str === 'string' && str.trim().length > 0;
}

export function isValidYear(year) {
    const y = Number(year);
    return Number.isInteger(y) && y >= 2000 && y <= 2100;
}

export function isValidQuarter(quarter) {
    return QUARTERS.includes(quarter);
}

export function isValidReleaseType(type) {
    return RELEASE_TYPES.includes(type);
}

export function isValidTaskStatus(status) {
    return TASK_STATUSES.includes(status);
}
