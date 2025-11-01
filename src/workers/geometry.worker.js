/**
 * Geometry Worker
 * Handles heavy boolean operations and polygon simplification off the main thread
 */

// Worker message handler
self.onmessage = function(e) {
    const { type, data } = e.data;

    switch (type) {
        case 'booleanUnion':
            handleBooleanUnion(data);
            break;
        case 'booleanSubtract':
            handleBooleanSubtract(data);
            break;
        case 'booleanIntersect':
            handleBooleanIntersect(data);
            break;
        case 'simplifyPolygon':
            handleSimplifyPolygon(data);
            break;
        default:
            console.warn('Unknown geometry worker message type:', type);
    }
};

/**
 * Handle boolean union operation
 */
function handleBooleanUnion(data) {
    const { shapes, canvasWidth, canvasHeight, color, requestId } = data;

    try {
        // Rasterize all shapes and combine pixels
        const pixels = rasterizeShapes(shapes, canvasWidth, canvasHeight);

        // Convert pixels back to polygon
        const result = pixelsToPolygon(pixels, color, canvasWidth, canvasHeight);

        self.postMessage({
            type: 'booleanComplete',
            requestId: requestId,
            result: result
        });
    } catch (error) {
        self.postMessage({
            type: 'error',
            requestId: requestId,
            error: error.message
        });
    }
}

/**
 * Handle boolean subtract operation
 */
function handleBooleanSubtract(data) {
    const { baseShape, subtractShape, canvasWidth, canvasHeight, color, requestId } = data;

    try {
        // Rasterize both shapes
        const basePixels = rasterizeShapes([baseShape], canvasWidth, canvasHeight);
        const subtractPixels = rasterizeShapes([subtractShape], canvasWidth, canvasHeight);

        // Remove subtract pixels from base
        subtractPixels.forEach(key => basePixels.delete(key));

        // Convert back to polygon
        const result = pixelsToPolygon(basePixels, color, canvasWidth, canvasHeight);

        self.postMessage({
            type: 'booleanComplete',
            requestId: requestId,
            result: result
        });
    } catch (error) {
        self.postMessage({
            type: 'error',
            requestId: requestId,
            error: error.message
        });
    }
}

/**
 * Handle boolean intersect operation
 */
function handleBooleanIntersect(data) {
    const { baseShape, intersectShape, canvasWidth, canvasHeight, color, requestId } = data;

    try {
        // Rasterize both shapes
        const basePixels = rasterizeShapes([baseShape], canvasWidth, canvasHeight);
        const intersectPixels = rasterizeShapes([intersectShape], canvasWidth, canvasHeight);

        // Keep only common pixels
        const result = new Set();
        basePixels.forEach(key => {
            if (intersectPixels.has(key)) result.add(key);
        });

        // Convert back to polygon
        const polygon = pixelsToPolygon(result, color, canvasWidth, canvasHeight);

        self.postMessage({
            type: 'booleanComplete',
            requestId: requestId,
            result: polygon
        });
    } catch (error) {
        self.postMessage({
            type: 'error',
            requestId: requestId,
            error: error.message
        });
    }
}

/**
 * Handle polygon simplification
 */
function handleSimplifyPolygon(data) {
    const { points, tolerance, requestId } = data;

    try {
        const simplified = simplifyPolygon(points, tolerance);

        self.postMessage({
            type: 'simplifyComplete',
            requestId: requestId,
            result: simplified
        });
    } catch (error) {
        self.postMessage({
            type: 'error',
            requestId: requestId,
            error: error.message
        });
    }
}

/**
 * Rasterize shapes to pixel set using OffscreenCanvas
 */
function rasterizeShapes(shapes, canvasWidth, canvasHeight) {
    const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;

    const pixels = new Set();

    shapes.forEach(shape => {
        // Clear canvas
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        // Draw shape
        drawShape(ctx, shape, 1); // scale = 1

        // Extract pixels
        const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
        const data = new Uint32Array(imageData.data.buffer);

        for (let i = 0; i < data.length; i++) {
            if (data[i] !== 0) { // Has alpha
                const x = i % canvasWidth;
                const y = Math.floor(i / canvasWidth);
                pixels.add(`${x},${y}`);
            }
        }
    });

    return pixels;
}

/**
 * Draw a shape on canvas (simplified version for boolean ops)
 */
function drawShape(ctx, shape, scale) {
    ctx.fillStyle = '#000000'; // Color doesn't matter for boolean ops
    ctx.strokeStyle = '#000000';

    switch (shape.type) {
        case 'rect':
            if (shape.points.length >= 2) {
                const x = Math.min(shape.points[0].x, shape.points[1].x) * scale;
                const y = Math.min(shape.points[0].y, shape.points[1].y) * scale;
                const w = Math.abs(shape.points[1].x - shape.points[0].x) * scale;
                const h = Math.abs(shape.points[1].y - shape.points[0].y) * scale;
                ctx.fillRect(x, y, w, h);
            }
            break;
        case 'circle':
            if (shape.points.length >= 2) {
                const cx = shape.points[0].x * scale;
                const cy = shape.points[0].y * scale;
                const dx = (shape.points[1].x - shape.points[0].x) * scale;
                const dy = (shape.points[1].y - shape.points[0].y) * scale;
                const radius = Math.sqrt(dx * dx + dy * dy);
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.fill();
            }
            break;
        case 'oval':
            if (shape.points.length >= 2) {
                const cx = ((shape.points[0].x + shape.points[1].x) / 2) * scale;
                const cy = ((shape.points[0].y + shape.points[1].y) / 2) * scale;
                const rx = Math.abs(shape.points[1].x - shape.points[0].x) / 2 * scale;
                const ry = Math.abs(shape.points[1].y - shape.points[0].y) / 2 * scale;
                ctx.beginPath();
                ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            break;
        case 'triangle':
        case 'polygon':
        case 'line':
            if (shape.points.length >= 2) {
                ctx.beginPath();
                ctx.moveTo(shape.points[0].x * scale, shape.points[0].y * scale);
                for (let i = 1; i < shape.points.length; i++) {
                    ctx.lineTo(shape.points[i].x * scale, shape.points[i].y * scale);
                }
                ctx.closePath();
                ctx.fill();
            }
            break;
    }
}

/**
 * Convert pixel set to polygon using marching squares
 */
function pixelsToPolygon(pixels, color, canvasWidth, canvasHeight) {
    if (pixels.size === 0) return null;

    // Find bounding box
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    pixels.forEach(key => {
        const [x, y] = key.split(',').map(Number);
        minX = minX < x ? minX : x;
        minY = minY < y ? minY : y;
        maxX = maxX > x ? maxX : x;
        maxY = maxY > y ? maxY : y;
    });

    // Create grid for marching squares
    const grid = [];
    for (let y = minY - 1; y <= maxY + 1; y++) {
        const row = [];
        for (let x = minX - 1; x <= maxX + 1; x++) {
            row.push(pixels.has(`${x},${y}`) ? 1 : 0);
        }
        grid.push(row);
    }

    // Trace outline
    const outlinePoints = marchingSquares(grid, minX - 1, minY - 1);

    if (outlinePoints.length < 3) return null;

    // Simplify polygon (aggressive for boolean ops)
    const simplifiedPoints = simplifyPolygon(outlinePoints, 5.0);

    return {
        type: 'polygon',
        points: simplifiedPoints,
        color: color,
        lineWidth: 1,
        outline: false
    };
}

/**
 * Marching squares algorithm to trace pixel outline
 */
function marchingSquares(grid, offsetX, offsetY) {
    const height = grid.length;
    const width = grid[0].length;

    // Find edge pixels
    const edgePixels = [];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (grid[y][x] === 1) {
                const hasEmptyNeighbor =
                    (x === 0 || grid[y][x-1] === 0) ||
                    (x === width-1 || grid[y][x+1] === 0) ||
                    (y === 0 || grid[y-1][x] === 0) ||
                    (y === height-1 || grid[y+1][x] === 0);

                if (hasEmptyNeighbor) {
                    edgePixels.push({ x: offsetX + x, y: offsetY + y });
                }
            }
        }
    }

    if (edgePixels.length === 0) return [];

    // Find topmost-leftmost point
    edgePixels.sort((a, b) => {
        if (a.y !== b.y) return a.y - b.y;
        return a.x - b.x;
    });

    // Trace contour
    const contour = [edgePixels[0]];
    const used = new Set([0]);

    while (contour.length < edgePixels.length && contour.length < 500) {
        const current = contour[contour.length - 1];
        let nearestIdx = -1;
        let nearestDist = Infinity;

        for (let i = 0; i < edgePixels.length; i++) {
            if (used.has(i)) continue;

            const p = edgePixels[i];
            const dx = p.x - current.x;
            const dy = p.y - current.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= 1.5 && dist < nearestDist) {
                nearestDist = dist;
                nearestIdx = i;
            }
        }

        if (nearestIdx === -1) break;

        contour.push(edgePixels[nearestIdx]);
        used.add(nearestIdx);
    }

    return simplifyPolygon(contour, 0.5);
}

/**
 * Simplify polygon using Douglas-Peucker-like algorithm
 */
function simplifyPolygon(points, tolerance = 2.0) {
    if (points.length < 3) return points;

    // Remove duplicates
    const deduplicated = [];
    const minDistance = 1.5;

    for (let i = 0; i < points.length; i++) {
        const curr = points[i];
        const next = points[(i + 1) % points.length];

        const dx = next.x - curr.x;
        const dy = next.y - curr.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist >= minDistance) {
            deduplicated.push(curr);
        }
    }

    if (deduplicated.length < 3) return points;

    // Remove collinear points
    const simplified = [];

    for (let i = 0; i < deduplicated.length; i++) {
        const prev = deduplicated[(i - 1 + deduplicated.length) % deduplicated.length];
        const curr = deduplicated[i];
        const next = deduplicated[(i + 1) % deduplicated.length];

        const dx1 = curr.x - prev.x;
        const dy1 = curr.y - prev.y;
        const dx2 = next.x - curr.x;
        const dy2 = next.y - curr.y;

        const cross = Math.abs(dx1 * dy2 - dy1 * dx2);

        if (cross > tolerance) {
            simplified.push(curr);
        }
    }

    return simplified.length >= 3 ? simplified : deduplicated;
}
