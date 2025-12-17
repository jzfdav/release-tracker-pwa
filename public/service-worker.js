const CACHE_NAME = 'release-tracker-v1';
const DB_NAME = 'release-branching-db';
const DB_VERSION = 1;

// Browsers clamp/drop large setTimeout values. 
// We use a 60min window to re-check and re-schedule if needed.
const MAX_TIMEOUT = 3600000;

// Tracks active timers to prevent duplicates and reconcile state
const timerRegistry = new Map();

// --- IndexedDB Helpers (Minimal) ---
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

function getAll(storeName) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    });
}

function get(storeName, key) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    });
}

function update(storeName, item) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(item);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    });
}

// --- Notification Logic ---

function getDelay(scheduleDate) {
    const now = new Date();
    const delay = scheduleDate - now;
    return Math.max(0, delay);
}

// Logic to check DB and schedule/fire accurately
async function checkAndScheduleNotifications() {
    try {
        const allNotifications = await getAll('notifications');
        const activeIdsInDB = new Set();

        for (const n of allNotifications) {
            // Reconcile: If already scheduled, just track it and skip
            if (timerRegistry.has(n.id)) {
                activeIdsInDB.add(n.id);
                continue;
            }

            if (n.firedAt || n.suppressed) continue;

            const scheduleDate = new Date(n.scheduledFor);
            // Guard against invalid data
            if (isNaN(scheduleDate.getTime())) {
                console.warn(`SW: Skipping notification ${n.id} due to invalid date.`);
                continue;
            }

            activeIdsInDB.add(n.id);
            const delay = getDelay(scheduleDate);

            // If due or nearly due (within 1 second)
            if (delay <= 1000) {
                await fireNotification(n);
            } else {
                // Handle setTimeout limits: fire now or schedule a re-recheck
                const timeoutDelay = Math.min(delay, MAX_TIMEOUT);

                const timerId = setTimeout(() => {
                    timerRegistry.delete(n.id);
                    if (delay > MAX_TIMEOUT) {
                        // Beyond window: wake up and re-run scheduler
                        checkAndScheduleNotifications();
                    } else {
                        // Within window: fire the real alert
                        fireNotification(n);
                    }
                }, timeoutDelay);

                timerRegistry.set(n.id, timerId);
            }
        }

        // Cleanup: Remove timers for notifications no longer in DB or suppressed
        for (const [id, timerId] of timerRegistry.entries()) {
            if (!activeIdsInDB.has(id)) {
                clearTimeout(timerId);
                timerRegistry.delete(id);
            }
        }

    } catch (err) {
        console.error('SW: Error checking notifications', err);
    }
}

async function fireNotification(n) {
    // Cleanup registry entry
    timerRegistry.delete(n.id);

    try {
        // Double-check status before showing (handles race conditions)
        const currentN = await get('notifications', n.id);
        if (!currentN || currentN.firedAt || currentN.suppressed) return;

        const task = await get('tasks', n.taskId);
        if (!task || task.status !== 'PLANNED') {
            currentN.suppressed = true;
            await update('notifications', currentN);
            return;
        }

        const title = "Release Task Reminder";
        const options = {
            body: `${task.title}`,
            tag: n.id
        };

        await self.registration.showNotification(title, options);

        currentN.firedAt = new Date().toISOString();
        await update('notifications', currentN);

    } catch (err) {
        console.error('SW: Error firing notification', err);
    }
}


// --- Lifecycle Events ---

self.addEventListener('install', event => {
    console.log('Service Worker: Installed');
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('Service Worker: Activated');
    event.waitUntil(
        Promise.all([
            clients.claim(),
            checkAndScheduleNotifications()
        ])
    );
});

self.addEventListener('message', event => {
    if (event.data === 'CHECK_NOTIFICATIONS') {
        // Triggered by main.js when reminders are added/changed
        checkAndScheduleNotifications();
    }
});

