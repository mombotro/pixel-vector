/**
 * Thumbnail Rendering Worker
 * Renders frame thumbnails using OffscreenCanvas to keep UI responsive
 */

// Worker message handler
self.onmessage = function(e) {
    const { type, data } = e.data;

    switch (type) {
        case 'render':
            renderThumbnail(data);
            break;
        default:
            console.warn('Unknown worker message type:', type);
    }
};

/**
 * Render a frame thumbnail
 */
function renderThumbnail(data) {
    const {
        frameIndex,
        shapes,
        width,
        height,
        backgroundColor,
        colors,
        gridCells
    } = data;

    try {
        // Create OffscreenCanvas
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        // Fill background
        ctx.fillStyle = backgroundColor || '#0f3460';
        ctx.fillRect(0, 0, width, height);

        // Calculate scale to fit thumbnail
        const scale = 1; // Thumbnails are pre-scaled by caller

        // Render each shape
        shapes.forEach(shape => {
            drawShape(ctx, shape, colors, scale, gridCells, width, height);
        });

        // Convert to ImageBitmap for efficient transfer
        canvas.convertToBlob().then(blob => {
            createImageBitmap(blob).then(bitmap => {
                // Send result back to main thread
                self.postMessage({
                    type: 'thumbnail',
                    frameIndex: frameIndex,
                    bitmap: bitmap
                }, [bitmap]); // Transfer bitmap ownership
            });
        });

    } catch (error) {
        // Send error back to main thread
        self.postMessage({
            type: 'error',
            frameIndex: frameIndex,
            error: error.message
        });
    }
}

/**
 * Draw a shape on the canvas
 */
function drawShape(ctx, shape, colors, scale, gridCells, canvasWidth, canvasHeight) {
    const color = colors[shape.color] || '#ffffff';
    const outline = shape.outline || false;

    switch (shape.type) {
        case 'line':
            if (shape.points.length >= 2) {
                for (let i = 0; i < shape.points.length - 1; i++) {
                    drawLine(ctx, shape.points[i], shape.points[i + 1], color, scale);
                }
            }
            break;
        case 'rect':
            drawRect(ctx, shape.points, color, outline, scale);
            break;
        case 'circle':
            drawCircle(ctx, shape.points, color, outline, scale);
            break;
        case 'oval':
            drawOval(ctx, shape.points, color, outline, scale);
            break;
        case 'triangle':
        case 'polygon':
            drawPolygon(ctx, shape.points, color, outline, scale);
            break;
    }
}

/**
 * Draw a line
 */
function drawLine(ctx, p1, p2, color, scale) {
    ctx.strokeStyle = color;
    ctx.lineWidth = scale;
    ctx.beginPath();
    ctx.moveTo(p1.x * scale, p1.y * scale);
    ctx.lineTo(p2.x * scale, p2.y * scale);
    ctx.stroke();
}

/**
 * Draw a rectangle
 */
function drawRect(ctx, points, color, outline, scale) {
    if (points.length < 2) return;

    const x = Math.min(points[0].x, points[1].x) * scale;
    const y = Math.min(points[0].y, points[1].y) * scale;
    const w = Math.abs(points[1].x - points[0].x) * scale;
    const h = Math.abs(points[1].y - points[0].y) * scale;

    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    if (outline) {
        ctx.lineWidth = scale;
        ctx.strokeRect(x, y, w, h);
    } else {
        ctx.fillRect(x, y, w, h);
    }
}

/**
 * Draw a circle
 */
function drawCircle(ctx, points, color, outline, scale) {
    if (points.length < 2) return;

    const cx = points[0].x * scale;
    const cy = points[0].y * scale;
    const dx = (points[1].x - points[0].x) * scale;
    const dy = (points[1].y - points[0].y) * scale;
    const radius = Math.sqrt(dx * dx + dy * dy);

    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);

    if (outline) {
        ctx.lineWidth = scale;
        ctx.stroke();
    } else {
        ctx.fill();
    }
}

/**
 * Draw an oval
 */
function drawOval(ctx, points, color, outline, scale) {
    if (points.length < 2) return;

    const cx = ((points[0].x + points[1].x) / 2) * scale;
    const cy = ((points[0].y + points[1].y) / 2) * scale;
    const rx = Math.abs(points[1].x - points[0].x) / 2 * scale;
    const ry = Math.abs(points[1].y - points[0].y) / 2 * scale;

    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);

    if (outline) {
        ctx.lineWidth = scale;
        ctx.stroke();
    } else {
        ctx.fill();
    }
}

/**
 * Draw a polygon
 */
function drawPolygon(ctx, points, color, outline, scale) {
    if (points.length < 2) return;

    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(points[0].x * scale, points[0].y * scale);

    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x * scale, points[i].y * scale);
    }

    ctx.closePath();

    if (outline) {
        ctx.lineWidth = scale;
        ctx.stroke();
    } else {
        ctx.fill();
    }
}
