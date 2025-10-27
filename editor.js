// Vector Pixel Art Editor - HTML5 Version
// Based on TIC-80 vector editor by rigachupe

class VectorEditor {
    constructor() {
        // Canvas setup
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.scale = 2; // 2x scale for 240x136 logical resolution
        this.defaultScale = 2;

        // Disable antialiasing for pixel-perfect rendering
        this.ctx.imageSmoothingEnabled = false;

        // Color palettes
        this.palettes = {
            '16bit': [
                '#000000', '#ffffff', '#808080', '#c0c0c0',
                '#ff0000', '#00ff00', '#0000ff', '#ffff00',
                '#ff00ff', '#00ffff', '#800000', '#008000',
                '#000080', '#808000', '#800080', '#008080'
            ],
            'tic80': [
                '#1a1c2c', '#5d275d', '#b13e53', '#ef7d57',
                '#ffcd75', '#a7f070', '#38b764', '#257179',
                '#29366f', '#3b5dc9', '#41a6f6', '#73eff7',
                '#f4f4f4', '#94b0c2', '#566c86', '#333c57'
            ],
            'pico8': [
                '#000000', '#1D2B53', '#7E2553', '#008751',
                '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8',
                '#FF004D', '#FFA300', '#FFEC27', '#00E436',
                '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA'
            ],
            'gameboy': [
                '#0f380f', '#306230', '#8bac0f', '#9bbc0f'
            ],
            '1bit': [
                '#000000', '#ffffff'
            ]
        };

        this.currentPalette = '16bit';
        this.colors = [...this.palettes['16bit']];
        this.paletteNames = {}; // Store custom palette names

        // State
        this.currentColor = 0;
        this.currentTool = 'line';
        this.lineWidth = 1; // Current line width in pixels
        this.shapes = [];
        this.currentPoints = [];
        this.selectedShape = null;
        this.selectedShapes = []; // Multiple selected shapes
        this.selectedPoint = null;
        this.selectedPoints = []; // Multiple selected points/nodes
        this.copiedShape = null;
        this.copiedShapes = []; // Multiple copied shapes
        this.isDragging = false;
        this.dragMode = null; // 'point', 'shape', or 'selection-box'
        this.lockDirection = null; // 'horizontal', 'vertical', or null
        this.selectionBox = null; // {x1, y1, x2, y2} for drag selection
        this.draggedShapeIndex = null; // Track shape being dragged in order preview
        this.isEditingShapeName = false; // Track if currently editing a shape name

        // Cache for preview updates - avoid rebuilding on every render
        this.lastShapeCount = 0;
        this.lastHistoryIndex = -1;
        this.lastSelectedShapeCount = 0;

        // Undo/redo history
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 50;

        // Grid settings
        this.gridCells = 32; // 0 = off, 8 = 8x8 cells, 16 = 16x16 cells, etc.
        this.showGrid = false;
        this.showSelectionNodes = true; // Show selection nodes during normal editing

        // Canvas settings
        this.aspectRatio = '1:1';  // Current aspect ratio
        this.orientation = 'landscape';  // 'landscape' or 'portrait'
        this.baseSize = 240;  // Base size for calculations
        this.canvasWidth = 240;  // Logical canvas width
        this.canvasHeight = 240; // Logical canvas height
        this.backgroundColor = '#e8e8e8'; // Canvas background color

        // Mouse state
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseDown = false;
        this.shapeWasModified = false; // Track if shapes were actually moved/changed

        // Preview settings
        this.previewMode = 'actual'; // 'actual' or 'repeat'
        this.previewCanvas = null;
        this.previewCtx = null;

        // Dither settings
        this.ditherImage = null;
        this.ditherPatterns = [];
        this.selectedDitherPattern = 0;
        this.ditherPatternSize = 8; // Each pattern is 8x8 pixels in the atlas
        this.ditherScale = 1; // Scale multiplier for dither patterns

        this.init();
    }

    init() {
        this.setupColorPalette();
        this.setupEventListeners();
        this.updateCanvasDimensions();
        this.setupPreview();
        this.setupDither();
        this.render();
    }

    setupPreview() {
        this.previewCanvas = document.getElementById('previewCanvas');
        if (this.previewCanvas) {
            this.previewCtx = this.previewCanvas.getContext('2d');
            this.updatePreview();
        }
    }

    setupDither() {
        // Create dither patterns programmatically to avoid CORS issues
        this.createDitherPatterns();
        this.updateDitherPreview();

        // Setup event listeners for dither controls
        const ditherSelect = document.getElementById('dither-pattern-select');
        if (ditherSelect) {
            ditherSelect.addEventListener('change', (e) => {
                this.selectedDitherPattern = parseInt(e.target.value);
                this.updateDitherPreview();
            });
        }

        const ditherScaleSlider = document.getElementById('dither-scale');
        const ditherScaleValue = document.getElementById('dither-scale-value');
        if (ditherScaleSlider && ditherScaleValue) {
            ditherScaleSlider.addEventListener('input', (e) => {
                this.ditherScale = parseInt(e.target.value);
                ditherScaleValue.textContent = this.ditherScale;
                this.render(); // Re-render to show new scale
            });
        }

        document.getElementById('tool-apply-dither')?.addEventListener('click', () => {
            this.applyDitherToSelection();
        });

        document.getElementById('tool-clear-dither')?.addEventListener('click', () => {
            this.clearDitherFromSelection();
        });
    }

    createDitherPatterns() {
        // Create 19 common dither patterns as 8x8 ImageData
        const patterns = [
            // Pattern 0: Solid (100%)
            [1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1],
            // Pattern 1: Very light (87.5%)
            [1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1, 1,1,1,0,1,1,1,1, 1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,0],
            // Pattern 2: Light (75%)
            [1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1, 1,1,1,0,1,1,1,1, 1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1, 1,1,1,0,1,1,1,1, 1,1,1,1,1,1,1,1],
            // Pattern 3: Light checkerboard (62.5%)
            [1,1,1,0,1,1,1,1, 1,1,1,1,1,1,1,0, 1,1,1,1,1,1,1,1, 1,1,1,0,1,1,1,1, 1,1,1,1,1,1,1,0, 1,1,1,1,1,1,1,1, 1,1,1,0,1,1,1,1, 1,1,1,1,1,1,1,0],
            // Pattern 4: Diagonal lines (50%)
            [1,0,1,0,1,0,1,0, 0,1,0,1,0,1,0,1, 1,0,1,0,1,0,1,0, 0,1,0,1,0,1,0,1, 1,0,1,0,1,0,1,0, 0,1,0,1,0,1,0,1, 1,0,1,0,1,0,1,0, 0,1,0,1,0,1,0,1],
            // Pattern 5: Checkerboard (50%)
            [1,0,1,0,1,0,1,0, 0,1,0,1,0,1,0,1, 1,0,1,0,1,0,1,0, 0,1,0,1,0,1,0,1, 1,0,1,0,1,0,1,0, 0,1,0,1,0,1,0,1, 1,0,1,0,1,0,1,0, 0,1,0,1,0,1,0,1],
            // Pattern 6: Vertical lines (50%)
            [1,0,1,0,1,0,1,0, 1,0,1,0,1,0,1,0, 1,0,1,0,1,0,1,0, 1,0,1,0,1,0,1,0, 1,0,1,0,1,0,1,0, 1,0,1,0,1,0,1,0, 1,0,1,0,1,0,1,0, 1,0,1,0,1,0,1,0],
            // Pattern 7: Horizontal lines (50%)
            [1,1,1,1,1,1,1,1, 0,0,0,0,0,0,0,0, 1,1,1,1,1,1,1,1, 0,0,0,0,0,0,0,0, 1,1,1,1,1,1,1,1, 0,0,0,0,0,0,0,0, 1,1,1,1,1,1,1,1, 0,0,0,0,0,0,0,0],
            // Pattern 8: Diagonal (other way) (50%)
            [0,1,0,1,0,1,0,1, 1,0,1,0,1,0,1,0, 0,1,0,1,0,1,0,1, 1,0,1,0,1,0,1,0, 0,1,0,1,0,1,0,1, 1,0,1,0,1,0,1,0, 0,1,0,1,0,1,0,1, 1,0,1,0,1,0,1,0],
            // Pattern 9: Sparse diagonal (37.5%)
            [1,0,0,0,1,0,0,0, 0,0,1,0,0,0,1,0, 0,1,0,0,0,1,0,0, 0,0,0,1,0,0,0,1, 1,0,0,0,1,0,0,0, 0,0,1,0,0,0,1,0, 0,1,0,0,0,1,0,0, 0,0,0,1,0,0,0,1],
            // Pattern 10: Dark checkerboard (37.5%)
            [0,1,0,0,0,1,0,0, 1,0,0,0,1,0,0,0, 0,0,0,1,0,0,0,1, 0,0,1,0,0,0,1,0, 0,1,0,0,0,1,0,0, 1,0,0,0,1,0,0,0, 0,0,0,1,0,0,0,1, 0,0,1,0,0,0,1,0],
            // Pattern 11: Cross hatch (25%)
            [1,0,0,0,1,0,0,0, 0,0,0,0,0,0,0,0, 0,0,1,0,0,0,1,0, 0,0,0,0,0,0,0,0, 1,0,0,0,1,0,0,0, 0,0,0,0,0,0,0,0, 0,0,1,0,0,0,1,0, 0,0,0,0,0,0,0,0],
            // Pattern 12: Sparse (25%)
            [1,0,0,0,1,0,0,0, 0,0,0,0,0,0,0,0, 0,0,1,0,0,0,1,0, 0,0,0,0,0,0,0,0, 1,0,0,0,1,0,0,0, 0,0,0,0,0,0,0,0, 0,0,1,0,0,0,1,0, 0,0,0,0,0,0,0,0],
            // Pattern 13: Bayer 2x2 (25%)
            [1,0,0,0,1,0,0,0, 0,0,1,0,0,0,1,0, 0,1,0,0,0,1,0,0, 0,0,0,0,0,0,0,0, 1,0,0,0,1,0,0,0, 0,0,1,0,0,0,1,0, 0,1,0,0,0,1,0,0, 0,0,0,0,0,0,0,0],
            // Pattern 14: Very sparse (12.5%)
            [1,0,0,0,0,0,0,0, 0,0,0,0,1,0,0,0, 0,0,1,0,0,0,0,0, 0,0,0,0,0,0,1,0, 0,0,0,0,1,0,0,0, 0,0,0,0,0,0,0,0, 0,1,0,0,0,0,0,0, 0,0,0,0,0,1,0,0],
            // Pattern 15: Dots (12.5%)
            [0,0,0,0,1,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 1,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,1],
            // Pattern 16: Very very sparse (6.25%)
            [1,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,1,0,0,0],
            // Pattern 17: Almost empty (3.125%)
            [1,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0],
            // Pattern 18: Empty (0%)
            [0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0],
        ];

        this.ditherPatterns = [];
        patterns.forEach(pattern => {
            const imageData = new ImageData(8, 8);
            for (let i = 0; i < 64; i++) {
                const value = pattern[i] ? 255 : 0;
                imageData.data[i * 4] = value;
                imageData.data[i * 4 + 1] = value;
                imageData.data[i * 4 + 2] = value;
                imageData.data[i * 4 + 3] = 255;
            }
            this.ditherPatterns.push(imageData);
        });

        console.log('Created', this.ditherPatterns.length, 'dither patterns');
    }

    updateDitherPreview() {
        const preview = document.getElementById('ditherPatternPreview');
        if (!preview || !this.ditherPatterns || this.ditherPatterns.length === 0) return;

        const ctx = preview.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        // Draw the selected pattern tiled to fill the preview
        const patternSize = 8;
        ctx.clearRect(0, 0, preview.width, preview.height);

        const pattern = this.ditherPatterns[this.selectedDitherPattern];
        if (!pattern) return;

        // Draw selected pattern repeated (8x8 tiled)
        for (let ty = 0; ty < 8; ty++) {
            for (let tx = 0; tx < 8; tx++) {
                ctx.putImageData(pattern, tx * 8, ty * 8);
            }
        }
    }

    applyDitherToSelection() {
        if (this.selectedShapes.length === 0) {
            alert('Select at least one shape to apply dither');
            return;
        }

        console.log('Applying dither pattern', this.selectedDitherPattern, 'to', this.selectedShapes.length, 'shapes');

        this.selectedShapes.forEach(shape => {
            shape.ditherPattern = this.selectedDitherPattern;
            console.log('Applied dither to shape:', shape.type, 'ditherPattern:', shape.ditherPattern);
        });

        this.saveHistory();
        this.updateShapeOrderPreview();
        this.render();
    }

    clearDitherFromSelection() {
        if (this.selectedShapes.length === 0) {
            alert('Select at least one shape to clear dither');
            return;
        }

        this.selectedShapes.forEach(shape => {
            delete shape.ditherPattern;
        });

        this.saveHistory();
        this.render();
    }

    applyDitherPattern(x, y, color, ditherPatternIndex) {
        if (ditherPatternIndex === undefined || ditherPatternIndex === null || !this.ditherPatterns[ditherPatternIndex]) {
            // No dither pattern, draw solid color
            this.ctx.fillStyle = color;
            this.ctx.fillRect(x * this.scale, y * this.scale, this.scale, this.scale);
            return;
        }

        const pattern = this.ditherPatterns[ditherPatternIndex];
        if (!pattern) {
            console.warn('Dither pattern', ditherPatternIndex, 'not found');
            this.ctx.fillStyle = color;
            this.ctx.fillRect(x * this.scale, y * this.scale, this.scale, this.scale);
            return;
        }

        const patternSize = 8;
        const scaledPatternSize = patternSize * this.ditherScale;

        // Get the pattern pixel at this position, accounting for scale
        const px = Math.floor(Math.floor(x) / this.ditherScale) % patternSize;
        const py = Math.floor(Math.floor(y) / this.ditherScale) % patternSize;
        const patternIndex = (py * patternSize + px) * 4;

        // Check if this pixel in the pattern is "on" (white/light)
        const r = pattern.data[patternIndex];
        const isOn = r > 128;

        if (isOn) {
            this.ctx.fillStyle = color;
            this.ctx.fillRect(x * this.scale, y * this.scale, this.scale, this.scale);
        }
        // If off, don't draw (leave transparent or background)
    }

    updatePreview() {
        if (!this.previewCanvas || !this.previewCtx) return;

        const previewSizeLabel = document.getElementById('preview-size');

        // Determine the actual pixel resolution based on grid
        const actualWidth = this.gridCells > 0 ? this.gridCells : this.canvasWidth;
        const actualHeight = this.gridCells > 0 ? this.gridCells : this.canvasHeight;

        if (this.previewMode === 'actual') {
            // Show at actual pixel size (e.g., 32×32 for a 32×32 grid)
            this.previewCanvas.width = actualWidth;
            this.previewCanvas.height = actualHeight;

            // Update size label
            if (previewSizeLabel) {
                previewSizeLabel.textContent = `(${actualWidth}×${actualHeight}px)`;
            }

            // Draw background
            this.previewCtx.fillStyle = this.backgroundColor;
            this.previewCtx.fillRect(0, 0, actualWidth, actualHeight);

            // Scale down from canvas coordinates to pixel coordinates
            const scaleX = actualWidth / this.canvasWidth;
            const scaleY = actualHeight / this.canvasHeight;

            this.previewCtx.save();
            this.previewCtx.scale(scaleX, scaleY);

            // Draw all shapes scaled down to pixel size
            this.shapes.forEach(shape => {
                this.drawShape(shape, this.previewCtx, 1);
            });

            this.previewCtx.restore();
        } else if (this.previewMode === 'repeat') {
            // Show repeating pattern (3x3 grid)
            const repeatWidth = actualWidth * 3;
            const repeatHeight = actualHeight * 3;
            this.previewCanvas.width = repeatWidth;
            this.previewCanvas.height = repeatHeight;

            // Update size label
            if (previewSizeLabel) {
                previewSizeLabel.textContent = `(${repeatWidth}×${repeatHeight}px)`;
            }

            // Scale factor to convert canvas coordinates to pixel coordinates
            const scaleX = actualWidth / this.canvasWidth;
            const scaleY = actualHeight / this.canvasHeight;

            // Draw 3x3 grid of the canvas
            for (let y = 0; y < 3; y++) {
                for (let x = 0; x < 3; x++) {
                    const offsetX = x * actualWidth;
                    const offsetY = y * actualHeight;

                    // Draw background
                    this.previewCtx.fillStyle = this.backgroundColor;
                    this.previewCtx.fillRect(offsetX, offsetY, actualWidth, actualHeight);

                    // Draw all shapes with offset and scaling
                    this.previewCtx.save();
                    this.previewCtx.translate(offsetX, offsetY);
                    this.previewCtx.scale(scaleX, scaleY);
                    this.shapes.forEach(shape => {
                        this.drawShape(shape, this.previewCtx, 1);
                    });
                    this.previewCtx.restore();
                }
            }
        }
    }

    setupColorPalette() {
        const palette = document.getElementById('colorPalette');
        palette.innerHTML = ''; // Clear existing palette

        // Always use 5 columns max
        const columns = Math.min(this.colors.length, 5);
        palette.style.gridTemplateColumns = `repeat(${columns}, 30px)`;

        this.colors.forEach((color, index) => {
            const btn = document.createElement('div');
            btn.className = 'color-btn';
            btn.style.backgroundColor = color;
            if (index === this.currentColor) btn.classList.add('selected');
            btn.addEventListener('click', () => this.selectColor(index));
            palette.appendChild(btn);
        });
    }

    setPalette(paletteId) {
        if (this.palettes[paletteId]) {
            this.currentPalette = paletteId;
            this.colors = [...this.palettes[paletteId]];

            // Reset color selection if out of bounds
            if (this.currentColor >= this.colors.length) {
                this.currentColor = 0;
            }

            this.setupColorPalette();
            this.render();
        }
    }

    async importLospecPalette() {
        const url = prompt('Enter Lospec palette URL or slug (e.g., "sweetie-16" or full URL):');
        if (!url) return;

        try {
            // Extract slug from URL if full URL provided
            let slug = url;
            if (url.includes('lospec.com')) {
                const match = url.match(/\/palette-list\/([^\/]+)/);
                if (match) slug = match[1];
            }

            // Fetch palette from Lospec API
            const response = await fetch(`https://lospec.com/palette-list/${slug}.json`);
            if (!response.ok) throw new Error('Palette not found');

            const data = await response.json();
            const colors = data.colors.map(c => '#' + c);

            // Add to palettes
            const paletteName = `lospec_${slug}`;
            this.palettes[paletteName] = colors;
            this.paletteNames[paletteName] = data.name;
            this.currentPalette = paletteName;
            this.colors = [...colors];

            // Add option to dropdown if it doesn't exist
            const select = document.getElementById('palette-select');
            let option = select.querySelector(`option[value="${paletteName}"]`);
            if (!option) {
                option = document.createElement('option');
                option.value = paletteName;
                option.textContent = data.name;
                // Insert before "Import from Lospec..." option
                const lospecOption = select.querySelector('option[value="lospec"]');
                select.insertBefore(option, lospecOption);
            }
            select.value = paletteName;

            // Reset color selection if needed
            if (this.currentColor >= this.colors.length) {
                this.currentColor = 0;
            }

            this.setupColorPalette();
            this.render();

            alert(`Successfully imported "${data.name}" palette with ${colors.length} colors!`);
        } catch (error) {
            alert('Failed to import palette. Please check the URL/slug and try again.\n\nExample slugs: sweetie-16, apollo, aap-64');
        }
    }

    setupEventListeners() {
        // Canvas events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Tool buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = e.target.id.replace('tool-', '');
                this.selectTool(tool);
            });
        });

        // Action buttons (these are now in dropdown menus, handled in DOMContentLoaded)
        const toolCopy = document.getElementById('tool-copy');
        if (toolCopy) toolCopy.addEventListener('click', () => this.copyShape());

        const toolPaste = document.getElementById('tool-paste');
        if (toolPaste) toolPaste.addEventListener('click', () => this.pasteShape());

        const toolDelete = document.getElementById('tool-delete');
        if (toolDelete) toolDelete.addEventListener('click', () => this.deleteShape());

        const toolUndo = document.getElementById('tool-undo');
        if (toolUndo) toolUndo.addEventListener('click', () => this.undo());

        const toolClear = document.getElementById('tool-clear');
        if (toolClear) toolClear.addEventListener('click', () => this.clear());

        const toolSave = document.getElementById('tool-save');
        if (toolSave) toolSave.addEventListener('click', () => this.save());

        const toolLoad = document.getElementById('tool-load');
        if (toolLoad) toolLoad.addEventListener('click', () => this.load());

        // Shape ordering buttons
        document.getElementById('tool-bring-front').addEventListener('click', () => this.bringToFront());
        document.getElementById('tool-send-back').addEventListener('click', () => this.sendToBack());
        document.getElementById('tool-bring-forward').addEventListener('click', () => this.bringForward());
        document.getElementById('tool-send-backward').addEventListener('click', () => this.sendBackward());

        // Boolean operation buttons
        document.getElementById('tool-union').addEventListener('click', () => this.booleanUnion());
        document.getElementById('tool-subtract').addEventListener('click', () => this.booleanSubtract());
        document.getElementById('tool-intersect').addEventListener('click', () => this.booleanIntersect());

        // Convert to polygon button
        document.getElementById('tool-to-polygon').addEventListener('click', () => this.convertToPolygon());

        // Union nodes button
        document.getElementById('tool-union-nodes').addEventListener('click', () => this.unionNodes());

        // Grid dropdown (if exists)
        const gridSize = document.getElementById('grid-size');
        if (gridSize) {
            gridSize.addEventListener('change', (e) => {
                this.gridCells = parseInt(e.target.value);
                this.render();
            });
        }

        const toggleGrid = document.getElementById('toggle-grid');
        if (toggleGrid) {
            toggleGrid.addEventListener('click', () => {
                this.showGrid = !this.showGrid;
                toggleGrid.textContent = this.showGrid ? 'Hide Grid' : 'Show Grid';
                this.render();
            });
        }

        const toggleOutline = document.getElementById('toggle-outline');
        if (toggleOutline) {
            toggleOutline.addEventListener('click', () => {
                // Toggle outline for all selected shapes
                if (this.selectedShapes.length > 0) {
                    // Determine new outline state (toggle first shape's state)
                    const newOutlineState = !this.selectedShapes[0].outline;
                    this.selectedShapes.forEach(shape => {
                        shape.outline = newOutlineState;
                    });
                    this.render();
                } else if (this.selectedShape) {
                    this.selectedShape.outline = !this.selectedShape.outline;
                    this.render();
                }
            });
        }

        // Palette selector
        const paletteSelect = document.getElementById('palette-select');
        if (paletteSelect) {
            paletteSelect.addEventListener('change', (e) => {
                const paletteId = e.target.value;
                if (paletteId === 'lospec') {
                    this.importLospecPalette();
                    // Reset dropdown to current palette
                    e.target.value = this.currentPalette;
                } else {
                    this.setPalette(paletteId);
                }
            });
        }

        // Background color picker (if exists)
        const bgColor = document.getElementById('bg-color');
        if (bgColor) {
            bgColor.addEventListener('input', (e) => {
                this.backgroundColor = e.target.value;
                this.render();
            });
        }

        // Aspect ratio dropdown (if exists)
        const aspectRatio = document.getElementById('aspect-ratio');
        if (aspectRatio) {
            aspectRatio.addEventListener('change', (e) => {
                this.aspectRatio = e.target.value;
                this.updateCanvasDimensions();
            });
        }

        // Orientation buttons (if exist)
        document.querySelectorAll('.orientation-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const orientationId = e.target.id;
                if (orientationId === 'orientation-landscape') {
                    this.orientation = 'landscape';
                } else if (orientationId === 'orientation-portrait') {
                    this.orientation = 'portrait';
                }

                document.querySelectorAll('.orientation-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.updateCanvasDimensions();
            });
        });

        // Zoom controls (if exist)
        const zoomIn = document.getElementById('zoom-in');
        if (zoomIn) zoomIn.addEventListener('click', () => this.zoomIn());

        const zoomOut = document.getElementById('zoom-out');
        if (zoomOut) zoomOut.addEventListener('click', () => this.zoomOut());

        const zoomReset = document.getElementById('zoom-reset');
        if (zoomReset) zoomReset.addEventListener('click', () => this.zoomReset());

        // New zoom controls
        const zoomPercentage = document.getElementById('zoom-percentage');
        if (zoomPercentage) {
            zoomPercentage.addEventListener('change', (e) => {
                const percentage = parseInt(e.target.value);
                this.setZoomPercentage(percentage);
            });
        }

        const zoomSlider = document.getElementById('zoom-slider');
        if (zoomSlider) {
            zoomSlider.addEventListener('input', (e) => {
                this.scale = parseInt(e.target.value);
                this.updateCanvasScale();
            });
        }

        // Zoom presets
        const zoomPreset50 = document.getElementById('zoom-preset-50');
        if (zoomPreset50) zoomPreset50.addEventListener('click', () => this.setZoomPercentage(50));

        const zoomPreset100 = document.getElementById('zoom-preset-100');
        if (zoomPreset100) zoomPreset100.addEventListener('click', () => this.setZoomPercentage(100));

        const zoomPreset200 = document.getElementById('zoom-preset-200');
        if (zoomPreset200) zoomPreset200.addEventListener('click', () => this.setZoomPercentage(200));

        const zoomPreset400 = document.getElementById('zoom-preset-400');
        if (zoomPreset400) zoomPreset400.addEventListener('click', () => this.setZoomPercentage(400));

        // Scroll wheel zoom
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.deltaY < 0) {
                this.zoomIn();
            } else {
                this.zoomOut();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    zoomIn() {
        this.scale = Math.min(this.scale + 1, 10);
        this.updateCanvasScale();
    }

    zoomOut() {
        this.scale = Math.max(this.scale - 1, 1);
        this.updateCanvasScale();
    }

    zoomReset() {
        this.scale = this.defaultScale;
        this.updateCanvasScale();
    }

    setZoomPercentage(percentage) {
        // Convert percentage to scale (percentage / 50 = scale)
        this.scale = Math.max(1, Math.min(10, percentage / 50));
        this.updateCanvasScale();
    }

    updateCanvasScale() {
        this.canvas.width = this.canvasWidth * this.scale;
        this.canvas.height = this.canvasHeight * this.scale;
        const percentage = Math.round(this.scale * 50);

        // Update old zoom level display
        const zoomLevel = document.getElementById('zoom-level');
        if (zoomLevel) {
            zoomLevel.textContent = `${percentage}%`;
        }

        // Update new zoom controls
        const zoomPercentage = document.getElementById('zoom-percentage');
        if (zoomPercentage) {
            zoomPercentage.value = percentage;
        }

        const zoomSlider = document.getElementById('zoom-slider');
        if (zoomSlider) {
            zoomSlider.value = this.scale;
        }

        this.render();
    }

    updateCanvasDimensions() {
        // Parse aspect ratio
        const [widthRatio, heightRatio] = this.aspectRatio.split(':').map(n => parseInt(n));

        // Calculate dimensions based on orientation
        let width, height;
        if (this.orientation === 'landscape') {
            width = this.baseSize;
            height = Math.round(this.baseSize * heightRatio / widthRatio);
        } else {
            // Portrait - swap the ratios
            height = this.baseSize;
            width = Math.round(this.baseSize * heightRatio / widthRatio);
        }

        this.canvasWidth = width;
        this.canvasHeight = height;
        this.canvas.width = width * this.scale;
        this.canvas.height = height * this.scale;
        this.render();
    }

    selectColor(index) {
        this.currentColor = index;
        document.querySelectorAll('.color-btn').forEach((btn, i) => {
            btn.classList.toggle('selected', i === index);
        });

        // If shapes are selected, change their color
        if (this.selectedShapes.length > 0) {
            this.selectedShapes.forEach(shape => {
                shape.color = index;
            });
            this.render();
            this.updateShapeOrderPreview();
        } else if (this.selectedShape) {
            this.selectedShape.color = index;
            this.render();
            this.updateShapeOrderPreview();
        }
    }

    selectTool(tool) {
        this.currentTool = tool;
        this.currentPoints = [];
        this.selectedShape = null;
        this.selectedShapes = [];
        this.selectedPoint = null;
        this.isDragging = false;
        this.dragMode = null;
        this.selectionBox = null;

        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeBtn = document.getElementById(`tool-${tool}`);
        if (activeBtn) activeBtn.classList.add('active');

        this.updateToolInfo();
        this.render();
    }

    updateToolInfo() {
        const toolNames = {
            'line': 'Line',
            'rect': 'Rectangle',
            'circle': 'Circle',
            'oval': 'Oval',
            'triangle': 'Triangle',
            'polygon': 'Polygon',
            'fill': 'Fill Cell',
            'select': 'Select'
        };
        const info = document.getElementById('toolInfo');
        info.textContent = `Tool: ${toolNames[this.currentTool] || this.currentTool} | ${this.getToolHint()}`;
    }

    getToolHint() {
        switch (this.currentTool) {
            case 'line': return 'Click two points';
            case 'rect': return 'Click two corners';
            case 'circle': return 'Click center, then radius point';
            case 'oval': return 'Click two corners to define bounds';
            case 'triangle': return 'Click three points';
            case 'polygon': return 'Click points, right-click to finish';
            case 'fill': return 'Click to fill a single cell';
            case 'select': return 'Click and drag shapes or nodes';
            default: return 'Click to place points';
        }
    }

    getCellSize() {
        if (this.gridCells === 0) return 0;
        // Calculate cell size based on the smaller canvas dimension to fit aspect ratio
        const minDimension = Math.min(this.canvasWidth, this.canvasHeight);
        const cellSize = Math.floor(minDimension / this.gridCells);
        // Ensure cell size is at least 1 pixel
        return Math.max(1, cellSize);
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        let x = Math.floor((e.clientX - rect.left) / this.scale);
        let y = Math.floor((e.clientY - rect.top) / this.scale);

        // Apply grid snapping to cell centers
        const cellSize = this.getCellSize();
        if (cellSize > 0) {
            // Snap to the center of the grid cell
            const cellX = Math.floor(x / cellSize);
            const cellY = Math.floor(y / cellSize);
            x = cellX * cellSize + Math.floor(cellSize / 2);
            y = cellY * cellSize + Math.floor(cellSize / 2);
        }

        return { x, y };
    }

    handleMouseDown(e) {
        const pos = this.getMousePos(e);
        this.mouseX = pos.x;
        this.mouseY = pos.y;
        this.mouseDown = true;
        this.lastMouseX = pos.x;
        this.lastMouseY = pos.y;

        if (e.button === 0) { // Left click
            this.handleLeftClick(pos, e.shiftKey);
        } else if (e.button === 2) { // Right click
            this.handleRightClick(pos);
        }
    }

    handleMouseMove(e) {
        const pos = this.getMousePos(e);

        // Apply direction lock
        if (this.lockDirection === 'horizontal' && this.currentPoints.length > 0) {
            pos.y = this.currentPoints[this.currentPoints.length - 1].y;
        } else if (this.lockDirection === 'vertical' && this.currentPoints.length > 0) {
            pos.x = this.currentPoints[this.currentPoints.length - 1].x;
        }

        // Check if position actually changed (important for grid mode)
        const posChanged = (this.mouseX !== pos.x || this.mouseY !== pos.y);

        this.mouseX = pos.x;
        this.mouseY = pos.y;

        if (this.isDragging && this.mouseDown) {
            if (this.dragMode === 'point' && this.selectedPoint) {
                this.selectedPoint.x = pos.x;
                this.selectedPoint.y = pos.y;
                this.shapeWasModified = true;
            } else if (this.dragMode === 'shape') {
                const dx = pos.x - this.lastMouseX;
                const dy = pos.y - this.lastMouseY;
                // Move all selected shapes
                this.selectedShapes.forEach(shape => {
                    shape.points.forEach(p => {
                        p.x += dx;
                        p.y += dy;
                    });
                });
                this.shapeWasModified = true;
            } else if (this.dragMode === 'selection-box' && this.selectionBox) {
                // Update selection box
                this.selectionBox.x2 = pos.x;
                this.selectionBox.y2 = pos.y;
            }
            this.render();
        } else if (posChanged) {
            // Only update preview when position actually changed (grid cell change)
            this.render();
        }

        this.lastMouseX = pos.x;
        this.lastMouseY = pos.y;
    }

    handleMouseUp(e) {
        // If we were dragging a selection box, select all shapes within it
        if (this.dragMode === 'selection-box' && this.selectionBox) {
            const box = this.selectionBox;
            const minX = Math.min(box.x1, box.x2);
            const maxX = Math.max(box.x1, box.x2);
            const minY = Math.min(box.y1, box.y2);
            const maxY = Math.max(box.y1, box.y2);

            this.selectedShapes = this.shapes.filter(shape => {
                // Check if any point of the shape is within the selection box
                return shape.points.some(p =>
                    p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY
                );
            });

            this.selectedShape = this.selectedShapes.length === 1 ? this.selectedShapes[0] : null;
            this.selectionBox = null;
            this.render();
        }

        // Save history only if shapes were actually modified (moved, resized, etc.)
        if (this.shapeWasModified && this.isDragging && (this.dragMode === 'point' || this.dragMode === 'shape')) {
            this.saveHistory();
            this.updateShapeOrderPreview();
        }

        this.mouseDown = false;
        this.isDragging = false;
        this.dragMode = null;
        this.shapeWasModified = false;
    }

    handleLeftClick(pos, shiftKey = false) {
        if (this.currentTool === 'select') {
            // Try to select a node first (higher priority) - only if single shape selected
            if (this.selectedShapes.length <= 1 && this.trySelectNode(pos, shiftKey)) {
                return;
            }

            // If no node was found, try to select a shape
            const clickedShape = this.findShapeAtPosition(pos);

            if (clickedShape) {
                if (shiftKey) {
                    // Multi-select: toggle shape in selection
                    const index = this.selectedShapes.indexOf(clickedShape);
                    if (index === -1) {
                        this.selectedShapes.push(clickedShape);
                    } else {
                        this.selectedShapes.splice(index, 1);
                    }
                    this.selectedShape = this.selectedShapes.length === 1 ? this.selectedShapes[0] : null;
                    this.render();
                } else {
                    // Check if clicked shape is already in selection
                    if (this.selectedShapes.includes(clickedShape)) {
                        // Start dragging all selected shapes
                        this.isDragging = true;
                        this.dragMode = 'shape';
                    } else {
                        // Single select - replace selection
                        this.selectedShapes = [clickedShape];
                        this.selectedShape = clickedShape;
                        this.isDragging = true;
                        this.dragMode = 'shape';
                        this.render();
                    }
                }
            } else if (!shiftKey) {
                // Start selection box if not clicking on a shape
                this.selectionBox = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y };
                this.isDragging = true;
                this.dragMode = 'selection-box';
                this.selectedShapes = [];
                this.selectedShape = null;
                this.selectedPoint = null;
                this.selectedPoints = [];
                this.render();
            }
            return;
        }

        this.addPoint(pos);
    }

    handleRightClick(pos) {
        // Check if drawing a polygon - right-click finishes it
        if (this.currentTool === 'polygon' && this.currentPoints.length >= 3) {
            const firstPoint = this.currentPoints[0];
            const dist = Math.sqrt((pos.x - firstPoint.x) ** 2 + (pos.y - firstPoint.y) ** 2);

            // If not clicking near the first node, add this point first
            if (dist >= 15) {
                this.currentPoints.push({...pos});
            }

            // Finish the polygon
            this.finishShape();
            return;
        }

        // In select mode with a shape selected, try to add or remove nodes
        if (this.currentTool === 'select' && this.selectedShape) {
            // Check if clicking on an existing node to remove it
            const nodeIndex = this.findNodeIndex(pos, this.selectedShape);
            if (nodeIndex !== -1) {
                this.removeNode(nodeIndex);
            } else if (this.canAddNodeToShape(this.selectedShape)) {
                // Add a new node at this position
                this.addNodeToShape(pos);
            }
        }
    }

    findNodeIndex(pos, shape) {
        for (let i = 0; i < shape.points.length; i++) {
            const point = shape.points[i];
            const dist = Math.sqrt((point.x - pos.x) ** 2 + (point.y - pos.y) ** 2);
            if (dist < 10) {
                return i;
            }
        }
        return -1;
    }

    canAddNodeToShape(shape) {
        // Only allow adding nodes to lines and polygons (not triangles, circles, rects, or fills)
        return shape.type === 'line' || shape.type === 'polygon';
    }

    addNodeToShape(pos) {
        const shape = this.selectedShape;

        if (shape.type === 'line') {
            // For lines, add the point at the end
            shape.points.push({x: pos.x, y: pos.y});
        } else if (shape.type === 'polygon') {
            // For polygons, find the closest edge and insert the point there
            let closestEdge = 0;
            let minDist = Infinity;

            for (let i = 0; i < shape.points.length; i++) {
                const p1 = shape.points[i];
                const p2 = shape.points[(i + 1) % shape.points.length];
                const dist = this.distanceToLine(pos, p1, p2);

                if (dist < minDist) {
                    minDist = dist;
                    closestEdge = i;
                }
            }

            // Insert after the closest edge's first point
            shape.points.splice(closestEdge + 1, 0, {x: pos.x, y: pos.y});
        }

        this.render();
        this.saveHistory();
        this.updateShapeOrderPreview();
    }

    removeNode(nodeIndex) {
        const shape = this.selectedShape;

        // Don't allow removing nodes if it would make the shape invalid
        if (shape.type === 'line' && shape.points.length <= 2) {
            return; // Need at least 2 points for a line
        }
        if (shape.type === 'polygon' && shape.points.length <= 3) {
            return; // Need at least 3 points for a polygon
        }
        if (shape.type === 'triangle') {
            return; // Triangles always need exactly 3 points
        }
        if (shape.type === 'rect' || shape.type === 'circle' || shape.type === 'oval') {
            return; // These shapes have fixed node counts
        }

        shape.points.splice(nodeIndex, 1);
        this.selectedPoint = null;
        this.render();
        this.saveHistory();
        this.updateShapeOrderPreview();
    }

    trySelectNode(pos, shiftKey = false) {
        // Find closest point within threshold
        let closestDist = Infinity;
        let closestPoint = null;
        let closestShape = null;

        // Only search within the currently selected shape if one is selected
        const searchShapes = this.selectedShape ? [this.selectedShape] : this.shapes;

        for (const shape of searchShapes) {
            for (const point of shape.points) {
                const dist = Math.sqrt((point.x - pos.x) ** 2 + (point.y - pos.y) ** 2);
                if (dist < closestDist && dist < 10) {
                    closestDist = dist;
                    closestPoint = point;
                    closestShape = shape;
                }
            }
        }

        if (closestPoint) {
            if (shiftKey) {
                // Multi-select nodes: toggle point in selection
                const index = this.selectedPoints.indexOf(closestPoint);
                if (index === -1) {
                    this.selectedPoints.push(closestPoint);
                } else {
                    this.selectedPoints.splice(index, 1);
                }
                this.selectedPoint = this.selectedPoints.length === 1 ? this.selectedPoints[0] : null;
                this.selectedShape = closestShape;
            } else {
                // Single select
                this.selectedPoint = closestPoint;
                this.selectedPoints = [closestPoint];
                this.selectedShape = closestShape;
                this.isDragging = true;
                this.dragMode = 'point';
            }
            this.render();
            return true;
        }
        return false;
    }

    addPoint(pos) {
        // Fill tool - single click fills a cell immediately
        if (this.currentTool === 'fill') {
            const shape = {
                type: 'fill',
                color: this.currentColor,
                lineWidth: 1,
                outline: false,
                points: [{...pos}]
            };
            this.shapes.push(shape);
            this.selectedShape = shape;
            this.render();
            return;
        }

        this.currentPoints.push({...pos});

        // Auto-finish shapes based on point count
        let shouldFinish = false;
        switch (this.currentTool) {
            case 'line':
                shouldFinish = this.currentPoints.length === 2;
                break;
            case 'rect':
            case 'circle':
            case 'oval':
                shouldFinish = this.currentPoints.length === 2;
                break;
            case 'triangle':
                shouldFinish = this.currentPoints.length === 3;
                break;
        }

        if (shouldFinish) {
            this.finishShape();
        } else {
            this.render();
        }
    }

    finishShape() {
        if (this.currentPoints.length === 0) return;

        const shape = {
            type: this.currentTool,
            color: this.currentColor,
            lineWidth: this.lineWidth,
            outline: false,
            points: [...this.currentPoints],
            name: null // Custom name (null = use default type name)
        };

        this.shapes.push(shape);
        this.selectedShape = shape;
        this.currentPoints = [];
        this.saveHistory();
        this.render();
    }

    saveHistory() {
        // Remove any history after current index (for redo)
        this.history = this.history.slice(0, this.historyIndex + 1);

        // Save current state with canvas dimensions
        this.history.push({
            shapes: JSON.parse(JSON.stringify(this.shapes)),
            canvasWidth: this.canvasWidth,
            canvasHeight: this.canvasHeight
        });

        // Limit history size
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
    }


    findShapeAtPosition(pos) {
        // Find shape containing point (top to bottom)
        for (let i = this.shapes.length - 1; i >= 0; i--) {
            const shape = this.shapes[i];
            if (this.isPointInShape(pos, shape)) {
                return shape;
            }
        }
        return null;
    }

    startMoveShape(pos) {
        // Find shape containing point
        for (let i = this.shapes.length - 1; i >= 0; i--) {
            const shape = this.shapes[i];
            if (this.isPointInShape(pos, shape)) {
                this.selectedShape = shape;
                this.isDragging = true;
                this.dragMode = 'shape';
                this.lastMouseX = pos.x;
                this.lastMouseY = pos.y;
                this.render();
                return;
            }
        }
    }

    isPointInShape(pos, shape) {
        switch (shape.type) {
            case 'rect':
                return this.isPointInRect(pos, shape.points);
            case 'circle':
                return this.isPointInCircle(pos, shape.points);
            case 'oval':
                return this.isPointInOval(pos, shape.points);
            case 'triangle':
                return this.isPointInTriangle(pos, shape.points);
            case 'polygon':
                return this.isPointInPolygon(pos, shape.points);
            case 'line':
                return this.isPointNearLine(pos, shape.points);
            case 'fill':
                return this.isPointInFillCell(pos, shape.points);
            default:
                return false;
        }
    }

    isPointInFillCell(pos, points) {
        const cellSize = this.getCellSize();
        const point = points[0];

        if (cellSize > 0) {
            // Grid mode - check if in same cell
            const cellX = Math.floor(point.x / cellSize);
            const cellY = Math.floor(point.y / cellSize);
            const posX = Math.floor(pos.x / cellSize);
            const posY = Math.floor(pos.y / cellSize);
            return cellX === posX && cellY === posY;
        } else {
            // Regular mode - check 4x4 square
            return Math.abs(pos.x - point.x) <= 2 && Math.abs(pos.y - point.y) <= 2;
        }
    }

    isPointInRect(pos, points) {
        const x1 = Math.min(points[0].x, points[1].x);
        const x2 = Math.max(points[0].x, points[1].x);
        const y1 = Math.min(points[0].y, points[1].y);
        const y2 = Math.max(points[0].y, points[1].y);
        return pos.x >= x1 && pos.x <= x2 && pos.y >= y1 && pos.y <= y2;
    }

    isPointInCircle(pos, points) {
        const dx = points[1].x - points[0].x;
        const dy = points[1].y - points[0].y;
        const radius = Math.sqrt(dx * dx + dy * dy);
        const dist = Math.sqrt((pos.x - points[0].x) ** 2 + (pos.y - points[0].y) ** 2);
        return dist <= radius;
    }

    isPointInOval(pos, points) {
        const x1 = Math.min(points[0].x, points[1].x);
        const y1 = Math.min(points[0].y, points[1].y);
        const x2 = Math.max(points[0].x, points[1].x);
        const y2 = Math.max(points[0].y, points[1].y);

        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const rx = Math.abs(x2 - x1) / 2;
        const ry = Math.abs(y2 - y1) / 2;

        if (rx === 0 || ry === 0) return false;

        // Check if point is inside ellipse using standard ellipse equation
        const dx = (pos.x - cx) / rx;
        const dy = (pos.y - cy) / ry;
        return (dx * dx + dy * dy) <= 1;
    }

    isPointInTriangle(pos, points) {
        const area = (p1, p2, p3) => {
            return Math.abs((p2.x - p1.x) * (p3.y - p1.y) - (p3.x - p1.x) * (p2.y - p1.y));
        };
        const areaOrig = area(points[0], points[1], points[2]);
        const area1 = area(pos, points[1], points[2]);
        const area2 = area(points[0], pos, points[2]);
        const area3 = area(points[0], points[1], pos);
        return Math.abs(areaOrig - (area1 + area2 + area3)) < 1;
    }

    isPointInPolygon(pos, points) {
        // Use ray casting algorithm
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const xi = points[i].x, yi = points[i].y;
            const xj = points[j].x, yj = points[j].y;
            const intersect = ((yi > pos.y) !== (yj > pos.y))
                && (pos.x < (xj - xi) * (pos.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    isPointNearLine(pos, points) {
        const dist = this.distanceToLine(pos, points[0], points[1]);
        return dist < 10;
    }

    distanceToLine(point, lineStart, lineEnd) {
        const A = point.x - lineStart.x;
        const B = point.y - lineStart.y;
        const C = lineEnd.x - lineStart.x;
        const D = lineEnd.y - lineStart.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;

        if (param < 0) {
            xx = lineStart.x;
            yy = lineStart.y;
        } else if (param > 1) {
            xx = lineEnd.x;
            yy = lineEnd.y;
        } else {
            xx = lineStart.x + param * C;
            yy = lineStart.y + param * D;
        }

        const dx = point.x - xx;
        const dy = point.y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    copyShape() {
        if (this.selectedShapes.length > 0) {
            this.copiedShapes = JSON.parse(JSON.stringify(this.selectedShapes));
        } else if (this.selectedShape) {
            this.copiedShapes = [JSON.parse(JSON.stringify(this.selectedShape))];
        }
    }

    pasteShape() {
        if (this.copiedShapes.length > 0) {
            const newShapes = JSON.parse(JSON.stringify(this.copiedShapes));
            // Offset the pasted shapes slightly
            newShapes.forEach(shape => {
                shape.points.forEach(p => {
                    p.x += 10;
                    p.y += 10;
                });
                this.shapes.push(shape);
            });
            // Select the pasted shapes
            this.selectedShapes = newShapes;
            this.selectedShape = newShapes.length === 1 ? newShapes[0] : null;
            this.saveHistory();
            this.render();
        }
    }

    deleteShape() {
        if (this.selectedShapes.length > 0) {
            // Delete all selected shapes
            this.selectedShapes.forEach(shape => {
                const index = this.shapes.indexOf(shape);
                if (index > -1) {
                    this.shapes.splice(index, 1);
                }
            });
            this.selectedShapes = [];
            this.selectedShape = null;
            this.selectedPoint = null;
            this.saveHistory();
            this.render();
        } else if (this.shapes.length > 0) {
            // Delete last shape if none selected
            this.shapes.pop();
            this.saveHistory();
            this.render();
        }
    }

    bringToFront() {
        if (this.selectedShapes.length === 0) return;

        // Move all selected shapes to the end (front) of the array
        this.selectedShapes.forEach(shape => {
            const index = this.shapes.indexOf(shape);
            if (index > -1) {
                this.shapes.splice(index, 1);
                this.shapes.push(shape);
            }
        });
        this.render();
        this.updateShapeOrderPreview();
    }

    sendToBack() {
        if (this.selectedShapes.length === 0) return;

        // Move all selected shapes to the beginning (back) of the array
        // Reverse to maintain relative order
        [...this.selectedShapes].reverse().forEach(shape => {
            const index = this.shapes.indexOf(shape);
            if (index > -1) {
                this.shapes.splice(index, 1);
                this.shapes.unshift(shape);
            }
        });
        this.render();
        this.updateShapeOrderPreview();
    }

    bringForward() {
        if (this.selectedShapes.length === 0) return;

        // Sort by current index to avoid conflicts
        const sorted = [...this.selectedShapes].sort((a, b) =>
            this.shapes.indexOf(b) - this.shapes.indexOf(a)
        );

        sorted.forEach(shape => {
            const index = this.shapes.indexOf(shape);
            if (index > -1 && index < this.shapes.length - 1) {
                // Swap with next shape
                [this.shapes[index], this.shapes[index + 1]] =
                [this.shapes[index + 1], this.shapes[index]];
            }
        });
        this.render();
        this.updateShapeOrderPreview();
    }

    sendBackward() {
        if (this.selectedShapes.length === 0) return;

        // Sort by current index to avoid conflicts
        const sorted = [...this.selectedShapes].sort((a, b) =>
            this.shapes.indexOf(a) - this.shapes.indexOf(b)
        );

        sorted.forEach(shape => {
            const index = this.shapes.indexOf(shape);
            if (index > 0) {
                // Swap with previous shape
                [this.shapes[index], this.shapes[index - 1]] =
                [this.shapes[index - 1], this.shapes[index]];
            }
        });
        this.render();
        this.updateShapeOrderPreview();
    }

    booleanUnion() {
        if (this.selectedShapes.length < 2) {
            alert('Select at least 2 shapes to perform union operation');
            return;
        }

        // First shape is the base, last clicked shape is added to it
        const baseShape = this.selectedShapes[0];
        const addShape = this.selectedShapes[this.selectedShapes.length - 1];

        // Get bounding box of both shapes combined
        const pixels = this.rasterizeShapesToPixels([baseShape, addShape]);

        // Create new polygon from combined pixels
        const newShape = this.pixelsToPolygon(pixels, baseShape.color);

        if (newShape) {
            // Remove both shapes
            this.selectedShapes.forEach(shape => {
                const index = this.shapes.indexOf(shape);
                if (index > -1) this.shapes.splice(index, 1);
            });

            // Add new combined shape
            this.shapes.push(newShape);
            this.selectedShapes = [newShape];
            this.selectedShape = newShape;
            this.saveHistory();
            this.render();
        }
    }

    booleanSubtract() {
        if (this.selectedShapes.length < 2) {
            alert('Select at least 2 shapes to perform subtract operation');
            return;
        }

        // First shape is the base, last clicked shape is removed from it
        const baseShape = this.selectedShapes[0];
        const subtractShape = this.selectedShapes[this.selectedShapes.length - 1];

        // Rasterize both shapes
        const basePixels = this.rasterizeShapesToPixels([baseShape]);
        const subtractPixels = this.rasterizeShapesToPixels([subtractShape]);

        // Remove subtract pixels from base
        subtractPixels.forEach(key => basePixels.delete(key));

        // Create new polygon from result
        const newShape = this.pixelsToPolygon(basePixels, baseShape.color);

        if (newShape) {
            // Remove both shapes
            this.selectedShapes.forEach(shape => {
                const index = this.shapes.indexOf(shape);
                if (index > -1) this.shapes.splice(index, 1);
            });

            // Add new shape
            this.shapes.push(newShape);
            this.selectedShapes = [newShape];
            this.selectedShape = newShape;
            this.saveHistory();
            this.render();
        }
    }

    booleanIntersect() {
        if (this.selectedShapes.length < 2) {
            alert('Select at least 2 shapes to perform intersect operation');
            return;
        }

        // Keep only pixels that exist in both shapes
        const baseShape = this.selectedShapes[0];
        const intersectShape = this.selectedShapes[this.selectedShapes.length - 1];

        const basePixels = this.rasterizeShapesToPixels([baseShape]);
        const intersectPixels = this.rasterizeShapesToPixels([intersectShape]);

        // Keep only common pixels
        const result = new Set();
        basePixels.forEach(key => {
            if (intersectPixels.has(key)) result.add(key);
        });

        // Create new polygon from result
        const newShape = this.pixelsToPolygon(result, baseShape.color);

        if (newShape) {
            // Remove both shapes
            this.selectedShapes.forEach(shape => {
                const index = this.shapes.indexOf(shape);
                if (index > -1) this.shapes.splice(index, 1);
            });

            // Add new shape
            this.shapes.push(newShape);
            this.selectedShapes = [newShape];
            this.selectedShape = newShape;
            this.saveHistory();
            this.render();
        }
    }

    convertToPolygon() {
        if (this.selectedShapes.length === 0) {
            alert('Select at least one shape to convert to polygon');
            return;
        }

        const convertedShapes = [];

        this.selectedShapes.forEach(shape => {
            if (shape.type === 'polygon') {
                // Already a polygon, keep as is
                convertedShapes.push(shape);
                return;
            }

            // For lines, convert directly to a rectangular polygon
            if (shape.type === 'line' && shape.points.length === 2) {
                const linePolygon = this.lineToPolygon(shape);
                if (linePolygon) {
                    convertedShapes.push(linePolygon);
                    // Remove original shape
                    const index = this.shapes.indexOf(shape);
                    if (index > -1) {
                        this.shapes.splice(index, 1);
                    }
                }
                return;
            }

            // For other shapes, rasterize and convert to polygon
            const pixels = this.rasterizeShapesToPixels([shape]);
            const newShape = this.pixelsToPolygon(pixels, shape.color);

            if (newShape) {
                // Preserve outline property
                newShape.outline = shape.outline;
                convertedShapes.push(newShape);

                // Remove original shape
                const index = this.shapes.indexOf(shape);
                if (index > -1) {
                    this.shapes.splice(index, 1);
                }
            }
        });

        // Add converted shapes
        convertedShapes.forEach(shape => this.shapes.push(shape));

        // Update selection
        this.selectedShapes = convertedShapes;
        this.selectedShape = convertedShapes.length === 1 ? convertedShapes[0] : null;
        this.saveHistory();
        this.render();
    }

    unionNodes() {
        // Check if we have multiple nodes selected within a single shape
        if (this.selectedPoints.length >= 2 && this.selectedShape) {
            // Merge selected nodes within the shape
            if (!this.selectedShape.points) {
                alert('Selected shape has no points');
                return;
            }

            // Calculate the average position of all selected points
            const avgX = this.selectedPoints.reduce((sum, p) => sum + p.x, 0) / this.selectedPoints.length;
            const avgY = this.selectedPoints.reduce((sum, p) => sum + p.y, 0) / this.selectedPoints.length;

            // Find the first selected point in the shape's points array
            let firstIndex = -1;
            for (let i = 0; i < this.selectedShape.points.length; i++) {
                if (this.selectedPoints.includes(this.selectedShape.points[i])) {
                    firstIndex = i;
                    break;
                }
            }

            if (firstIndex === -1) {
                alert('Could not find selected points in shape');
                return;
            }

            // Replace the first selected point with the averaged position
            this.selectedShape.points[firstIndex] = { x: avgX, y: avgY };

            // Remove all other selected points from the shape
            this.selectedShape.points = this.selectedShape.points.filter(p => {
                return !this.selectedPoints.includes(p) || p === this.selectedShape.points[firstIndex];
            });

            // Update selection to the merged point
            this.selectedPoint = this.selectedShape.points[firstIndex];
            this.selectedPoints = [this.selectedPoint];

            this.saveHistory();
            this.updateShapeOrderPreview();
            this.render();
        } else {
            alert('Select at least 2 nodes within a shape (use Shift+Click)');
        }
    }

    lineToPolygon(lineShape) {
        const p1 = lineShape.points[0];
        const p2 = lineShape.points[1];
        const width = lineShape.lineWidth || 1;

        // Calculate perpendicular vector for line width
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);

        if (length === 0) return null;

        // Perpendicular unit vector
        const perpX = -dy / length;
        const perpY = dx / length;

        // Half width offset
        const halfWidth = width / 2;

        // Create rectangle around the line
        const points = [
            { x: p1.x + perpX * halfWidth, y: p1.y + perpY * halfWidth },
            { x: p2.x + perpX * halfWidth, y: p2.y + perpY * halfWidth },
            { x: p2.x - perpX * halfWidth, y: p2.y - perpY * halfWidth },
            { x: p1.x - perpX * halfWidth, y: p1.y - perpY * halfWidth }
        ];

        return {
            type: 'polygon',
            points: points,
            color: lineShape.color,
            lineWidth: 1,
            outline: lineShape.outline || false
        };
    }

    rasterizeShapesToPixels(shapes) {
        const pixels = new Set();

        shapes.forEach(shape => {
            // For lines, convert to polygon first to preserve shape
            let shapeToRasterize = shape;
            if (shape.type === 'line' && shape.points.length === 2) {
                shapeToRasterize = this.lineToPolygon(shape);
                if (!shapeToRasterize) return;
            }

            // Temporarily create a test canvas to rasterize the shape
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.canvasWidth;
            tempCanvas.height = this.canvasHeight;
            const tempCtx = tempCanvas.getContext('2d');

            // Save current context and swap
            const origCtx = this.ctx;
            const origScale = this.scale;
            this.ctx = tempCtx;
            this.scale = 1;

            // Force shape to be filled (not outline) for boolean operations
            const originalOutline = shapeToRasterize.outline;
            shapeToRasterize.outline = false;

            // Draw the shape
            this.drawShape(shapeToRasterize, false);

            // Restore outline property
            shapeToRasterize.outline = originalOutline;

            // Get pixel data
            const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            for (let y = 0; y < tempCanvas.height; y++) {
                for (let x = 0; x < tempCanvas.width; x++) {
                    const i = (y * tempCanvas.width + x) * 4;
                    const alpha = imageData.data[i + 3];
                    if (alpha > 0) {
                        pixels.add(`${x},${y}`);
                    }
                }
            }

            // Restore context
            this.ctx = origCtx;
            this.scale = origScale;
        });

        return pixels;
    }

    pixelsToPolygon(pixels, color) {
        if (pixels.size === 0) return null;

        // Find bounding box
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        pixels.forEach(key => {
            const [x, y] = key.split(',').map(Number);
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        });

        // Create a grid for marching squares
        const grid = [];
        for (let y = minY - 1; y <= maxY + 1; y++) {
            const row = [];
            for (let x = minX - 1; x <= maxX + 1; x++) {
                row.push(pixels.has(`${x},${y}`) ? 1 : 0);
            }
            grid.push(row);
        }

        // Use marching squares to trace the outline
        const outlinePoints = this.marchingSquares(grid, minX - 1, minY - 1);

        if (outlinePoints.length < 3) return null;

        return {
            type: 'polygon',
            points: outlinePoints,
            color: color,
            lineWidth: 1,
            outline: false
        };
    }

    findAllContours(grid, offsetX, offsetY) {
        const height = grid.length;
        const width = grid[0].length;
        const visited = Array(height).fill(0).map(() => Array(width).fill(false));
        const contours = [];

        // First pass: find the main outer contour (largest filled region)
        let largestContour = null;
        let largestArea = 0;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (grid[y][x] === 1 && !visited[y][x]) {
                    const region = this.getRegionPixels(grid, visited, x, y, 1);
                    if (region.size > largestArea) {
                        largestArea = region.size;
                        largestContour = this.marchingSquaresFromRegion(grid, region, offsetX, offsetY);
                    }
                }
            }
        }

        if (largestContour && largestContour.length >= 3) {
            contours.push(largestContour);
        }

        // Reset visited for hole detection
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                visited[y][x] = false;
            }
        }

        // Second pass: find holes (empty regions surrounded by filled pixels)
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (grid[y][x] === 0 && !visited[y][x]) {
                    if (this.isHole(grid, x, y)) {
                        const region = this.getRegionPixels(grid, visited, x, y, 0);
                        const holeContour = this.marchingSquaresFromRegion(grid, region, offsetX, offsetY, true);
                        if (holeContour && holeContour.length >= 3) {
                            contours.push(holeContour);
                        }
                    } else {
                        // Mark as visited
                        this.floodFillVisited(grid, visited, x, y, 0);
                    }
                }
            }
        }

        return contours;
    }

    getRegionPixels(grid, visited, startX, startY, value) {
        const height = grid.length;
        const width = grid[0].length;
        const region = new Set();
        const queue = [{x: startX, y: startY}];
        visited[startY][startX] = true;

        while (queue.length > 0) {
            const {x, y} = queue.shift();
            region.add(`${x},${y}`);

            const neighbors = [{x: x-1, y}, {x: x+1, y}, {x, y: y-1}, {x, y: y+1}];
            for (const {x: nx, y: ny} of neighbors) {
                if (nx >= 0 && nx < width && ny >= 0 && ny < height &&
                    grid[ny][nx] === value && !visited[ny][nx]) {
                    visited[ny][nx] = true;
                    queue.push({x: nx, y: ny});
                }
            }
        }

        return region;
    }

    marchingSquaresFromRegion(grid, region, offsetX, offsetY, isHole = false) {
        // Create a sub-grid for just this region
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        region.forEach(key => {
            const [x, y] = key.split(',').map(Number);
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        });

        // Create sub-grid with padding
        const subWidth = maxX - minX + 3;
        const subHeight = maxY - minY + 3;
        const subGrid = Array(subHeight).fill(0).map(() => Array(subWidth).fill(0));

        region.forEach(key => {
            const [x, y] = key.split(',').map(Number);
            const sx = x - minX + 1;
            const sy = y - minY + 1;
            subGrid[sy][sx] = 1;
        });

        // For holes, we need to invert the grid
        if (isHole) {
            for (let y = 0; y < subHeight; y++) {
                for (let x = 0; x < subWidth; x++) {
                    subGrid[y][x] = 1 - subGrid[y][x];
                }
            }
        }

        return this.marchingSquares(subGrid, minX - 1 + offsetX, minY - 1 + offsetY);
    }

    isHole(grid, startX, startY) {
        // Check if this empty region is completely surrounded by filled pixels
        const height = grid.length;
        const width = grid[0].length;

        // If touching the edge, it's not a hole
        if (startX === 0 || startX === width - 1 || startY === 0 || startY === height - 1) {
            return false;
        }

        // Quick check: do a flood fill and see if we reach the edge
        const visited = Array(height).fill(0).map(() => Array(width).fill(false));
        const queue = [{x: startX, y: startY}];
        visited[startY][startX] = true;

        while (queue.length > 0) {
            const {x, y} = queue.shift();

            // If we reached the edge, not a hole
            if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
                return false;
            }

            // Check 4 neighbors
            const neighbors = [{x: x-1, y}, {x: x+1, y}, {x, y: y-1}, {x, y: y+1}];
            for (const {x: nx, y: ny} of neighbors) {
                if (nx >= 0 && nx < width && ny >= 0 && ny < height &&
                    grid[ny][nx] === 0 && !visited[ny][nx]) {
                    visited[ny][nx] = true;
                    queue.push({x: nx, y: ny});
                }
            }
        }

        return true; // Didn't reach edge, so it's a hole
    }


    floodFillVisited(grid, visited, startX, startY, value) {
        const height = grid.length;
        const width = grid[0].length;
        const queue = [{x: startX, y: startY}];
        visited[startY][startX] = true;

        while (queue.length > 0) {
            const {x, y} = queue.shift();

            const neighbors = [{x: x-1, y}, {x: x+1, y}, {x, y: y-1}, {x, y: y+1}];
            for (const {x: nx, y: ny} of neighbors) {
                if (nx >= 0 && nx < width && ny >= 0 && ny < height &&
                    grid[ny][nx] === value && !visited[ny][nx]) {
                    visited[ny][nx] = true;
                    queue.push({x: nx, y: ny});
                }
            }
        }
    }

    marchingSquares(grid, offsetX, offsetY) {
        const height = grid.length;
        const width = grid[0].length;

        // Find all contour edges by looking for pixels next to empty space
        const edgePixels = [];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (grid[y][x] === 1) {
                    // Check if this pixel is on the edge (has at least one empty neighbor)
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

        // Find the topmost-leftmost point to start
        edgePixels.sort((a, b) => {
            if (a.y !== b.y) return a.y - b.y;
            return a.x - b.x;
        });

        // Trace the contour by connecting nearest neighbors
        const contour = [edgePixels[0]];
        const used = new Set([0]);

        while (contour.length < edgePixels.length && contour.length < 500) {
            const current = contour[contour.length - 1];
            let nearestIdx = -1;
            let nearestDist = Infinity;

            // Find nearest unused edge pixel (prefer adjacent pixels)
            for (let i = 0; i < edgePixels.length; i++) {
                if (used.has(i)) continue;

                const p = edgePixels[i];
                const dx = p.x - current.x;
                const dy = p.y - current.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Only connect to adjacent or very close pixels
                if (dist <= 1.5 && dist < nearestDist) {
                    nearestDist = dist;
                    nearestIdx = i;
                }
            }

            if (nearestIdx === -1) break;

            contour.push(edgePixels[nearestIdx]);
            used.add(nearestIdx);
        }

        // Simplify the contour
        return this.simplifyPolygon(contour, 0.5);
    }

    simplifyPolygon(points, tolerance) {
        if (points.length < 3) return points;

        // Remove consecutive duplicate points first (including very close points)
        const unique = [points[0]];
        for (let i = 1; i < points.length; i++) {
            const prev = unique[unique.length - 1];
            const curr = points[i];
            const dx = curr.x - prev.x;
            const dy = curr.y - prev.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            // Only add if not too close to previous point
            if (dist > 0.5) {
                unique.push(curr);
            }
        }

        // Check if first and last points are the same or very close
        if (unique.length > 1) {
            const first = unique[0];
            const last = unique[unique.length - 1];
            const dx = last.x - first.x;
            const dy = last.y - first.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 0.5) {
                unique.pop(); // Remove duplicate closing point
            }
        }

        if (unique.length < 3) return unique;

        // Ramer-Douglas-Peucker algorithm for aggressive simplification
        const simplified = this.douglasPeucker(unique, tolerance);

        // Further simplify by removing points that are nearly collinear
        // For polygons (closed shapes), also check the wrap-around case
        const final = [];
        for (let i = 0; i < simplified.length; i++) {
            const prev = simplified[(i - 1 + simplified.length) % simplified.length];
            const curr = simplified[i];
            const next = simplified[(i + 1) % simplified.length];

            // Check if curr is roughly on the line between prev and next
            const dx1 = curr.x - prev.x;
            const dy1 = curr.y - prev.y;
            const dx2 = next.x - curr.x;
            const dy2 = next.y - curr.y;

            // Cross product to check collinearity
            const cross = Math.abs(dx1 * dy2 - dy1 * dx2);

            if (cross > 0.5) { // Not collinear, keep the point
                final.push(curr);
            }
        }

        return final.length >= 3 ? final : simplified;
    }

    douglasPeucker(points, tolerance) {
        if (points.length < 3) return points;

        // Find the point with maximum distance from the line between first and last
        let maxDist = 0;
        let maxIndex = 0;
        const first = points[0];
        const last = points[points.length - 1];

        for (let i = 1; i < points.length - 1; i++) {
            const dist = this.perpendicularDistance(points[i], first, last);
            if (dist > maxDist) {
                maxDist = dist;
                maxIndex = i;
            }
        }

        // If max distance is greater than tolerance, recursively simplify
        if (maxDist > tolerance) {
            const left = this.douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
            const right = this.douglasPeucker(points.slice(maxIndex), tolerance);
            return left.slice(0, -1).concat(right);
        } else {
            return [first, last];
        }
    }

    perpendicularDistance(point, lineStart, lineEnd) {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;

        if (dx === 0 && dy === 0) {
            return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
        }

        const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
        const clampedT = Math.max(0, Math.min(1, t));

        const projX = lineStart.x + clampedT * dx;
        const projY = lineStart.y + clampedT * dy;

        return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
    }

    undo() {
        if (this.historyIndex >= 0) {
            this.historyIndex--;
            // If we go to index -1, that's a blank canvas
            if (this.historyIndex < 0) {
                this.shapes = [];
            } else {
                const state = this.history[this.historyIndex];
                this.shapes = JSON.parse(JSON.stringify(state.shapes));
                // Restore canvas dimensions if they were saved
                if (state.canvasWidth && state.canvasHeight) {
                    this.canvasWidth = state.canvasWidth;
                    this.canvasHeight = state.canvasHeight;
                    this.canvas.width = this.canvasWidth * this.scale;
                    this.canvas.height = this.canvasHeight * this.scale;
                }
            }
            this.selectedShape = null;
            this.selectedShapes = [];
            this.selectedPoint = null;
            this.render();
            this.updateShapeOrderPreview();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const state = this.history[this.historyIndex];
            this.shapes = JSON.parse(JSON.stringify(state.shapes));
            // Restore canvas dimensions if they were saved
            if (state.canvasWidth && state.canvasHeight) {
                this.canvasWidth = state.canvasWidth;
                this.canvasHeight = state.canvasHeight;
                this.canvas.width = this.canvasWidth * this.scale;
                this.canvas.height = this.canvasHeight * this.scale;
            }
            this.selectedShape = null;
            this.selectedShapes = [];
            this.selectedPoint = null;
            this.render();
            this.updateShapeOrderPreview();
        }
    }

    clear() {
        if (confirm('Clear all shapes?')) {
            this.shapes = [];
            this.currentPoints = [];
            this.selectedShape = null;
            this.selectedPoint = null;
            this.saveHistory();
            this.render();
        }
    }

    save() {
        const data = {
            canvasWidth: this.canvasWidth,
            canvasHeight: this.canvasHeight,
            backgroundColor: this.backgroundColor,
            shapes: this.shapes
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'vector-art.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    load() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const data = JSON.parse(event.target.result);

                        // Handle both old format (just shapes array) and new format (with canvas dimensions)
                        if (Array.isArray(data)) {
                            // Old format - just shapes
                            this.shapes = data;
                        } else {
                            // New format - includes canvas dimensions
                            this.shapes = data.shapes || [];
                            if (data.canvasWidth && data.canvasHeight) {
                                this.canvasWidth = data.canvasWidth;
                                this.canvasHeight = data.canvasHeight;
                                this.canvas.width = this.canvasWidth * this.scale;
                                this.canvas.height = this.canvasHeight * this.scale;
                            }
                            if (data.backgroundColor) {
                                this.backgroundColor = data.backgroundColor;
                                document.getElementById('bg-color').value = this.backgroundColor;
                            }
                        }

                        this.currentPoints = [];
                        this.selectedShape = null;
                        this.selectedPoint = null;
                        this.render();
                    } catch (err) {
                        alert('Error loading file: ' + err.message);
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }

    showExportDialog(format) {
        const modal = document.getElementById('exportModal');
        const titleEl = document.getElementById('exportModalTitle');
        const scaleInput = document.getElementById('exportScale');
        const sizeSpan = document.getElementById('exportSize');
        const transparentCheckbox = document.getElementById('exportTransparent');
        const transparentOption = document.getElementById('exportTransparencyOption');
        const confirmBtn = document.getElementById('exportConfirm');
        const cancelBtn = document.getElementById('exportCancel');

        // Set title and transparency option visibility
        titleEl.textContent = `Export as ${format.toUpperCase()}`;
        transparentOption.style.display = format === 'png' ? 'block' : 'none';

        // Calculate pixel-perfect size based on grid
        const actualWidth = this.gridCells > 0 ? this.gridCells : this.canvasWidth;
        const actualHeight = this.gridCells > 0 ? this.gridCells : this.canvasHeight;

        // Update size display
        const updateSize = () => {
            const scale = parseInt(scaleInput.value) || 1;
            sizeSpan.textContent = `${actualWidth * scale} × ${actualHeight * scale}`;
        };

        scaleInput.value = 1;
        transparentCheckbox.checked = false;
        updateSize();

        scaleInput.oninput = updateSize;

        // Show modal
        modal.style.display = 'flex';

        // Handle confirm
        const handleConfirm = () => {
            const scale = parseInt(scaleInput.value) || 1;
            const transparent = format === 'png' && transparentCheckbox.checked;
            modal.style.display = 'none';

            if (format === 'png') {
                this.exportPNG(scale, transparent);
            } else {
                this.exportJPG(scale);
            }

            cleanup();
        };

        // Handle cancel
        const handleCancel = () => {
            modal.style.display = 'none';
            cleanup();
        };

        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            scaleInput.oninput = null;
        };

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
    }

    exportPNG(exportScale = 1, transparent = false) {
        // Calculate pixel-perfect size
        const actualWidth = this.gridCells > 0 ? this.gridCells : this.canvasWidth;
        const actualHeight = this.gridCells > 0 ? this.gridCells : this.canvasHeight;

        // Step 1: Render shapes to a temporary canvas (without background if transparent)
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        // Save original state
        const savedCanvas = this.canvas;
        const savedCtx = this.ctx;
        const savedBgColor = this.backgroundColor;

        // Temporarily set transparent background if needed
        if (transparent) {
            this.backgroundColor = 'rgba(0,0,0,0)';
        }

        // Set temp canvas as current
        this.canvas = tempCanvas;
        this.ctx = tempCtx;

        // Render (this will call the normal render which includes background)
        this.render();

        // Restore original state
        this.canvas = savedCanvas;
        this.ctx = savedCtx;
        this.backgroundColor = savedBgColor;

        // Step 2: Downsample to pixel-perfect size using nearest-neighbor
        const pixelCanvas = document.createElement('canvas');
        pixelCanvas.width = actualWidth;
        pixelCanvas.height = actualHeight;
        const pixelCtx = pixelCanvas.getContext('2d');

        // Get source image data
        const sourceData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const destData = pixelCtx.createImageData(actualWidth, actualHeight);

        // Calculate scaling ratios
        const scaleX = tempCanvas.width / actualWidth;
        const scaleY = tempCanvas.height / actualHeight;

        // Nearest-neighbor downsampling - sample exact pixels
        for (let y = 0; y < actualHeight; y++) {
            for (let x = 0; x < actualWidth; x++) {
                // Find the corresponding source pixel (center of the cell)
                const srcX = Math.floor((x + 0.5) * scaleX);
                const srcY = Math.floor((y + 0.5) * scaleY);

                const srcIndex = (srcY * tempCanvas.width + srcX) * 4;
                const destIndex = (y * actualWidth + x) * 4;

                destData.data[destIndex] = sourceData.data[srcIndex];         // R
                destData.data[destIndex + 1] = sourceData.data[srcIndex + 1]; // G
                destData.data[destIndex + 2] = sourceData.data[srcIndex + 2]; // B
                destData.data[destIndex + 3] = sourceData.data[srcIndex + 3]; // A
            }
        }

        pixelCtx.putImageData(destData, 0, 0);

        // Step 3: Scale up if needed for export scale
        let finalCanvas = pixelCanvas;
        if (exportScale > 1) {
            finalCanvas = document.createElement('canvas');
            finalCanvas.width = actualWidth * exportScale;
            finalCanvas.height = actualHeight * exportScale;
            const finalCtx = finalCanvas.getContext('2d');

            // Disable image smoothing for crisp pixels
            finalCtx.imageSmoothingEnabled = false;
            finalCtx.mozImageSmoothingEnabled = false;
            finalCtx.webkitImageSmoothingEnabled = false;
            finalCtx.msImageSmoothingEnabled = false;

            // Scale up the pixel-perfect canvas
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

    exportJPG(exportScale = 1) {
        // Calculate pixel-perfect size
        const actualWidth = this.gridCells > 0 ? this.gridCells : this.canvasWidth;
        const actualHeight = this.gridCells > 0 ? this.gridCells : this.canvasHeight;

        // Step 1: Copy the current canvas as-is
        const fullCanvas = document.createElement('canvas');
        fullCanvas.width = this.canvas.width;
        fullCanvas.height = this.canvas.height;
        const fullCtx = fullCanvas.getContext('2d');

        // Draw the current canvas content
        fullCtx.drawImage(this.canvas, 0, 0);

        // Step 2: Downsample to pixel-perfect size using nearest-neighbor
        const pixelCanvas = document.createElement('canvas');
        pixelCanvas.width = actualWidth;
        pixelCanvas.height = actualHeight;
        const pixelCtx = pixelCanvas.getContext('2d');

        // Get source image data
        const sourceData = fullCtx.getImageData(0, 0, fullCanvas.width, fullCanvas.height);
        const destData = pixelCtx.createImageData(actualWidth, actualHeight);

        // Calculate scaling ratios
        const scaleX = fullCanvas.width / actualWidth;
        const scaleY = fullCanvas.height / actualHeight;

        // Nearest-neighbor downsampling - sample exact pixels
        for (let y = 0; y < actualHeight; y++) {
            for (let x = 0; x < actualWidth; x++) {
                // Find the corresponding source pixel (center of the cell)
                const srcX = Math.floor((x + 0.5) * scaleX);
                const srcY = Math.floor((y + 0.5) * scaleY);

                const srcIndex = (srcY * fullCanvas.width + srcX) * 4;
                const destIndex = (y * actualWidth + x) * 4;

                destData.data[destIndex] = sourceData.data[srcIndex];         // R
                destData.data[destIndex + 1] = sourceData.data[srcIndex + 1]; // G
                destData.data[destIndex + 2] = sourceData.data[srcIndex + 2]; // B
                destData.data[destIndex + 3] = sourceData.data[srcIndex + 3]; // A
            }
        }

        pixelCtx.putImageData(destData, 0, 0);

        // Step 3: Scale up if needed for export scale
        let finalCanvas = pixelCanvas;
        if (exportScale > 1) {
            finalCanvas = document.createElement('canvas');
            finalCanvas.width = actualWidth * exportScale;
            finalCanvas.height = actualHeight * exportScale;
            const finalCtx = finalCanvas.getContext('2d');

            // Disable image smoothing for crisp pixels
            finalCtx.imageSmoothingEnabled = false;
            finalCtx.mozImageSmoothingEnabled = false;
            finalCtx.webkitImageSmoothingEnabled = false;
            finalCtx.msImageSmoothingEnabled = false;

            // Scale up the pixel-perfect canvas
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

    handleKeyDown(e) {
        // Ctrl shortcuts - handle these first to prevent conflicts
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'c' || e.key === 'C') {
                this.copyShape();
                e.preventDefault();
                return;
            }
            if (e.key === 'v' || e.key === 'V') {
                this.pasteShape();
                e.preventDefault();
                return;
            }
            if (e.key === 'z' || e.key === 'Z') {
                this.undo();
                e.preventDefault();
                return;
            }
            if (e.key === 'y' || e.key === 'Y') {
                this.redo();
                e.preventDefault();
                return;
            }
            if (e.key === 's' || e.key === 'S') {
                this.save();
                e.preventDefault();
                return;
            }
        }

        // Tool selection
        if (e.key >= '1' && e.key <= '6') {
            const tools = ['line', 'rect', 'circle', 'oval', 'triangle', 'polygon'];
            this.selectTool(tools[parseInt(e.key) - 1]);
            e.preventDefault();
        }

        // Mode keys
        if (e.key === 'v' || e.key === 'V') {
            this.selectTool('select');
            e.preventDefault();
        }
        if (e.key === 'f' || e.key === 'F') {
            this.selectTool('fill');
            e.preventDefault();
        }

        // Direction locks
        if (e.key === 'h' || e.key === 'H') {
            this.lockDirection = this.lockDirection === 'horizontal' ? null : 'horizontal';
            e.preventDefault();
        }

        // Grid toggle
        if (e.key === 'g' || e.key === 'G') {
            this.showGrid = !this.showGrid;
            const toggleGrid = document.getElementById('toggle-grid');
            if (toggleGrid) {
                toggleGrid.textContent = this.showGrid ? 'Hide Grid' : 'Show Grid';
            }
            this.render();
            e.preventDefault();
        }

        // Outline toggle
        if (e.key === 'o' || e.key === 'O') {
            // Toggle outline for all selected shapes
            if (this.selectedShapes.length > 0) {
                const newOutlineState = !this.selectedShapes[0].outline;
                this.selectedShapes.forEach(shape => {
                    shape.outline = newOutlineState;
                });
                this.render();
            } else if (this.selectedShape) {
                this.selectedShape.outline = !this.selectedShape.outline;
                this.render();
            }
            e.preventDefault();
        }

        // Zen Mode toggle
        if (e.key === 'z' || e.key === 'Z') {
            // Only trigger if no modifiers are pressed (to avoid conflict with Ctrl+Z undo)
            if (!e.ctrlKey && !e.shiftKey && !e.altKey) {
                const zenButton = document.getElementById('view-zen-mode');
                if (zenButton) {
                    zenButton.click();
                }
                e.preventDefault();
            }
        }

        // Zoom controls
        if (e.key === '+' || e.key === '=') {
            this.zoomIn();
            e.preventDefault();
        }
        if (e.key === '-' || e.key === '_') {
            this.zoomOut();
            e.preventDefault();
        }
        if (e.key === '0') {
            this.zoomReset();
            e.preventDefault();
        }

        // Shape ordering
        if (e.key === ']') {
            this.bringToFront();
            e.preventDefault();
        }
        if (e.key === '[') {
            this.sendToBack();
            e.preventDefault();
        }

        // Boolean operations (Ctrl+Shift to avoid browser conflicts)
        if (e.ctrlKey && e.shiftKey && (e.key === 'U' || e.key === 'u')) {
            this.booleanUnion();
            e.preventDefault();
        }
        if (e.ctrlKey && e.shiftKey && (e.key === 'B' || e.key === 'b')) {
            this.booleanSubtract();
            e.preventDefault();
        }
        if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
            this.booleanIntersect();
            e.preventDefault();
        }
        if (e.ctrlKey && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
            this.convertToPolygon();
            e.preventDefault();
        }
        if (e.ctrlKey && e.shiftKey && (e.key === 'M' || e.key === 'm')) {
            this.unionNodes();
            e.preventDefault();
        }

        // Actions
        if (e.key === 'Escape') {
            this.currentPoints = [];
            this.selectedShape = null;
            this.selectedShapes = [];
            this.selectedPoint = null;
            this.selectedPoints = [];
            this.lockDirection = null;
            this.render();
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            this.deleteShape();
            e.preventDefault();
        }
    }

    render() {
        // Clear canvas with background color
        this.ctx.fillStyle = this.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid if enabled
        if (this.showGrid && this.gridCells > 0) {
            this.drawGrid();
        }

        // Draw all shapes
        this.shapes.forEach(shape => {
            const isSelected = this.selectedShapes.includes(shape);
            this.drawShape(shape, isSelected);
        });

        // Draw current shape being created
        if (this.currentPoints.length > 0) {
            this.drawPreview();
        }

        // Draw selection box if dragging
        if (this.selectionBox && this.dragMode === 'selection-box') {
            this.drawSelectionBox();
        }

        // Draw points for selected shape (only if single shape selected)
        if (this.showSelectionNodes && this.selectedShape && this.selectedShapes.length === 1 && this.currentTool === 'select') {
            this.drawPoints(this.selectedShape);
        }

        // Draw bounding box for multiple selected shapes
        if (this.showSelectionNodes && this.selectedShapes.length > 1 && this.currentTool === 'select') {
            this.drawMultiSelectionBox();
        }

        // Update previews only if something changed
        const shapeCountChanged = this.shapes.length !== this.lastShapeCount;
        const historyChanged = this.historyIndex !== this.lastHistoryIndex;
        const selectionChanged = this.selectedShapes.length !== this.lastSelectedShapeCount;

        if (shapeCountChanged || selectionChanged) {
            this.updateShapeOrderPreview();
            this.lastShapeCount = this.shapes.length;
            this.lastSelectedShapeCount = this.selectedShapes.length;
        }

        if (historyChanged) {
            this.updateHistoryPreview();
            this.lastHistoryIndex = this.historyIndex;
        }

        // Update preview panel
        this.updatePreview();
    }

    drawGrid() {
        const cellSize = this.getCellSize();
        if (cellSize === 0) return;

        this.ctx.strokeStyle = '#cccccc';
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.5;

        // Draw vertical lines
        for (let x = 0; x <= this.canvasWidth; x += cellSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * this.scale, 0);
            this.ctx.lineTo(x * this.scale, this.canvas.height);
            this.ctx.stroke();
        }

        // Draw horizontal lines
        for (let y = 0; y <= this.canvasHeight; y += cellSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y * this.scale);
            this.ctx.lineTo(this.canvas.width, y * this.scale);
            this.ctx.stroke();
        }

        this.ctx.globalAlpha = 1.0;
    }

    drawShape(shape, isSelectedOrCtx, scaleOverride) {
        // Handle both old signature (shape, isSelected) and new (shape, ctx, scale)
        let ctx = this.ctx;
        let scale = this.scale;
        let isSelected = false;

        if (typeof isSelectedOrCtx === 'object') {
            // New signature: (shape, ctx, scale)
            ctx = isSelectedOrCtx;
            scale = scaleOverride || 1;
        } else {
            // Old signature: (shape, isSelected)
            isSelected = isSelectedOrCtx || false;
        }

        const color = this.colors[shape.color];
        const lineWidth = shape.lineWidth || 1;
        const outline = shape.outline || false;
        const ditherPattern = shape.ditherPattern;

        if (ditherPattern !== undefined && ditherPattern !== null) {
            console.log('Drawing shape with dither:', shape.type, 'pattern:', ditherPattern);
        }

        const prevCtx = this.ctx;
        const prevScale = this.scale;
        this.ctx = ctx;
        this.scale = scale;

        switch (shape.type) {
            case 'line':
                this.drawLine(shape.points, color, lineWidth);
                break;
            case 'rect':
                this.drawRect(shape.points, color, lineWidth, outline, ditherPattern);
                break;
            case 'circle':
                this.drawCircle(shape.points, color, lineWidth, outline, ditherPattern);
                break;
            case 'oval':
                this.drawOval(shape.points, color, lineWidth, outline, ditherPattern);
                break;
            case 'triangle':
                this.drawTriangle(shape.points, color, lineWidth, outline, ditherPattern);
                break;
            case 'polygon':
                this.drawPolygon(shape.points, color, lineWidth, outline, ditherPattern);
                break;
            case 'fill':
                this.drawFill(shape.points[0], color, ditherPattern);
                break;
        }

        this.ctx = prevCtx;
        this.scale = prevScale;
    }

    drawFill(point, color, ditherPattern = undefined) {
        const cellSize = this.getCellSize();

        if (cellSize > 0) {
            // Grid mode - fill the grid cell
            const cx = Math.floor(point.x / cellSize);
            const cy = Math.floor(point.y / cellSize);
            const pixelX = cx * cellSize;
            const pixelY = cy * cellSize;
            const cellPixelSize = cellSize;

            if (ditherPattern !== undefined && ditherPattern !== null) {
                // Apply dither pattern pixel by pixel
                for (let py = 0; py < cellPixelSize; py++) {
                    for (let px = 0; px < cellPixelSize; px++) {
                        this.applyDitherPattern(pixelX + px, pixelY + py, color, ditherPattern);
                    }
                }
            } else {
                // Apply scale for rendering (scale = 1 during rasterization, > 1 during normal render)
                this.ctx.fillStyle = color;
                this.ctx.fillRect(pixelX * this.scale, pixelY * this.scale,
                                 cellPixelSize * this.scale, cellPixelSize * this.scale);
            }
        } else {
            // Regular mode - fill a small square
            const size = 4;
            const halfSize = 2;
            if (ditherPattern !== undefined && ditherPattern !== null) {
                for (let py = -halfSize; py < halfSize; py++) {
                    for (let px = -halfSize; px < halfSize; px++) {
                        this.applyDitherPattern(point.x + px, point.y + py, color, ditherPattern);
                    }
                }
            } else {
                this.ctx.fillStyle = color;
                this.ctx.fillRect((point.x - halfSize) * this.scale,
                                 (point.y - halfSize) * this.scale,
                                 size * this.scale, size * this.scale);
            }
        }
    }

    // Bresenham line algorithm for pixel-perfect lines with width support
    drawLine(points, color, lineWidth = 1, ditherPattern = undefined) {
        let x0 = Math.floor(points[0].x);
        let y0 = Math.floor(points[0].y);
        let x1 = Math.floor(points[1].x);
        let y1 = Math.floor(points[1].y);

        const cellSize = this.getCellSize();

        // Grid mode: draw line using grid cells
        if (this.gridCells > 0) {
            // Convert to grid cell coordinates
            const cx0 = Math.floor(x0 / cellSize);
            const cy0 = Math.floor(y0 / cellSize);
            const cx1 = Math.floor(x1 / cellSize);
            const cy1 = Math.floor(y1 / cellSize);

            // Bresenham on grid cells
            const dx = Math.abs(cx1 - cx0);
            const dy = Math.abs(cy1 - cy0);
            const sx = cx0 < cx1 ? 1 : -1;
            const sy = cy0 < cy1 ? 1 : -1;
            let err = dx - dy;
            let cx = cx0;
            let cy = cy0;

            const filledCells = new Set();

            while (true) {
                // Fill the current grid cell
                const cellKey = `${cx},${cy}`;
                if (!filledCells.has(cellKey)) {
                    filledCells.add(cellKey);
                    if (ditherPattern !== undefined && ditherPattern !== null) {
                        const pixelX = cx * cellSize;
                        const pixelY = cy * cellSize;
                        for (let py = 0; py < cellSize; py++) {
                            for (let px = 0; px < cellSize; px++) {
                                this.applyDitherPattern(pixelX + px, pixelY + py, color, ditherPattern);
                            }
                        }
                    } else {
                        this.ctx.fillStyle = color;
                        this.ctx.fillRect(cx * cellSize * this.scale, cy * cellSize * this.scale,
                                         cellSize * this.scale, cellSize * this.scale);
                    }
                }

                if (cx === cx1 && cy === cy1) break;
                const e2 = 2 * err;
                if (e2 > -dy) {
                    err -= dy;
                    cx += sx;
                }
                if (e2 < dx) {
                    err += dx;
                    cy += sy;
                }
            }
        } else {
            // Regular pixel mode
            const dx = Math.abs(x1 - x0);
            const dy = Math.abs(y1 - y0);
            const sx = x0 < x1 ? 1 : -1;
            const sy = y0 < y1 ? 1 : -1;
            let err = dx - dy;

            while (true) {
                // Draw thick line by drawing a circle of pixels at each point
                if (lineWidth === 1) {
                    if (ditherPattern !== undefined && ditherPattern !== null) {
                        this.applyDitherPattern(x0, y0, color, ditherPattern);
                    } else {
                        this.setPixel(x0, y0, color);
                    }
                } else {
                    // Draw a filled circle for thickness
                    const radius = Math.floor(lineWidth / 2);
                    for (let dy = -radius; dy <= radius; dy++) {
                        for (let dx = -radius; dx <= radius; dx++) {
                            // Circle equation
                            if (dx * dx + dy * dy <= radius * radius) {
                                if (ditherPattern !== undefined && ditherPattern !== null) {
                                    this.applyDitherPattern(x0 + dx, y0 + dy, color, ditherPattern);
                                } else {
                                    this.setPixel(x0 + dx, y0 + dy, color);
                                }
                            }
                        }
                    }
                }

                if (x0 === x1 && y0 === y1) break;
                const e2 = 2 * err;
                if (e2 > -dy) {
                    err -= dy;
                    x0 += sx;
                }
                if (e2 < dx) {
                    err += dx;
                    y0 += sy;
                }
            }
        }
    }

    drawRect(points, color, lineWidth = 1, outline = false, ditherPattern = undefined) {
        const x1 = Math.floor(Math.min(points[0].x, points[1].x));
        const y1 = Math.floor(Math.min(points[0].y, points[1].y));
        const x2 = Math.floor(Math.max(points[0].x, points[1].x));
        const y2 = Math.floor(Math.max(points[0].y, points[1].y));

        if (outline) {
            // Draw outline only - draw four lines
            this.drawLine([{x: x1, y: y1}, {x: x2, y: y1}], color, lineWidth);
            this.drawLine([{x: x2, y: y1}, {x: x2, y: y2}], color, lineWidth);
            this.drawLine([{x: x2, y: y2}, {x: x1, y: y2}], color, lineWidth);
            this.drawLine([{x: x1, y: y2}, {x: x1, y: y1}], color, lineWidth);
            return;
        }

        // Fill rectangle
        const cellSize = this.getCellSize();
        if (cellSize > 0) {
            // Fill grid cells for rectangle - optimized to draw each cell only once
            const startCellX = Math.floor(x1 / cellSize);
            const startCellY = Math.floor(y1 / cellSize);
            const endCellX = Math.floor(x2 / cellSize);
            const endCellY = Math.floor(y2 / cellSize);

            for (let cy = startCellY; cy <= endCellY; cy++) {
                for (let cx = startCellX; cx <= endCellX; cx++) {
                    if (ditherPattern !== undefined && ditherPattern !== null) {
                        const pixelX = cx * cellSize;
                        const pixelY = cy * cellSize;
                        for (let py = 0; py < cellSize; py++) {
                            for (let px = 0; px < cellSize; px++) {
                                this.applyDitherPattern(pixelX + px, pixelY + py, color, ditherPattern);
                            }
                        }
                    } else {
                        this.ctx.fillStyle = color;
                        this.ctx.fillRect(cx * cellSize * this.scale, cy * cellSize * this.scale,
                                         cellSize * this.scale, cellSize * this.scale);
                    }
                }
            }
        } else {
            for (let y = y1; y <= y2; y++) {
                for (let x = x1; x <= x2; x++) {
                    if (ditherPattern !== undefined && ditherPattern !== null) {
                        this.applyDitherPattern(x, y, color, ditherPattern);
                    } else {
                        this.setPixel(x, y, color);
                    }
                }
            }
        }
    }

    // Midpoint circle algorithm for pixel-perfect circles
    drawCircle(points, color, lineWidth = 1, outline = false, ditherPattern = undefined) {
        const cx = Math.floor(points[0].x);
        const cy = Math.floor(points[0].y);
        const dx = points[1].x - points[0].x;
        const dy = points[1].y - points[0].y;
        const radius = Math.floor(Math.sqrt(dx * dx + dy * dy));

        if (outline) {
            // Draw outline as the perimeter - scan and find edge pixels
            const cellSize = this.getCellSize();

            if (cellSize > 0) {
                // Grid mode - draw edge cells
                const filledCells = new Set();
                for (let y = -radius; y <= radius; y++) {
                    const width = Math.floor(Math.sqrt(radius * radius - y * y));

                    // Draw left and right edges for each row
                    for (let x = -width; x <= width; x++) {
                        const px = cx + x;
                        const py = cy + y;

                        // Check if this is an edge pixel (has an empty neighbor)
                        const isEdge = (x === -width || x === width ||
                                       Math.abs(x) === width - 1);

                        if (isEdge) {
                            const cellKey = `${Math.floor(px / cellSize)},${Math.floor(py / cellSize)}`;
                            if (!filledCells.has(cellKey)) {
                                filledCells.add(cellKey);
                                this.fillGridCell(px, py, color);
                            }
                        }
                    }
                }
            } else {
                // Draw perimeter pixels only - just left and right edges
                for (let y = -radius; y <= radius; y++) {
                    const width = Math.floor(Math.sqrt(radius * radius - y * y));
                    this.setPixel(cx - width, cy + y, color);
                    this.setPixel(cx + width, cy + y, color);
                }
            }
            return;
        }

        // Fill circle using scan line approach
        if (this.gridCells > 0) {
            const cellSize = this.getCellSize();
            const filledCells = new Set();
            for (let y = -radius; y <= radius; y++) {
                const width = Math.floor(Math.sqrt(radius * radius - y * y));
                for (let x = -width; x <= width; x++) {
                    const px = cx + x;
                    const py = cy + y;
                    const cellKey = `${Math.floor(px / cellSize)},${Math.floor(py / cellSize)}`;
                    if (!filledCells.has(cellKey)) {
                        filledCells.add(cellKey);
                        this.fillGridCell(px, py, color, ditherPattern);
                    }
                }
            }
        } else {
            for (let y = -radius; y <= radius; y++) {
                const width = Math.floor(Math.sqrt(radius * radius - y * y));
                for (let x = -width; x <= width; x++) {
                    if (ditherPattern !== undefined && ditherPattern !== null) {
                        this.applyDitherPattern(cx + x, cy + y, color, ditherPattern);
                    } else {
                        this.setPixel(cx + x, cy + y, color);
                    }
                }
            }
        }
    }

    drawOval(points, color, lineWidth = 1, outline = false, ditherPattern = undefined) {
        // Define oval by two corners (bounding box)
        const x1 = Math.floor(Math.min(points[0].x, points[1].x));
        const y1 = Math.floor(Math.min(points[0].y, points[1].y));
        const x2 = Math.floor(Math.max(points[0].x, points[1].x));
        const y2 = Math.floor(Math.max(points[0].y, points[1].y));

        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const rx = Math.abs(x2 - x1) / 2;
        const ry = Math.abs(y2 - y1) / 2;

        if (rx === 0 || ry === 0) return;

        if (outline) {
            // Draw outline as the perimeter - scan and find edge pixels
            const cellSize = this.getCellSize();

            if (cellSize > 0) {
                // Grid mode - draw edge cells
                const filledCells = new Set();

                for (let y = Math.floor(y1); y <= Math.ceil(y2); y++) {
                    const dy = (y - cy) / ry;
                    if (Math.abs(dy) <= 1) {
                        const width = rx * Math.sqrt(1 - dy * dy);
                        const xStart = Math.floor(cx - width);
                        const xEnd = Math.ceil(cx + width);

                        // Draw left and right edge pixels
                        for (let x = xStart; x <= xEnd; x++) {
                            const isEdge = (x === xStart || x === xEnd ||
                                          x === xStart + 1 || x === xEnd - 1);

                            if (isEdge) {
                                const cellKey = `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;
                                if (!filledCells.has(cellKey)) {
                                    filledCells.add(cellKey);
                                    this.fillGridCell(x, y, color);
                                }
                            }
                        }
                    }
                }
            } else {
                // Draw perimeter pixels only - just left and right edges
                for (let y = Math.floor(y1); y <= Math.ceil(y2); y++) {
                    const dy = (y - cy) / ry;
                    if (Math.abs(dy) <= 1) {
                        const width = rx * Math.sqrt(1 - dy * dy);
                        const xLeft = Math.floor(cx - width);
                        const xRight = Math.ceil(cx + width);
                        this.setPixel(xLeft, y, color);
                        this.setPixel(xRight, y, color);
                    }
                }
            }
            return;
        }

        // Fill oval using scan line approach
        if (this.gridCells > 0) {
            const cellSize = this.getCellSize();
            const filledCells = new Set();

            for (let y = Math.floor(y1); y <= Math.ceil(y2); y++) {
                const dy = (y - cy) / ry;
                if (Math.abs(dy) <= 1) {
                    const width = rx * Math.sqrt(1 - dy * dy);
                    const xStart = Math.floor(cx - width);
                    const xEnd = Math.ceil(cx + width);

                    for (let x = xStart; x <= xEnd; x++) {
                        const cellKey = `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;
                        if (!filledCells.has(cellKey)) {
                            filledCells.add(cellKey);
                            this.fillGridCell(x, y, color, ditherPattern);
                        }
                    }
                }
            }
        } else {
            for (let y = Math.floor(y1); y <= Math.ceil(y2); y++) {
                const dy = (y - cy) / ry;
                if (Math.abs(dy) <= 1) {
                    const width = rx * Math.sqrt(1 - dy * dy);
                    const xStart = Math.floor(cx - width);
                    const xEnd = Math.ceil(cx + width);

                    for (let x = xStart; x <= xEnd; x++) {
                        if (ditherPattern !== undefined && ditherPattern !== null) {
                            this.applyDitherPattern(x, y, color, ditherPattern);
                        } else {
                            this.setPixel(x, y, color);
                        }
                    }
                }
            }
        }
    }

    drawTriangle(points, color, lineWidth = 1, outline = false, ditherPattern = undefined) {
        if (outline) {
            // Draw outline - three lines
            this.drawLine([points[0], points[1]], color, lineWidth);
            this.drawLine([points[1], points[2]], color, lineWidth);
            this.drawLine([points[2], points[0]], color, lineWidth);
            return;
        }
        // Fill triangle using scanline algorithm
        this.fillPolygon([points[0], points[1], points[2]], color, lineWidth, ditherPattern);
    }

    drawPolygon(points, color, lineWidth = 1, outline = false, ditherPattern = undefined) {
        if (points.length < 3) return;

        if (outline) {
            // Draw outline - lines connecting all points
            for (let i = 0; i < points.length; i++) {
                const nextIndex = (i + 1) % points.length;
                this.drawLine([points[i], points[nextIndex]], color, lineWidth);
            }
            return;
        }

        this.fillPolygon(points, color, lineWidth, ditherPattern);
    }

    // Scanline polygon fill algorithm
    fillPolygon(points, color, lineWidth = 1, ditherPattern = undefined) {
        if (points.length < 3) return;

        // Find bounding box
        let minY = Math.floor(points[0].y);
        let maxY = Math.floor(points[0].y);
        let minX = Math.floor(points[0].x);
        let maxX = Math.floor(points[0].x);

        for (let i = 1; i < points.length; i++) {
            minY = Math.min(minY, Math.floor(points[i].y));
            maxY = Math.max(maxY, Math.floor(points[i].y));
            minX = Math.min(minX, Math.floor(points[i].x));
            maxX = Math.max(maxX, Math.floor(points[i].x));
        }

        // Scanline fill
        for (let y = minY; y <= maxY; y++) {
            const intersections = [];

            // Find intersections with polygon edges
            for (let i = 0; i < points.length; i++) {
                const j = (i + 1) % points.length;
                const y1 = points[i].y;
                const y2 = points[j].y;

                if ((y1 <= y && y < y2) || (y2 <= y && y < y1)) {
                    const x1 = points[i].x;
                    const x2 = points[j].x;
                    const x = x1 + (y - y1) * (x2 - x1) / (y2 - y1);
                    intersections.push(Math.floor(x));
                }
            }

            // Sort intersections
            intersections.sort((a, b) => a - b);

            // Fill between pairs
            for (let i = 0; i < intersections.length; i += 2) {
                if (i + 1 < intersections.length) {
                    if (this.gridCells > 0) {
                        // Fill grid cells across the scanline - optimized to fill each cell once
                        const cellSize = this.getCellSize();
                        const startCellX = Math.floor(intersections[i] / cellSize);
                        const endCellX = Math.floor(intersections[i + 1] / cellSize);
                        const cellY = Math.floor(y / cellSize);

                        for (let cx = startCellX; cx <= endCellX; cx++) {
                            if (ditherPattern !== undefined && ditherPattern !== null) {
                                const pixelX = cx * cellSize;
                                const pixelY = cellY * cellSize;
                                for (let py = 0; py < cellSize; py++) {
                                    for (let px = 0; px < cellSize; px++) {
                                        this.applyDitherPattern(pixelX + px, pixelY + py, color, ditherPattern);
                                    }
                                }
                            } else {
                                this.ctx.fillStyle = color;
                                this.ctx.fillRect(cx * cellSize * this.scale, cellY * cellSize * this.scale,
                                                cellSize * this.scale, cellSize * this.scale);
                            }
                        }
                    } else {
                        for (let x = intersections[i]; x <= intersections[i + 1]; x++) {
                            if (ditherPattern !== undefined && ditherPattern !== null) {
                                this.applyDitherPattern(x, y, color, ditherPattern);
                            } else {
                                this.setPixel(x, y, color);
                            }
                        }
                    }
                }
            }
        }
    }

    // Set a single pixel on the scaled canvas
    setPixel(x, y, color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x * this.scale, y * this.scale, this.scale, this.scale);
    }

    // Fill an entire grid cell at the given position
    fillGridCell(x, y, color, ditherPattern = undefined) {
        const cellSize = this.getCellSize();
        if (cellSize <= 0) {
            if (ditherPattern !== undefined && ditherPattern !== null) {
                this.applyDitherPattern(x, y, color, ditherPattern);
            } else {
                this.setPixel(x, y, color);
            }
            return;
        }

        // Find which grid cell this pixel belongs to
        const cellX = Math.floor(x / cellSize) * cellSize;
        const cellY = Math.floor(y / cellSize) * cellSize;

        // Apply dither pattern to the entire cell if requested
        if (ditherPattern !== undefined && ditherPattern !== null) {
            for (let py = 0; py < cellSize; py++) {
                for (let px = 0; px < cellSize; px++) {
                    this.applyDitherPattern(cellX + px, cellY + py, color, ditherPattern);
                }
            }
        } else {
            // Use direct canvas fillRect for entire cell - much faster than pixel-by-pixel
            this.ctx.fillStyle = color;
            this.ctx.fillRect(cellX * this.scale, cellY * this.scale, cellSize * this.scale, cellSize * this.scale);
        }
    }

    drawPreview() {
        // Draw preview shape without transparency to avoid gray pixels
        const color = this.colors[this.currentColor];
        const points = [...this.currentPoints, {x: this.mouseX, y: this.mouseY}];

        switch (this.currentTool) {
            case 'line':
                if (this.currentPoints.length === 1) {
                    this.drawLine(points, color, this.lineWidth);
                }
                break;
            case 'rect':
                if (this.currentPoints.length === 1) {
                    this.drawRect(points, color, this.lineWidth);
                }
                break;
            case 'circle':
                if (this.currentPoints.length === 1) {
                    this.drawCircle(points, color, this.lineWidth);
                }
                break;
            case 'oval':
                if (this.currentPoints.length === 1) {
                    this.drawOval(points, color, this.lineWidth);
                }
                break;
            case 'triangle':
                if (this.currentPoints.length === 2) {
                    this.drawTriangle(points, color, this.lineWidth);
                }
                break;
            case 'polygon':
                if (this.currentPoints.length >= 1) {
                    // Draw lines connecting points
                    for (let i = 0; i < this.currentPoints.length - 1; i++) {
                        this.drawLine([this.currentPoints[i], this.currentPoints[i + 1]], color, this.lineWidth);
                    }
                    // Draw line to mouse
                    if (this.currentPoints.length > 0) {
                        this.drawLine([this.currentPoints[this.currentPoints.length - 1], {x: this.mouseX, y: this.mouseY}], color, this.lineWidth);
                    }
                }
                break;
        }

        // Draw current points
        this.currentPoints.forEach(p => {
            this.drawPoint(p, '#00d9ff');
        });
    }

    drawPoints(shape) {
        shape.points.forEach(p => {
            // Check if point is in the multi-selection
            const isSelected = this.selectedPoints.includes(p);
            this.drawPoint(p, isSelected ? '#ff0000' : '#00d9ff');
        });
    }

    drawPoint(point, color) {
        this.ctx.save();
        this.ctx.scale(this.scale, this.scale);
        this.ctx.fillStyle = color;
        this.ctx.fillRect(point.x - 2, point.y - 2, 4, 4);
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(point.x - 2, point.y - 2, 4, 4);
        this.ctx.restore();
    }

    drawSelectionBox() {
        if (!this.selectionBox) return;

        const box = this.selectionBox;
        const minX = Math.min(box.x1, box.x2);
        const maxX = Math.max(box.x1, box.x2);
        const minY = Math.min(box.y1, box.y2);
        const maxY = Math.max(box.y1, box.y2);

        this.ctx.save();
        this.ctx.scale(this.scale, this.scale);

        // Draw dashed box
        this.ctx.strokeStyle = '#00d9ff';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([4, 4]);
        this.ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);

        // Fill with semi-transparent
        this.ctx.fillStyle = 'rgba(0, 217, 255, 0.1)';
        this.ctx.fillRect(minX, minY, maxX - minX, maxY - minY);

        this.ctx.setLineDash([]);
        this.ctx.restore();
    }

    drawMultiSelectionBox() {
        if (this.selectedShapes.length === 0) return;

        // Calculate bounding box of all selected shapes
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        this.selectedShapes.forEach(shape => {
            shape.points.forEach(p => {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            });
        });

        this.ctx.save();
        this.ctx.scale(this.scale, this.scale);

        // Draw dashed bounding box
        this.ctx.strokeStyle = '#00d9ff';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([6, 3]);
        this.ctx.strokeRect(minX - 5, minY - 5, maxX - minX + 10, maxY - minY + 10);

        this.ctx.setLineDash([]);
        this.ctx.restore();
    }

    updateShapeOrderPreview() {
        const listElement = document.getElementById('shapeOrderList');
        if (!listElement) return;

        // Don't update if currently editing a shape name
        if (this.isEditingShapeName) return;

        listElement.innerHTML = '';

        if (this.shapes.length === 0) {
            listElement.innerHTML = '<div style="text-align: center; color: #888; font-size: 11px; padding: 10px;">No shapes</div>';
            return;
        }

        // Add drop zone handlers to the list container for edge cases
        listElement.ondragover = (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        };

        listElement.ondrop = (e) => {
            e.preventDefault();
            if (this.draggedShapeIndex === null) return;

            // Check if dropped in empty space at top or bottom
            const listRect = listElement.getBoundingClientRect();
            const mouseY = e.clientY;

            // Since list is reversed, top = front (highest index), bottom = back (lowest index)
            // Increase detection zone to 40px for easier targeting
            if (mouseY < listRect.top + 40) {
                // Dropped at very top = move to front (end of array)
                this.reorderShape(this.draggedShapeIndex, this.shapes.length);
            } else if (mouseY > listRect.bottom - 40) {
                // Dropped at very bottom = move to back (start of array)
                this.reorderShape(this.draggedShapeIndex, 0);
            }
        };

        this.shapes.forEach((shape, index) => {
            const item = document.createElement('div');
            item.className = 'shape-order-item';

            // Check if this shape is selected
            if (this.selectedShapes.includes(shape)) {
                item.classList.add('selected');
            }

            // Create shape icon with color
            const icon = document.createElement('div');
            icon.className = 'shape-icon';
            icon.style.backgroundColor = this.colors[shape.color] || '#ffffff';

            // Add shape type letter to icon
            const typeChar = {
                'line': 'L',
                'rect': 'R',
                'circle': 'C',
                'oval': 'O',
                'triangle': 'T',
                'polygon': 'P',
                'fill': 'F'
            }[shape.type] || '?';
            icon.textContent = typeChar;

            // Determine text color for icon (black or white based on background)
            const bgColor = this.colors[shape.color] || '#ffffff';
            const rgb = this.hexToRgb(bgColor);
            const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
            icon.style.color = brightness > 128 ? '#000' : '#fff';

            // Create label
            const label = document.createElement('div');
            label.className = 'shape-label';
            const outlineText = shape.outline ? ' (outline)' : '';
            const defaultName = `${shape.type.charAt(0).toUpperCase() + shape.type.slice(1)}${outlineText}`;
            label.textContent = shape.name || defaultName;

            // Add double-click to rename
            label.addEventListener('dblclick', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.startRenameShape(shape, label, defaultName);
            });

            // Create z-index indicator
            const zIndex = document.createElement('div');
            zIndex.className = 'shape-z-index';
            zIndex.textContent = `#${index}`;

            // Assemble item
            item.appendChild(icon);
            item.appendChild(label);
            item.appendChild(zIndex);

            // Make item draggable
            item.draggable = true;
            item.dataset.shapeIndex = index;

            // Drag start
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', index);
                item.classList.add('dragging');
                this.draggedShapeIndex = index;
            });

            // Drag end
            item.addEventListener('dragend', (e) => {
                item.classList.remove('dragging');
                // Clean up any drag-over classes
                document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
                    el.classList.remove('drag-over-top', 'drag-over-bottom');
                });
                this.draggedShapeIndex = null;
            });

            // Drag over
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';

                if (this.draggedShapeIndex === null) return;

                // Remove previous drag-over classes
                document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
                    el.classList.remove('drag-over-top', 'drag-over-bottom');
                });

                // Determine if we should insert above or below
                // Note: List is reversed (column-reverse), so top = higher index, bottom = lower index
                const rect = item.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;
                const mouseY = e.clientY;

                if (mouseY < midpoint) {
                    // Top half - visually above means higher index (towards front)
                    item.classList.add('drag-over-top');
                } else {
                    // Bottom half - visually below means lower index (towards back)
                    item.classList.add('drag-over-bottom');
                }
            });

            // Drag leave
            item.addEventListener('dragleave', (e) => {
                item.classList.remove('drag-over-top', 'drag-over-bottom');
            });

            // Drop
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (this.draggedShapeIndex === null) return;

                const targetIndex = parseInt(item.dataset.shapeIndex);

                // Determine insertion index
                // List is reversed (column-reverse): top = high index (front), bottom = low index (back)
                const rect = item.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;
                const mouseY = e.clientY;

                let insertIndex;
                if (mouseY < midpoint) {
                    // Dropping above target (visually) = insert after target (higher index)
                    insertIndex = targetIndex + 1;
                } else {
                    // Dropping below target (visually) = insert at target position (same or lower index)
                    insertIndex = targetIndex;
                }

                // Reorder the shapes
                this.reorderShape(this.draggedShapeIndex, insertIndex);

                // Clean up
                item.classList.remove('drag-over-top', 'drag-over-bottom');
            });

            // Helper function to select shape
            const selectShape = (e) => {
                if (e.shiftKey) {
                    // Toggle selection with shift
                    const shapeIndex = this.selectedShapes.indexOf(shape);
                    if (shapeIndex > -1) {
                        this.selectedShapes.splice(shapeIndex, 1);
                        if (this.selectedShape === shape) {
                            this.selectedShape = this.selectedShapes[0] || null;
                        }
                    } else {
                        this.selectedShapes.push(shape);
                        this.selectedShape = shape;
                    }
                } else {
                    // Single selection
                    this.selectedShape = shape;
                    this.selectedShapes = [shape];
                }
                this.currentTool = 'select';
                document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
                document.getElementById('tool-select').classList.add('active');
                this.render();
                this.updateShapeOrderPreview();
            };

            // Add click handler to icon and z-index (not label, to allow double-click rename)
            icon.addEventListener('click', selectShape);
            zIndex.addEventListener('click', selectShape);

            // Add single click to label for selection
            label.addEventListener('click', selectShape);

            listElement.appendChild(item);
        });
    }

    reorderShape(fromIndex, toIndex) {
        // Validate indices
        if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= this.shapes.length) {
            return;
        }

        // Adjust toIndex if necessary
        if (toIndex < 0) toIndex = 0;
        if (toIndex > this.shapes.length) toIndex = this.shapes.length;

        // Remove shape from old position
        const [shape] = this.shapes.splice(fromIndex, 1);

        // Adjust insert index if we're moving forward
        let insertIndex = toIndex;
        if (fromIndex < toIndex) {
            insertIndex--;
        }

        // Insert at new position
        this.shapes.splice(insertIndex, 0, shape);

        // Re-render and update shape order preview
        this.render();
        this.updateShapeOrderPreview();
    }

    startRenameShape(shape, labelElement, defaultName) {
        // Prevent renaming if already editing
        if (this.isEditingShapeName) return;

        // Set editing flag
        this.isEditingShapeName = true;

        // Get modal elements
        const modal = document.getElementById('renameModal');
        const input = document.getElementById('renameInput');
        const okBtn = document.getElementById('renameOk');
        const cancelBtn = document.getElementById('renameCancel');

        // Set initial value
        input.value = shape.name || '';
        input.placeholder = defaultName;

        // Show modal
        modal.classList.add('show');

        // Focus and select
        setTimeout(() => {
            input.focus();
            input.select();
        }, 0);

        // Function to close modal
        const closeModal = (save) => {
            if (save) {
                const newName = input.value.trim();
                shape.name = newName || null; // null = use default name
            }

            // Hide modal
            modal.classList.remove('show');

            // Clear editing flag
            this.isEditingShapeName = false;

            // Rebuild the preview
            this.render();

            // Clean up event listeners
            okBtn.removeEventListener('click', okHandler);
            cancelBtn.removeEventListener('click', cancelHandler);
            input.removeEventListener('keydown', keyHandler);
            modal.removeEventListener('click', backdropHandler);
        };

        // Event handlers
        const okHandler = () => closeModal(true);
        const cancelHandler = () => closeModal(false);
        const keyHandler = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                closeModal(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeModal(false);
            }
        };
        const backdropHandler = (e) => {
            if (e.target === modal) {
                closeModal(false);
            }
        };

        // Attach event listeners
        okBtn.addEventListener('click', okHandler);
        cancelBtn.addEventListener('click', cancelHandler);
        input.addEventListener('keydown', keyHandler);
        modal.addEventListener('click', backdropHandler);
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    updateHistoryPreview() {
        const listElement = document.getElementById('historyList');
        if (!listElement) return;

        listElement.innerHTML = '';

        // Add "Blank canvas" entry at the beginning
        const blankItem = document.createElement('div');
        blankItem.className = 'history-item';
        if (this.historyIndex === -1) {
            blankItem.classList.add('current');
        }

        const blankIcon = document.createElement('div');
        blankIcon.className = 'history-icon';
        blankIcon.textContent = this.historyIndex === -1 ? '●' : '∅';

        const blankLabel = document.createElement('div');
        blankLabel.className = 'history-label';
        blankLabel.textContent = `Blank canvas (${this.canvasWidth}×${this.canvasHeight})`;

        blankItem.appendChild(blankIcon);
        blankItem.appendChild(blankLabel);
        blankItem.addEventListener('click', () => {
            this.jumpToHistory(-1);
        });
        listElement.appendChild(blankItem);

        if (this.history.length === 0) {
            return;
        }

        // Create history items (oldest to newest, top to bottom)
        this.history.forEach((state, index) => {
            const item = document.createElement('div');
            item.className = 'history-item';

            // Mark current state
            if (index === this.historyIndex) {
                item.classList.add('current');
            }

            // Create icon
            const icon = document.createElement('div');
            icon.className = 'history-icon';
            icon.textContent = index === this.historyIndex ? '●' : (index + 1);

            // Create label with shape count
            const label = document.createElement('div');
            label.className = 'history-label';
            const shapeCount = state.shapes ? state.shapes.length : state.length;
            const canvasW = state.canvasWidth || this.canvasWidth;
            const canvasH = state.canvasHeight || this.canvasHeight;

            // Determine action based on comparison with previous state
            let action = 'Initial';
            if (index > 0) {
                const prevCount = this.history[index - 1].shapes ? this.history[index - 1].shapes.length : this.history[index - 1].length;
                if (shapeCount > prevCount) {
                    action = 'Add shape';
                } else if (shapeCount < prevCount) {
                    action = 'Delete shape';
                } else {
                    action = 'Edit';
                }
            }

            label.textContent = `${action} (${shapeCount} shape${shapeCount !== 1 ? 's' : ''}, ${canvasW}×${canvasH})`;

            // Assemble item
            item.appendChild(icon);
            item.appendChild(label);

            // Add click handler to jump to this state
            item.addEventListener('click', () => {
                this.jumpToHistory(index);
            });

            listElement.appendChild(item);
        });

        // Auto-scroll to current item
        const currentItem = listElement.querySelector('.history-item.current');
        if (currentItem) {
            currentItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    jumpToHistory(targetIndex) {
        if (targetIndex < -1 || targetIndex >= this.history.length) return;
        if (targetIndex === this.historyIndex) return;

        // Set the history index
        this.historyIndex = targetIndex;

        // Restore the state
        if (targetIndex < 0) {
            this.shapes = [];
        } else {
            const state = this.history[targetIndex];
            this.shapes = JSON.parse(JSON.stringify(state.shapes));
            // Restore canvas dimensions if they were saved
            if (state.canvasWidth && state.canvasHeight) {
                this.canvasWidth = state.canvasWidth;
                this.canvasHeight = state.canvasHeight;
                this.canvas.width = this.canvasWidth * this.scale;
                this.canvas.height = this.canvasHeight * this.scale;
            }
        }

        // Clear selections
        this.selectedShape = null;
        this.selectedShapes = [];
        this.selectedPoint = null;

        // Re-render
        this.render();
    }
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the editor
    window.editor = new VectorEditor();

    // Tab switching functionality
    const tabs = document.querySelectorAll('.tab');
    console.log('Found tabs:', tabs.length);
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            console.log('Tab clicked:', tab.dataset.tab);
            const tabName = tab.dataset.tab;

            // Remove active from all tabs and tab contents
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));

            // Add active to clicked tab and corresponding content
            tab.classList.add('active');
            const targetContent = document.getElementById(`tab-${tabName}`);
            console.log('Target content:', targetContent);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });

    // Help modal functionality
    const helpBtn = document.getElementById('helpBtn');
    const helpModal = document.getElementById('helpModal');
    const helpClose = document.getElementById('helpClose');

    if (helpBtn) {
        helpBtn.addEventListener('click', () => {
            helpModal.classList.add('show');
        });
    }

    if (helpClose) {
        helpClose.addEventListener('click', () => {
            helpModal.classList.remove('show');
        });
    }

    if (helpModal) {
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) {
                helpModal.classList.remove('show');
            }
        });
    }

    // Dropdown menu functionality
    const dropdowns = document.querySelectorAll('.dropdown');
    console.log('Found dropdowns:', dropdowns.length);
    dropdowns.forEach(dropdown => {
        const btn = dropdown.querySelector('.dropdown-btn');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('Dropdown clicked');
                // Close other dropdowns
                dropdowns.forEach(d => {
                    if (d !== dropdown) d.classList.remove('open');
                });
                // Toggle this dropdown
                dropdown.classList.toggle('open');
            });
        }
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
        dropdowns.forEach(d => d.classList.remove('open'));
    });

    // Wire up menu buttons to existing functions
    const menuItems = {
        'menu-save': () => window.editor.save(),
        'menu-load': () => window.editor.load(),
        'menu-export-png': () => window.editor.showExportDialog('png'),
        'menu-export-jpg': () => window.editor.showExportDialog('jpg'),
        'menu-clear': () => window.editor.clear(),
        'menu-undo': () => window.editor.undo(),
        'menu-redo': () => window.editor.redo(),
        'menu-copy': () => window.editor.copyShape(),
        'menu-paste': () => window.editor.pasteShape(),
        'menu-delete': () => window.editor.deleteShape()
    };

    Object.keys(menuItems).forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                menuItems[id]();
                dropdowns.forEach(d => d.classList.remove('open'));
            });
        }
    });

    // View menu functionality
    const viewState = {
        leftPanel: true,
        colorPalette: true,
        shapesPanel: true,
        previewPanel: true,
        timelinePanel: true
    };

    const toggleView = (panelId, selector, label) => {
        const panel = document.querySelector(selector);
        const btn = document.getElementById(panelId);
        if (!panel || !btn) return;

        const isVisible = panel.style.display !== 'none';
        panel.style.display = isVisible ? 'none' : '';

        // Update button text
        btn.textContent = isVisible ? `✗ ${label}` : `✓ ${label}`;
    };

    // View toggle buttons
    document.getElementById('view-left-panel')?.addEventListener('click', () => {
        toggleView('view-left-panel', '.left-panel', 'Left Toolbar');
    });

    document.getElementById('view-color-palette')?.addEventListener('click', () => {
        toggleView('view-color-palette', '.panel-box:has(#colorPalette)', 'Color Palette');
    });

    document.getElementById('view-shapes-panel')?.addEventListener('click', () => {
        toggleView('view-shapes-panel', '.panel-box:has(.tabs)', 'Shapes/History');
    });

    document.getElementById('view-preview-panel')?.addEventListener('click', () => {
        toggleView('view-preview-panel', '.preview-panel', 'Preview');
    });

    document.getElementById('view-timeline-panel')?.addEventListener('click', () => {
        toggleView('view-timeline-panel', '.timeline-panel', 'Timeline');
    });

    // Toggle Grid
    document.getElementById('view-toggle-grid')?.addEventListener('click', () => {
        window.editor.showGrid = !window.editor.showGrid;
        const toggleGrid = document.getElementById('toggle-grid');
        if (toggleGrid) {
            toggleGrid.textContent = window.editor.showGrid ? 'Hide Grid' : 'Show Grid';
        }
        window.editor.render();
    });

    // Toggle Outline
    document.getElementById('view-toggle-outline')?.addEventListener('click', () => {
        // Toggle outline for all selected shapes
        if (window.editor.selectedShapes.length > 0) {
            const newOutlineState = !window.editor.selectedShapes[0].outline;
            window.editor.selectedShapes.forEach(shape => {
                shape.outline = newOutlineState;
            });
            window.editor.render();
        } else if (window.editor.selectedShape) {
            window.editor.selectedShape.outline = !window.editor.selectedShape.outline;
            window.editor.render();
        }
    });

    // Zen mode - hide all panels
    document.getElementById('view-zen-mode')?.addEventListener('click', () => {
        const allHidden = document.querySelector('.left-panel').style.display === 'none';

        if (allHidden) {
            // Restore all panels
            document.querySelector('.left-panel').style.display = '';
            document.querySelector('.panel-box:has(#colorPalette)').style.display = '';
            document.querySelector('.panel-box:has(.tabs)').style.display = '';
            document.querySelector('.preview-panel').style.display = '';
            document.querySelector('.timeline-panel').style.display = '';

            document.getElementById('view-left-panel').textContent = '✓ Left Toolbar';
            document.getElementById('view-color-palette').textContent = '✓ Color Palette';
            document.getElementById('view-shapes-panel').textContent = '✓ Shapes/History';
            document.getElementById('view-preview-panel').textContent = '✓ Preview';
            document.getElementById('view-timeline-panel').textContent = '✓ Timeline';

            viewState.leftPanel = true;
            viewState.colorPalette = true;
            viewState.shapesPanel = true;
            viewState.previewPanel = true;
            viewState.timelinePanel = true;
        } else {
            // Hide all panels
            document.querySelector('.left-panel').style.display = 'none';
            document.querySelector('.panel-box:has(#colorPalette)').style.display = 'none';
            document.querySelector('.panel-box:has(.tabs)').style.display = 'none';
            document.querySelector('.preview-panel').style.display = 'none';
            document.querySelector('.timeline-panel').style.display = 'none';

            document.getElementById('view-left-panel').textContent = '✗ Left Toolbar';
            document.getElementById('view-color-palette').textContent = '✗ Color Palette';
            document.getElementById('view-shapes-panel').textContent = '✗ Shapes/History';
            document.getElementById('view-preview-panel').textContent = '✗ Preview';
            document.getElementById('view-timeline-panel').textContent = '✗ Timeline';

            viewState.leftPanel = false;
            viewState.colorPalette = false;
            viewState.shapesPanel = false;
            viewState.previewPanel = false;
            viewState.timelinePanel = false;
        }
    });

    // Canvas Ratio
    const updateRatioUI = () => {
        ['1-1', '16-9', '4-3', '3-2'].forEach(ratio => {
            const btn = document.getElementById(`canvas-ratio-${ratio}`);
            if (btn) {
                const currentRatio = window.editor.aspectRatio.replace(':', '-');
                btn.textContent = ratio === currentRatio ? `● ${ratio.replace('-', ':')} ${ratio === '1-1' ? '(Square)' : ''}` : ratio.replace('-', ':');
            }
        });
    };

    document.getElementById('canvas-ratio-1-1')?.addEventListener('click', () => {
        window.editor.aspectRatio = '1:1';
        window.editor.updateCanvasDimensions();
        updateRatioUI();
    });

    document.getElementById('canvas-ratio-16-9')?.addEventListener('click', () => {
        window.editor.aspectRatio = '16:9';
        window.editor.updateCanvasDimensions();
        updateRatioUI();
    });

    document.getElementById('canvas-ratio-4-3')?.addEventListener('click', () => {
        window.editor.aspectRatio = '4:3';
        window.editor.updateCanvasDimensions();
        updateRatioUI();
    });

    document.getElementById('canvas-ratio-3-2')?.addEventListener('click', () => {
        window.editor.aspectRatio = '3:2';
        window.editor.updateCanvasDimensions();
        updateRatioUI();
    });

    // Canvas Orientation
    const updateOrientationUI = () => {
        const landscapeBtn = document.getElementById('canvas-orientation-landscape');
        const portraitBtn = document.getElementById('canvas-orientation-portrait');
        if (landscapeBtn) landscapeBtn.textContent = window.editor.orientation === 'landscape' ? '● Landscape' : 'Landscape';
        if (portraitBtn) portraitBtn.textContent = window.editor.orientation === 'portrait' ? '● Portrait' : 'Portrait';
    };

    document.getElementById('canvas-orientation-landscape')?.addEventListener('click', () => {
        window.editor.orientation = 'landscape';
        window.editor.updateCanvasDimensions();
        updateOrientationUI();
    });

    document.getElementById('canvas-orientation-portrait')?.addEventListener('click', () => {
        window.editor.orientation = 'portrait';
        window.editor.updateCanvasDimensions();
        updateOrientationUI();
    });

    // Grid Size
    const updateGridUI = () => {
        ['off', '8', '16', '32', '64'].forEach(size => {
            const btn = document.getElementById(`canvas-grid-${size}`);
            if (btn) {
                const currentGrid = size === 'off' ? 0 : parseInt(size);
                const isActive = window.editor.gridCells === currentGrid;
                btn.textContent = isActive ? `● ${size === 'off' ? 'Off' : size + '×' + size}` : (size === 'off' ? 'Off' : size + '×' + size);
            }
        });
    };

    document.getElementById('canvas-grid-off')?.addEventListener('click', () => {
        window.editor.gridCells = 0;
        window.editor.render();
        updateGridUI();
    });

    document.getElementById('canvas-grid-8')?.addEventListener('click', () => {
        window.editor.gridCells = 8;
        window.editor.render();
        updateGridUI();
    });

    document.getElementById('canvas-grid-16')?.addEventListener('click', () => {
        window.editor.gridCells = 16;
        window.editor.render();
        updateGridUI();
    });

    document.getElementById('canvas-grid-32')?.addEventListener('click', () => {
        window.editor.gridCells = 32;
        window.editor.render();
        updateGridUI();
    });

    document.getElementById('canvas-grid-64')?.addEventListener('click', () => {
        window.editor.gridCells = 64;
        window.editor.render();
        updateGridUI();
    });

    // Initialize UI
    updateRatioUI();
    updateOrientationUI();
    updateGridUI();

    // Preview mode buttons
    document.getElementById('preview-actual')?.addEventListener('click', function() {
        document.getElementById('preview-actual').classList.add('active');
        document.getElementById('preview-repeat').classList.remove('active');
        window.editor.previewMode = 'actual';
        window.editor.updatePreview();
    });

    document.getElementById('preview-repeat')?.addEventListener('click', function() {
        document.getElementById('preview-repeat').classList.add('active');
        document.getElementById('preview-actual').classList.remove('active');
        window.editor.previewMode = 'repeat';
        window.editor.updatePreview();
    });

    // Close all dropdowns when clicking outside
    document.addEventListener('click', () => {
        dropdowns.forEach(d => d.classList.remove('open'));
    });
});
