import { isValidTaskStatus } from './validation.js';

export function createTask({
    id,
    releaseId,
    sequence,
    title,
    description = '',
    branchFrom = null,
    branchTo = null,
    proposedDateTime = null
}) {
    if (!id) throw new Error('Task ID is required');
    if (!releaseId) throw new Error('Release ID is required');
    if (typeof sequence !== 'number') throw new Error('Sequence number is required');
    if (!title) throw new Error('Title is required');

    return {
        id,
        releaseId,
        sequence,
        title,
        description,
        branchFrom,
        branchTo, // Can be string or array of strings
        status: 'PLANNED',
        proposedDateTime, // ISO string
        completedAt: null
    };
}

/**
 * Returns a NEW task object with the updated status.
 * Pure function: does not mutate the original task.
 */
export function updateTaskStatus(task, newStatus, timestamp) {
    if (!isValidTaskStatus(newStatus)) {
        throw new Error(`Invalid status: ${newStatus}`);
    }

    const updatedTask = { ...task, status: newStatus };

    if (newStatus === 'DONE') {
        if (!timestamp || typeof timestamp !== 'string') {
            throw new Error('Timestamp is required when completion status is DONE');
        }
        updatedTask.completedAt = timestamp;
    } else {
        // If moving back from DONE to PLANNED or NOT_APPLICABLE, clear completedAt
        updatedTask.completedAt = null;
    }

    return updatedTask;
}

export function isTaskComplete(task) {
    return task.status === 'DONE';
}
