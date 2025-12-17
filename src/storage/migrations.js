/**
 * Applies version 1 schema upgrades.
 * Creates object stores and indexes for release branching domain.
 * @param {IDBDatabase} db 
 */
export function upgradeV1(db) {
    // 1. Releases Store
    if (!db.objectStoreNames.contains('releases')) {
        const releaseStore = db.createObjectStore('releases', { keyPath: 'id' });
        releaseStore.createIndex('year', 'year', { unique: false });
    }

    // 2. Templates Store
    if (!db.objectStoreNames.contains('templates')) {
        db.createObjectStore('templates', { keyPath: 'id' });
    }

    // 3. Tasks Store
    if (!db.objectStoreNames.contains('tasks')) {
        const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
        taskStore.createIndex('releaseId', 'releaseId', { unique: false });
        taskStore.createIndex('proposedDateTime', 'proposedDateTime', { unique: false });
    }

    // 4. Audit Events Store
    if (!db.objectStoreNames.contains('auditEvents')) {
        db.createObjectStore('auditEvents', { keyPath: 'id' });
    }

    // 5. Notifications Store
    if (!db.objectStoreNames.contains('notifications')) {
        const notificationStore = db.createObjectStore('notifications', { keyPath: 'id' });
        notificationStore.createIndex('taskId', 'taskId', { unique: false });
    }
}
