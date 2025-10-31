/**
 * Thumbnail Worker Manager
 * Manages OffscreenCanvas workers for async thumbnail rendering
 */

class ThumbnailManager {
    constructor() {
        this.worker = null;
        this.supportsOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';
        this.pendingThumbnails = new Map(); // frameIndex -> {resolve, reject}
        this.isInitialized = false;
    }

    /**
     * Initialize the worker
     */
    init() {
        if (this.isInitialized) return;

        if (this.supportsOffscreenCanvas) {
            try {
                // Create worker
                this.worker = new Worker(new URL('../workers/thumbnail.worker.js', import.meta.url), {
                    type: 'module'
                });

                // Handle messages from worker
                this.worker.onmessage = (e) => {
                    this.handleWorkerMessage(e.data);
                };

                // Handle errors
                this.worker.onerror = (error) => {
                    console.error('Thumbnail worker error:', error);
                    this.supportsOffscreenCanvas = false; // Fallback to main thread
                };

                this.isInitialized = true;
                console.log('✅ Thumbnail worker initialized');
            } catch (error) {
                console.warn('Failed to initialize thumbnail worker:', error);
                this.supportsOffscreenCanvas = false;
            }
        } else {
            console.log('OffscreenCanvas not supported, using main thread rendering');
        }
    }

    /**
     * Handle messages from worker
     */
    handleWorkerMessage(data) {
        const { type, frameIndex, bitmap, error } = data;

        const pending = this.pendingThumbnails.get(frameIndex);
        if (!pending) return;

        this.pendingThumbnails.delete(frameIndex);

        if (type === 'thumbnail') {
            pending.resolve(bitmap);
        } else if (type === 'error') {
            pending.reject(new Error(error));
        }
    }

    /**
     * Render a thumbnail using the worker
     * Returns a Promise that resolves with an ImageBitmap
     */
    renderThumbnail(frameIndex, shapes, width, height, backgroundColor, colors, gridCells) {
        // If worker not available, return null to use fallback
        if (!this.supportsOffscreenCanvas || !this.worker) {
            return null;
        }

        return new Promise((resolve, reject) => {
            // Store promise handlers
            this.pendingThumbnails.set(frameIndex, { resolve, reject });

            // Send render request to worker
            this.worker.postMessage({
                type: 'render',
                data: {
                    frameIndex,
                    shapes,
                    width,
                    height,
                    backgroundColor,
                    colors,
                    gridCells
                }
            });

            // Timeout after 5 seconds
            setTimeout(() => {
                if (this.pendingThumbnails.has(frameIndex)) {
                    this.pendingThumbnails.delete(frameIndex);
                    reject(new Error('Thumbnail render timeout'));
                }
            }, 5000);
        });
    }

    /**
     * Check if worker is available
     */
    isAvailable() {
        return this.supportsOffscreenCanvas && this.worker !== null;
    }

    /**
     * Terminate the worker
     */
    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
            this.isInitialized = false;
            this.pendingThumbnails.clear();
            console.log('Thumbnail worker terminated');
        }
    }
}

// Export singleton instance
export const thumbnailManager = new ThumbnailManager();
