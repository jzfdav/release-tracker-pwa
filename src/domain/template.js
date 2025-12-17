export function createTemplate(id, name, releaseType, templateTasks) {
    return {
        id,
        name,
        releaseType, // 'QR' or 'MR'
        tasks: templateTasks // Array of template task definitions
    };
}

/**
 * Replaces placeholders in strings:
 * {{quarter}} -> "1Q"
 * {{year}} -> "2026"
 */
function resolvePlaceholders(text, context) {
    if (!text) return text;
    if (Array.isArray(text)) {
        return text.map(t => resolvePlaceholders(t, context));
    }

    let result = text;
    result = result.replace(/{{quarter}}/g, context.quarter);
    result = result.replace(/{{year}}/g, context.year);

    return result;
}

/**
 * Generates concrete Tasks from a Template for a specific Release.
 */
export function instantiateTemplate(template, release) {
    if (template.releaseType !== release.type) {
        throw new Error(`Template type ${template.releaseType} does not match release type ${release.type}`);
    }

    const context = {
        quarter: release.quarter,
        year: release.year
    };

    return template.tasks.map((tTask) => {
        return {
            id: null,
            releaseId: release.id,
            sequence: tTask.sequence,
            title: resolvePlaceholders(tTask.title, context),
            description: resolvePlaceholders(tTask.description, context),
            branchFrom: resolvePlaceholders(tTask.branchFrom, context),
            branchTo: resolvePlaceholders(tTask.branchTo, context),
            status: 'PLANNED',
            proposedDateTime: null,
            completedAt: null
        };
    });
}
