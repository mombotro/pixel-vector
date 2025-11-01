/**
 * Geometry Worker Manager
 * Manages Web Worker for async geometry operations (boolean ops, simplification)
 */

class GeometryManager {
    constructor() {
        this.worker = null;
        this.supportsOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';
        this.pendingRequests = new Map(); // requestId -> {resolve, reject}
        this.requestIdCounter = 0;
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
                this.worker = new Worker(new URL('../workers/geometry.worker.js', import.meta.url), {
                    type: 'module'
                });

                // Handle messages from worker
                this.worker.onmessage = (e) => {
                    this.handleWorkerMessage(e.data);
                };

                // Handle errors
                this.worker.onerror = (error) => {
                    console.error('Geometry worker error:', error);
                    this.supportsOffscreenCanvas = false; // Fallback to main thread
                };

                this.isInitialized = true;
                console.log('✅ Geometry worker initialized');
            } catch (error) {
                console.warn('Failed to initialize geometry worker:', error);
                this.supportsOffscreenCanvas = false;
            }
        } else {
            console.log('OffscreenCanvas not supported, geometry operations will run on main thread');
        }
    }

    /**
     * Handle messages from worker
     */
    handleWorkerMessage(data) {
        const { type, requestId, result, error } = data;

        const pending = this.pendingRequests.get(requestId);
        if (!pending) return;

        this.pendingRequests.delete(requestId);

        if (type === 'booleanComplete' || type === 'simplifyComplete') {
            pending.resolve(result);
        } else if (type === 'error') {
            pending.reject(new Error(error));
        }
    }

    /**
     * Perform boolean union operation
     */
    booleanUnion(shapes, canvasWidth, canvasHeight, color) {
        if (!this.supportsOffscreenCanvas || !this.worker) {
            return null; // Fallback to main thread
        }

        return new Promise((resolve, reject) => {
            const requestId = this.requestIdCounter++;

            this.pendingRequests.set(requestId, { resolve, reject });

            this.worker.postMessage({
                type: 'booleanUnion',
                data: {
                    shapes: shapes,
                    canvasWidth: canvasWidth,
                    canvasHeight: canvasHeight,
                    color: color,
                    requestId: requestId
                }
            });

            // Timeout after 10 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Boolean union timeout'));
                }
            }, 10000);
        });
    }

    /**
     * Perform boolean subtract operation
     */
    booleanSubtract(baseShape, subtractShape, canvasWidth, canvasHeight, color) {
        if (!this.supportsOffscreenCanvas || !this.worker) {
            return null; // Fallback to main thread
        }

        return new Promise((resolve, reject) => {
            const requestId = this.requestIdCounter++;

            this.pendingRequests.set(requestId, { resolve, reject });

            this.worker.postMessage({
                type: 'booleanSubtract',
                data: {
                    baseShape: baseShape,
                    subtractShape: subtractShape,
                    canvasWidth: canvasWidth,
                    canvasHeight: canvasHeight,
                    color: color,
                    requestId: requestId
                }
            });

            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Boolean subtract timeout'));
                }
            }, 10000);
        });
    }

    /**
     * Perform boolean intersect operation
     */
    booleanIntersect(baseShape, intersectShape, canvasWidth, canvasHeight, color) {
        if (!this.supportsOffscreenCanvas || !this.worker) {
            return null; // Fallback to main thread
        }

        return new Promise((resolve, reject) => {
            const requestId = this.requestIdCounter++;

            this.pendingRequests.set(requestId, { resolve, reject });

            this.worker.postMessage({
                type: 'booleanIntersect',
                data: {
                    baseShape: baseShape,
                    intersectShape: intersectShape,
                    canvasWidth: canvasWidth,
                    canvasHeight: canvasHeight,
                    color: color,
                    requestId: requestId
                }
            });

            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Boolean intersect timeout'));
                }
            }, 10000);
        });
    }

    /**
     * Simplify polygon
     */
    simplifyPolygon(points, tolerance = 2.0) {
        if (!this.supportsOffscreenCanvas || !this.worker) {
            return null; // Fallback to main thread
        }

        return new Promise((resolve, reject) => {
            const requestId = this.requestIdCounter++;

            this.pendingRequests.set(requestId, { resolve, reject });

            this.worker.postMessage({
                type: 'simplifyPolygon',
                data: {
                    points: points,
                    tolerance: tolerance,
                    requestId: requestId
                }
            });

            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Simplify polygon timeout'));
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
            this.pendingRequests.clear();
            console.log('Geometry worker terminated');
        }
    }
}

// Export singleton instance
export const geometryManager = new GeometryManager();
