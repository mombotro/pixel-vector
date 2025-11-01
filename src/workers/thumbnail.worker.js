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
        gridCells,
        canvasWidth,
        canvasHeight
    } = data;

    try {
        // Create OffscreenCanvas for thumbnail (width x height, e.g. 64x64)
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        // Fill background
        ctx.fillStyle = backgroundColor || '#0f3460';
        ctx.fillRect(0, 0, width, height);

        // Calculate scale to fit actual canvas into thumbnail
        const scaleX = width / canvasWidth;
        const scaleY = height / canvasHeight;
        const scale = Math.min(scaleX, scaleY);

        // Use ctx.scale() transformation (same approach as preview)
        ctx.save();
        ctx.scale(scale, scale);

        // Render each shape with original coordinates (context is scaled, skip hidden)
        shapes.forEach(shape => {
            if (!shape.hidden) {
                drawShape(ctx, shape, colors);
            }
        });

        ctx.restore();

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
 * Draw a shape on the canvas (context is already scaled)
 */
function drawShape(ctx, shape, colors) {
    const color = colors[shape.color] || '#ffffff';
    const outline = shape.outline || false;

    switch (shape.type) {
        case 'line':
            if (shape.points.length >= 2) {
                for (let i = 0; i < shape.points.length - 1; i++) {
                    drawLine(ctx, shape.points[i], shape.points[i + 1], color);
                }
            }
            break;
        case 'rect':
            drawRect(ctx, shape.points, color, outline);
            break;
        case 'circle':
            drawCircle(ctx, shape.points, color, outline);
            break;
        case 'oval':
            drawOval(ctx, shape.points, color, outline);
            break;
        case 'triangle':
        case 'polygon':
            drawPolygon(ctx, shape.points, color, outline);
            break;
    }
}

/**
 * Draw a line
 */
function drawLine(ctx, p1, p2, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
}

/**
 * Draw a rectangle
 */
function drawRect(ctx, points, color, outline) {
    if (points.length < 2) return;

    const x = Math.min(points[0].x, points[1].x);
    const y = Math.min(points[0].y, points[1].y);
    const w = Math.abs(points[1].x - points[0].x);
    const h = Math.abs(points[1].y - points[0].y);

    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    if (outline) {
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
    } else {
        ctx.fillRect(x, y, w, h);
    }
}

/**
 * Draw a circle
 */
function drawCircle(ctx, points, color, outline) {
    if (points.length < 2) return;

    const cx = points[0].x;
    const cy = points[0].y;
    const dx = points[1].x - points[0].x;
    const dy = points[1].y - points[0].y;
    const radius = Math.sqrt(dx * dx + dy * dy);

    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);

    if (outline) {
        ctx.lineWidth = 1;
        ctx.stroke();
    } else {
        ctx.fill();
    }
}

/**
 * Draw an oval
 */
function drawOval(ctx, points, color, outline) {
    if (points.length < 2) return;

    const cx = (points[0].x + points[1].x) / 2;
    const cy = (points[0].y + points[1].y) / 2;
    const rx = Math.abs(points[1].x - points[0].x) / 2;
    const ry = Math.abs(points[1].y - points[0].y) / 2;

    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);

    if (outline) {
        ctx.lineWidth = 1;
        ctx.stroke();
    } else {
        ctx.fill();
    }
}

/**
 * Draw a polygon
 */
function drawPolygon(ctx, points, color, outline) {
    if (points.length < 2) return;

    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.closePath();

    if (outline) {
        ctx.lineWidth = 1;
        ctx.stroke();
    } else {
        ctx.fill();
    }
}
