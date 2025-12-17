import { upgradeV1 } from './migrations.js';

const DB_NAME = 'release-branching-db';
const DB_VERSION = 1;

/**
 * Opens a connection to the IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('Database error:', event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (event.oldVersion < 1) {
                upgradeV1(db);
            }
        };
    });
}

export function add(storeName, item) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(item);

            transaction.oncomplete = () => {
                db.close();
                resolve(request.result);
            };

            transaction.onerror = () => {
                db.close();
                reject(transaction.error);
            };

            transaction.onabort = () => {
                db.close();
                reject(transaction.error);
            };
        });
    });
}

export function get(storeName, key) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            transaction.oncomplete = () => {
                db.close();
                resolve(request.result);
            };

            transaction.onerror = () => {
                db.close();
                reject(transaction.error);
            };
        });
    });
}

export function getAll(storeName) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            transaction.oncomplete = () => {
                db.close();
                resolve(request.result);
            };

            transaction.onerror = () => {
                db.close();
                reject(transaction.error);
            };
        });
    });
}

export function update(storeName, item) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(item);

            transaction.oncomplete = () => {
                db.close();
                resolve(request.result);
            };

            transaction.onerror = () => {
                db.close();
                reject(transaction.error);
            };

            transaction.onabort = () => {
                db.close();
                reject(transaction.error);
            };
        });
    });
}

export function remove(storeName, key) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            transaction.oncomplete = () => {
                db.close();
                resolve(request.result);
            };

            transaction.onerror = () => {
                db.close();
                reject(transaction.error);
            };

            transaction.onabort = () => {
                db.close();
                reject(transaction.error);
            };
        });
    });
}

export function queryByIndex(storeName, indexName, value) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);

            transaction.oncomplete = () => {
                db.close();
                resolve(request.result);
            };

            transaction.onerror = () => {
                db.close();
                reject(transaction.error);
            };
        });
    });
}
