/**
 * ImageData Buffer Manager
 * Batches pixel operations to reduce canvas fillRect calls
 * Provides significant performance boost for filled shapes
 */

export class ImageDataBuffer {
    constructor(ctx, width, height, scale) {
        this.ctx = ctx;
        this.width = width;
        this.height = height;
        this.scale = scale;

        // Create ImageData buffer for batching pixel writes
        this.scaledWidth = width * scale;
        this.scaledHeight = height * scale;
        this.imageData = ctx.createImageData(this.scaledWidth, this.scaledHeight);
        this.data = this.imageData.data;

        // Track dirty regions for partial updates (optimization)
        this.isDirty = false;
        this.dirtyMinX = Infinity;
        this.dirtyMinY = Infinity;
        this.dirtyMaxX = -Infinity;
        this.dirtyMaxY = -Infinity;

        // Color cache for faster RGB lookups
        this.colorCache = new Map();
    }

    /**
     * Parse hex color to RGB with caching
     */
    parseColor(hexColor) {
        if (this.colorCache.has(hexColor)) {
            return this.colorCache.get(hexColor);
        }

        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexColor);
        const rgb = result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };

        this.colorCache.set(hexColor, rgb);
        return rgb;
    }

    /**
     * Set a single pixel in the buffer
     */
    setPixel(x, y, color) {
        const { r, g, b } = this.parseColor(color);

        // Draw scaled pixel (scale x scale block)
        for (let sy = 0; sy < this.scale; sy++) {
            for (let sx = 0; sx < this.scale; sx++) {
                const px = x * this.scale + sx;
                const py = y * this.scale + sy;

                if (px >= 0 && px < this.scaledWidth && py >= 0 && py < this.scaledHeight) {
                    const index = (py * this.scaledWidth + px) * 4;
                    this.data[index] = r;
                    this.data[index + 1] = g;
                    this.data[index + 2] = b;
                    this.data[index + 3] = 255; // Alpha
                }
            }
        }

        this.markDirty(x, y);
    }

    /**
     * Fill a rectangle in the buffer
     */
    fillRect(x, y, width, height, color) {
        const { r, g, b } = this.parseColor(color);

        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                const px = x + dx;
                const py = y + dy;

                // Draw scaled pixel
                for (let sy = 0; sy < this.scale; sy++) {
                    for (let sx = 0; sx < this.scale; sx++) {
                        const spx = px * this.scale + sx;
                        const spy = py * this.scale + sy;

                        if (spx >= 0 && spx < this.scaledWidth && spy >= 0 && spy < this.scaledHeight) {
                            const index = (spy * this.scaledWidth + spx) * 4;
                            this.data[index] = r;
                            this.data[index + 1] = g;
                            this.data[index + 2] = b;
                            this.data[index + 3] = 255;
                        }
                    }
                }
            }
        }

        this.markDirty(x, y);
        this.markDirty(x + width - 1, y + height - 1);
    }

    /**
     * Mark a pixel region as dirty
     */
    markDirty(x, y) {
        this.isDirty = true;
        const scaledX = x * this.scale;
        const scaledY = y * this.scale;

        this.dirtyMinX = Math.min(this.dirtyMinX, scaledX);
        this.dirtyMinY = Math.min(this.dirtyMinY, scaledY);
        this.dirtyMaxX = Math.max(this.dirtyMaxX, scaledX + this.scale);
        this.dirtyMaxY = Math.max(this.dirtyMaxY, scaledY + this.scale);
    }

    /**
     * Flush the buffer to the canvas (full update)
     */
    flush() {
        if (!this.isDirty) return;

        // Write entire ImageData to canvas
        this.ctx.putImageData(this.imageData, 0, 0);

        this.isDirty = false;
        this.resetDirtyRegion();
    }

    /**
     * Flush only the dirty region (partial update - faster)
     */
    flushDirty() {
        if (!this.isDirty) return;

        // Clamp to valid bounds
        const x = Math.max(0, Math.floor(this.dirtyMinX));
        const y = Math.max(0, Math.floor(this.dirtyMinY));
        const width = Math.min(this.scaledWidth - x, Math.ceil(this.dirtyMaxX - this.dirtyMinX));
        const height = Math.min(this.scaledHeight - y, Math.ceil(this.dirtyMaxY - this.dirtyMinY));

        if (width <= 0 || height <= 0) {
            this.isDirty = false;
            return;
        }

        // Extract dirty region
        const dirtyData = this.ctx.createImageData(width, height);
        const sourceData = this.data;
        const destData = dirtyData.data;

        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                const sourceIndex = ((y + dy) * this.scaledWidth + (x + dx)) * 4;
                const destIndex = (dy * width + dx) * 4;

                destData[destIndex] = sourceData[sourceIndex];
                destData[destIndex + 1] = sourceData[sourceIndex + 1];
                destData[destIndex + 2] = sourceData[sourceIndex + 2];
                destData[destIndex + 3] = sourceData[sourceIndex + 3];
            }
        }

        // Write only dirty region to canvas
        this.ctx.putImageData(dirtyData, x, y);

        this.isDirty = false;
        this.resetDirtyRegion();
    }

    /**
     * Reset dirty region tracking
     */
    resetDirtyRegion() {
        this.dirtyMinX = Infinity;
        this.dirtyMinY = Infinity;
        this.dirtyMaxX = -Infinity;
        this.dirtyMaxY = -Infinity;
    }

    /**
     * Clear the buffer
     */
    clear() {
        this.data.fill(0);
        this.isDirty = false;
        this.resetDirtyRegion();
    }

    /**
     * Resize the buffer
     */
    resize(width, height, scale) {
        this.width = width;
        this.height = height;
        this.scale = scale;
        this.scaledWidth = width * scale;
        this.scaledHeight = height * scale;

        this.imageData = this.ctx.createImageData(this.scaledWidth, this.scaledHeight);
        this.data = this.imageData.data;

        this.clear();
    }

    /**
     * Get buffer statistics
     */
    getStats() {
        return {
            width: this.width,
            height: this.height,
            scale: this.scale,
            scaledSize: this.scaledWidth * this.scaledHeight,
            bufferSize: this.data.length,
            isDirty: this.isDirty,
            dirtyArea: this.isDirty ?
                (this.dirtyMaxX - this.dirtyMinX) * (this.dirtyMaxY - this.dirtyMinY) : 0
        };
    }
}
