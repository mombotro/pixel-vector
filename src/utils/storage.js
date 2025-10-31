/**
 * IndexedDB Storage Utilities
 * Handles auto-save and crash recovery for the editor
 */

const DB_NAME = 'AzironaVexelEditDB';
const DB_VERSION = 1;
const STORE_NAME = 'projects';
const AUTOSAVE_KEY = 'autosave';

class StorageManager {
    constructor() {
        this.db = null;
        this.autoSaveInterval = null;
        this.autoSaveDelay = 30000; // 30 seconds default
        this.lastSaveTime = 0;
        this.isDirty = false;
        this.onSaveCallback = null;
    }

    /**
     * Initialize the IndexedDB database
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('IndexedDB error:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ IndexedDB initialized');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log('Created IndexedDB object store');
                }
            };
        });
    }

    /**
     * Save project data to IndexedDB
     */
    async saveProject(id, data, isAutoSave = false) {
        if (!this.db) {
            console.warn('IndexedDB not initialized');
            return false;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            const projectData = {
                id: id,
                data: data,
                timestamp: Date.now(),
                isAutoSave: isAutoSave
            };

            const request = store.put(projectData);

            request.onsuccess = () => {
                this.lastSaveTime = Date.now();
                this.isDirty = false;
                if (isAutoSave) {
                    console.log('💾 Auto-saved to IndexedDB');
                }
                if (this.onSaveCallback) {
                    this.onSaveCallback(isAutoSave);
                }
                resolve(true);
            };

            request.onerror = () => {
                console.error('Failed to save to IndexedDB:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Load project data from IndexedDB
     */
    async loadProject(id) {
        if (!this.db) {
            console.warn('IndexedDB not initialized');
            return null;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => {
                console.error('Failed to load from IndexedDB:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Delete project from IndexedDB
     */
    async deleteProject(id) {
        if (!this.db) {
            console.warn('IndexedDB not initialized');
            return false;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => {
                console.log('Deleted project from IndexedDB');
                resolve(true);
            };

            request.onerror = () => {
                console.error('Failed to delete from IndexedDB:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Check if there's an auto-save available (for crash recovery)
     */
    async checkAutoSave() {
        const autoSave = await this.loadProject(AUTOSAVE_KEY);
        if (autoSave && autoSave.isAutoSave) {
            return {
                exists: true,
                timestamp: autoSave.timestamp,
                data: autoSave.data
            };
        }
        return { exists: false };
    }

    /**
     * Start auto-save timer
     */
    startAutoSave(saveCallback, interval = 30000) {
        this.autoSaveDelay = interval;

        // Clear existing interval if any
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }

        this.autoSaveInterval = setInterval(async () => {
            // Only auto-save if there are changes
            if (this.isDirty) {
                try {
                    const data = saveCallback();
                    await this.saveProject(AUTOSAVE_KEY, data, true);
                } catch (error) {
                    console.error('Auto-save failed:', error);
                }
            }
        }, this.autoSaveDelay);

        console.log(`🔄 Auto-save enabled (every ${interval / 1000}s)`);
    }

    /**
     * Stop auto-save timer
     */
    stopAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
            console.log('Auto-save disabled');
        }
    }

    /**
     * Mark data as dirty (needs saving)
     */
    markDirty() {
        this.isDirty = true;
    }

    /**
     * Get time since last save
     */
    getTimeSinceLastSave() {
        if (this.lastSaveTime === 0) return null;
        return Date.now() - this.lastSaveTime;
    }

    /**
     * Set callback for save events
     */
    setSaveCallback(callback) {
        this.onSaveCallback = callback;
    }

    /**
     * Format timestamp for display
     */
    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        // Less than 1 minute
        if (diff < 60000) {
            return 'just now';
        }
        // Less than 1 hour
        if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        }
        // Less than 24 hours
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        }
        // Show date
        return date.toLocaleString();
    }
}

// Export singleton instance
export const storageManager = new StorageManager();
