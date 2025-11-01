/**
 * Export Module
 * Lazy-loaded module containing all export functions (PNG, JPG, GIF, Spritesheet)
 * Reduces initial bundle size by loading only when export is triggered
 */

/**
 * Export current frame as PNG
 */
export function exportPNG(editor, exportScale = 1, transparent = false) {
    // Calculate pixel-perfect size
    const actualWidth = editor.gridCells > 0 ? editor.gridCells : editor.canvasWidth;
    const actualHeight = editor.gridCells > 0 ? editor.gridCells : editor.canvasHeight;

    // Get the current canvas image data
    const srcCanvas = transparent ? createTransparentRender(editor) : editor.canvas;
    const srcData = srcCanvas.getContext('2d').getImageData(0, 0, srcCanvas.width, srcCanvas.height);

    // Downsample to pixel-perfect size
    const pixelCanvas = document.createElement('canvas');
    pixelCanvas.width = actualWidth;
    pixelCanvas.height = actualHeight;
    const pixelCtx = pixelCanvas.getContext('2d');
    const dstData = pixelCtx.createImageData(actualWidth, actualHeight);

    const scaleX = srcCanvas.width / actualWidth;
    const scaleY = srcCanvas.height / actualHeight;

    // Nearest-neighbor downsampling
    for (let dy = 0; dy < actualHeight; dy++) {
        for (let dx = 0; dx < actualWidth; dx++) {
            const sx = Math.floor((dx + 0.5) * scaleX);
            const sy = Math.floor((dy + 0.5) * scaleY);
            const srcIdx = (sy * srcCanvas.width + sx) * 4;
            const dstIdx = (dy * actualWidth + dx) * 4;

            dstData.data[dstIdx] = srcData.data[srcIdx];
            dstData.data[dstIdx + 1] = srcData.data[srcIdx + 1];
            dstData.data[dstIdx + 2] = srcData.data[srcIdx + 2];
            dstData.data[dstIdx + 3] = srcData.data[srcIdx + 3];
        }
    }

    pixelCtx.putImageData(dstData, 0, 0);

    // Scale up if needed for export scale
    let finalCanvas = pixelCanvas;
    if (exportScale > 1) {
        finalCanvas = document.createElement('canvas');
        finalCanvas.width = actualWidth * exportScale;
        finalCanvas.height = actualHeight * exportScale;
        const finalCtx = finalCanvas.getContext('2d');

        finalCtx.imageSmoothingEnabled = false;
        finalCtx.mozImageSmoothingEnabled = false;
        finalCtx.webkitImageSmoothingEnabled = false;
        finalCtx.msImageSmoothingEnabled = false;

        finalCtx.drawImage(pixelCanvas, 0, 0, actualWidth * exportScale, actualHeight * exportScale);
    }

    // Download the image
    finalCanvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'vector-art.png';
        a.click();
        URL.revokeObjectURL(url);
    }, 'image/png');
}

/**
 * Export current frame as JPG
 */
export function exportJPG(editor, exportScale = 1) {
    // Calculate pixel-perfect size
    const actualWidth = editor.gridCells > 0 ? editor.gridCells : editor.canvasWidth;
    const actualHeight = editor.gridCells > 0 ? editor.gridCells : editor.canvasHeight;

    // Get the current canvas image data
    const srcCanvas = editor.canvas;
    const srcData = srcCanvas.getContext('2d').getImageData(0, 0, srcCanvas.width, srcCanvas.height);

    // Downsample to pixel-perfect size
    const pixelCanvas = document.createElement('canvas');
    pixelCanvas.width = actualWidth;
    pixelCanvas.height = actualHeight;
    const pixelCtx = pixelCanvas.getContext('2d');
    const dstData = pixelCtx.createImageData(actualWidth, actualHeight);

    const scaleX = srcCanvas.width / actualWidth;
    const scaleY = srcCanvas.height / actualHeight;

    // Nearest-neighbor downsampling
    for (let dy = 0; dy < actualHeight; dy++) {
        for (let dx = 0; dx < actualWidth; dx++) {
            const sx = Math.floor((dx + 0.5) * scaleX);
            const sy = Math.floor((dy + 0.5) * scaleY);
            const srcIdx = (sy * srcCanvas.width + sx) * 4;
            const dstIdx = (dy * actualWidth + dx) * 4;

            dstData.data[dstIdx] = srcData.data[srcIdx];
            dstData.data[dstIdx + 1] = srcData.data[srcIdx + 1];
            dstData.data[dstIdx + 2] = srcData.data[srcIdx + 2];
            dstData.data[dstIdx + 3] = srcData.data[srcIdx + 3];
        }
    }

    pixelCtx.putImageData(dstData, 0, 0);

    // Scale up if needed for export scale
    let finalCanvas = pixelCanvas;
    if (exportScale > 1) {
        finalCanvas = document.createElement('canvas');
        finalCanvas.width = actualWidth * exportScale;
        finalCanvas.height = actualHeight * exportScale;
        const finalCtx = finalCanvas.getContext('2d');

        finalCtx.imageSmoothingEnabled = false;
        finalCtx.mozImageSmoothingEnabled = false;
        finalCtx.webkitImageSmoothingEnabled = false;
        finalCtx.msImageSmoothingEnabled = false;

        finalCtx.drawImage(pixelCanvas, 0, 0, actualWidth * exportScale, actualHeight * exportScale);
    }

    // Download the image
    finalCanvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'vector-art.jpg';
        a.click();
        URL.revokeObjectURL(url);
    }, 'image/jpeg', 0.95);
}

/**
 * Export animation as GIF
 */
export function exportGIF(editor, exportScale = 1, transparent = false) {
    if (editor.frames.length === 0) {
        alert('No frames to export!');
        return;
    }

    if (typeof GIF === 'undefined') {
        alert('GIF library not loaded! Please refresh the page.');
        console.error('GIF library (gif.js) is not loaded');
        return;
    }

    console.log('Starting GIF export...');
    console.log(`Frames: ${editor.frames.length}, FPS: ${editor.fps}, Scale: ${exportScale}, Transparent: ${transparent}`);

    // Calculate pixel-perfect size
    const actualWidth = editor.gridCells > 0 ? editor.gridCells : editor.canvasWidth;
    const actualHeight = editor.gridCells > 0 ? editor.gridCells : editor.canvasHeight;
    const finalWidth = actualWidth * exportScale;
    const finalHeight = actualHeight * exportScale;

    console.log(`GIF dimensions: ${finalWidth}x${finalHeight}`);

    // Create GIF encoder
    const gifConfig = {
        quality: 10,
        width: finalWidth,
        height: finalHeight,
        workers: 2,
        workerScript: './gif.worker.js'
    };

    if (transparent) {
        gifConfig.transparent = 0x000000;
    }

    console.log('Using web workers for GIF encoding');

    try {
        const gif = new GIF(gifConfig);

        gif.on('error', (error) => {
            console.error('GIF encoding error:', error);
            alert('Error encoding GIF: ' + error.message);
        });

        // Save original state
        const savedShapes = editor.shapes;
        const savedCtx = editor.ctx;
        const savedCanvas = editor.canvas;
        const savedScale = editor.scale;

        // Calculate delay per frame
        const baseDelay = Math.round(1000 / editor.fps);
        console.log(`Base delay per frame: ${baseDelay}ms`);

        // Add each frame to the GIF
        editor.frames.forEach((frame, index) => {
            console.log(`Processing frame ${index + 1}/${editor.frames.length}...`);

            const frameCanvas = document.createElement('canvas');
            frameCanvas.width = editor.canvas.width;
            frameCanvas.height = editor.canvas.height;
            const frameCtx = frameCanvas.getContext('2d', { willReadFrequently: true });

            if (transparent) {
                frameCtx.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
                frameCtx.fillStyle = '#000000';
                frameCtx.fillRect(0, 0, frameCanvas.width, frameCanvas.height);
            } else {
                frameCtx.fillStyle = editor.backgroundColor;
                frameCtx.fillRect(0, 0, frameCanvas.width, frameCanvas.height);
            }

            editor.ctx = frameCtx;
            editor.canvas = frameCanvas;
            editor.shapes = frame.shapes;

            // Draw shapes (skip hidden)
            frame.shapes.forEach(shape => {
                if (!shape.hidden) {
                    editor.drawShape(shape, false);
                }
            });

            // Downsample frame
            const srcData = frameCtx.getImageData(0, 0, frameCanvas.width, frameCanvas.height);
            const framePixelCanvas = document.createElement('canvas');
            framePixelCanvas.width = actualWidth;
            framePixelCanvas.height = actualHeight;
            const framePixelCtx = framePixelCanvas.getContext('2d');
            const dstData = framePixelCtx.createImageData(actualWidth, actualHeight);

            const scaleX = frameCanvas.width / actualWidth;
            const scaleY = frameCanvas.height / actualHeight;

            for (let dy = 0; dy < actualHeight; dy++) {
                for (let dx = 0; dx < actualWidth; dx++) {
                    const sx = Math.floor((dx + 0.5) * scaleX);
                    const sy = Math.floor((dy + 0.5) * scaleY);
                    const srcIdx = (sy * frameCanvas.width + sx) * 4;
                    const dstIdx = (dy * actualWidth + dx) * 4;

                    dstData.data[dstIdx] = srcData.data[srcIdx];
                    dstData.data[dstIdx + 1] = srcData.data[srcIdx + 1];
                    dstData.data[dstIdx + 2] = srcData.data[srcIdx + 2];
                    dstData.data[dstIdx + 3] = srcData.data[srcIdx + 3];
                }
            }

            framePixelCtx.putImageData(dstData, 0, 0);

            // Scale up if needed
            let finalFrameCanvas = framePixelCanvas;
            if (exportScale > 1) {
                finalFrameCanvas = document.createElement('canvas');
                finalFrameCanvas.width = finalWidth;
                finalFrameCanvas.height = finalHeight;
                const finalFrameCtx = finalFrameCanvas.getContext('2d');

                finalFrameCtx.imageSmoothingEnabled = false;
                finalFrameCtx.mozImageSmoothingEnabled = false;
                finalFrameCtx.webkitImageSmoothingEnabled = false;
                finalFrameCtx.msImageSmoothingEnabled = false;

                finalFrameCtx.drawImage(framePixelCanvas, 0, 0, finalWidth, finalHeight);
            }

            // Frame delay with hold multiplier
            const frameDelay = baseDelay * (frame.hold || 1);
            gif.addFrame(finalFrameCanvas, { delay: frameDelay });
            console.log(`Frame ${index + 1} added with ${frameDelay}ms delay (hold: ${frame.hold || 1})`);
        });

        // Restore state
        editor.shapes = savedShapes;
        editor.ctx = savedCtx;
        editor.canvas = savedCanvas;
        editor.scale = savedScale;

        // Render and download
        gif.on('finished', (blob) => {
            console.log('GIF encoding complete!');
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'animation.gif';
            a.click();
            URL.revokeObjectURL(url);
            console.log('GIF downloaded successfully');
        });

        console.log('Starting GIF rendering...');
        gif.render();

    } catch (error) {
        console.error('GIF export failed:', error);
        alert('Failed to export GIF: ' + error.message);
    }
}

/**
 * Export animation as spritesheet
 */
export function exportSpritesheet(editor, exportScale = 1, transparent = false, cols = null, rows = null) {
    if (editor.frames.length === 0) {
        alert('No frames to export!');
        return;
    }

    // Calculate pixel-perfect size
    const actualWidth = editor.gridCells > 0 ? editor.gridCells : editor.canvasWidth;
    const actualHeight = editor.gridCells > 0 ? editor.gridCells : editor.canvasHeight;

    // Auto-calculate grid dimensions if not provided
    if (!cols || !rows) {
        const frameCount = editor.frames.length;
        cols = Math.ceil(Math.sqrt(frameCount));
        rows = Math.ceil(frameCount / cols);
    }

    const frameWidth = actualWidth * exportScale;
    const frameHeight = actualHeight * exportScale;
    const sheetWidth = frameWidth * cols;
    const sheetHeight = frameHeight * rows;

    // Create spritesheet canvas
    const sheetCanvas = document.createElement('canvas');
    sheetCanvas.width = sheetWidth;
    sheetCanvas.height = sheetHeight;
    const sheetCtx = sheetCanvas.getContext('2d');
    sheetCtx.imageSmoothingEnabled = false;

    // Clear to transparent if requested
    if (transparent) {
        sheetCtx.clearRect(0, 0, sheetWidth, sheetHeight);
    }

    // Save original state
    const savedShapes = editor.shapes;
    const savedCtx = editor.ctx;
    const savedCanvas = editor.canvas;

    // Render each frame
    editor.frames.forEach((frame, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = col * frameWidth;
        const y = row * frameHeight;

        // Create frame canvas
        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = editor.canvas.width;
        frameCanvas.height = editor.canvas.height;
        const frameCtx = frameCanvas.getContext('2d', { willReadFrequently: true });

        if (transparent) {
            frameCtx.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
        } else {
            frameCtx.fillStyle = editor.backgroundColor;
            frameCtx.fillRect(0, 0, frameCanvas.width, frameCanvas.height);
        }

        editor.ctx = frameCtx;
        editor.canvas = frameCanvas;
        editor.shapes = frame.shapes;

        // Draw shapes (skip hidden)
        frame.shapes.forEach(shape => {
            if (!shape.hidden) {
                editor.drawShape(shape, false);
            }
        });

        // Downsample frame
        const srcData = frameCtx.getImageData(0, 0, frameCanvas.width, frameCanvas.height);
        const pixelCanvas = document.createElement('canvas');
        pixelCanvas.width = actualWidth;
        pixelCanvas.height = actualHeight;
        const pixelCtx = pixelCanvas.getContext('2d');
        const dstData = pixelCtx.createImageData(actualWidth, actualHeight);

        const scaleX = frameCanvas.width / actualWidth;
        const scaleY = frameCanvas.height / actualHeight;

        for (let dy = 0; dy < actualHeight; dy++) {
            for (let dx = 0; dx < actualWidth; dx++) {
                const sx = Math.floor((dx + 0.5) * scaleX);
                const sy = Math.floor((dy + 0.5) * scaleY);
                const srcIdx = (sy * frameCanvas.width + sx) * 4;
                const dstIdx = (dy * actualWidth + dx) * 4;

                dstData.data[dstIdx] = srcData.data[srcIdx];
                dstData.data[dstIdx + 1] = srcData.data[srcIdx + 1];
                dstData.data[dstIdx + 2] = srcData.data[srcIdx + 2];
                dstData.data[dstIdx + 3] = srcData.data[srcIdx + 3];
            }
        }

        pixelCtx.putImageData(dstData, 0, 0);

        // Draw to spritesheet
        sheetCtx.drawImage(pixelCanvas, x, y, frameWidth, frameHeight);
    });

    // Restore state
    editor.shapes = savedShapes;
    editor.ctx = savedCtx;
    editor.canvas = savedCanvas;

    // Download
    sheetCanvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `spritesheet-${cols}x${rows}.png`;
        a.click();
        URL.revokeObjectURL(url);
    }, transparent ? 'image/png' : 'image/png');
}

/**
 * Create a transparent render of the current canvas
 */
function createTransparentRender(editor) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = editor.canvas.width;
    tempCanvas.height = editor.canvas.height;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

    const savedCtx = editor.ctx;
    const savedCanvas = editor.canvas;
    const savedBg = editor.backgroundColor;

    editor.ctx = tempCtx;
    editor.canvas = tempCanvas;
    editor.backgroundColor = 'rgba(0,0,0,0)';

    editor.render();

    editor.ctx = savedCtx;
    editor.canvas = savedCanvas;
    editor.backgroundColor = savedBg;

    return tempCanvas;
}
