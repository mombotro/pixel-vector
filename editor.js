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

        // TIC-80 color palette
        this.colors = [
            '#1a1c2c', '#5d275d', '#b13e53', '#ef7d57',
            '#ffcd75', '#a7f070', '#38b764', '#257179',
            '#29366f', '#3b5dc9', '#41a6f6', '#73eff7',
            '#f4f4f4', '#94b0c2', '#566c86', '#333c57'
        ];

        // State
        this.currentColor = 0;
        this.currentTool = 'line';
        this.lineWidth = 1; // Current line width in pixels
        this.shapes = [];
        this.currentPoints = [];
        this.selectedShape = null;
        this.selectedShapes = []; // Multiple selected shapes
        this.selectedPoint = null;
        this.copiedShape = null;
        this.copiedShapes = []; // Multiple copied shapes
        this.isDragging = false;
        this.dragMode = null; // 'point', 'shape', or 'selection-box'
        this.lockDirection = null; // 'horizontal', 'vertical', or null
        this.selectionBox = null; // {x1, y1, x2, y2} for drag selection

        // Grid settings
        this.gridCells = 32; // 0 = off, 8 = 8x8 cells, 16 = 16x16 cells, etc.
        this.showGrid = false;

        // Canvas settings
        this.aspectRatio = '1:1';  // Current aspect ratio
        this.orientation = 'landscape';  // 'landscape' or 'portrait'
        this.baseSize = 240;  // Base size for calculations
        this.canvasWidth = 240;  // Logical canvas width
        this.canvasHeight = 240; // Logical canvas height

        // Mouse state
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseDown = false;

        this.init();
    }

    init() {
        this.setupColorPalette();
        this.setupEventListeners();
        this.updateCanvasDimensions();
        this.render();
    }

    setupColorPalette() {
        const palette = document.getElementById('colorPalette');
        this.colors.forEach((color, index) => {
            const btn = document.createElement('div');
            btn.className = 'color-btn';
            btn.style.backgroundColor = color;
            if (index === 0) btn.classList.add('selected');
            btn.addEventListener('click', () => this.selectColor(index));
            palette.appendChild(btn);
        });
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

        // Action buttons
        document.getElementById('tool-copy').addEventListener('click', () => this.copyShape());
        document.getElementById('tool-paste').addEventListener('click', () => this.pasteShape());
        document.getElementById('tool-delete').addEventListener('click', () => this.deleteShape());
        document.getElementById('tool-undo').addEventListener('click', () => this.undo());
        document.getElementById('tool-clear').addEventListener('click', () => this.clear());
        document.getElementById('tool-save').addEventListener('click', () => this.save());
        document.getElementById('tool-load').addEventListener('click', () => this.load());

        // Grid dropdown
        document.getElementById('grid-size').addEventListener('change', (e) => {
            this.gridCells = parseInt(e.target.value);
            this.render();
        });

        document.getElementById('toggle-grid').addEventListener('click', () => {
            this.showGrid = !this.showGrid;
            document.getElementById('toggle-grid').textContent = this.showGrid ? 'Hide Grid' : 'Show Grid';
            this.render();
        });

        document.getElementById('toggle-outline').addEventListener('click', () => {
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

        // Aspect ratio dropdown
        document.getElementById('aspect-ratio').addEventListener('change', (e) => {
            this.aspectRatio = e.target.value;
            this.updateCanvasDimensions();
        });

        // Orientation buttons
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

        // Zoom controls
        document.getElementById('zoom-in').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoom-out').addEventListener('click', () => this.zoomOut());
        document.getElementById('zoom-reset').addEventListener('click', () => this.zoomReset());

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

    updateCanvasScale() {
        this.canvas.width = this.canvasWidth * this.scale;
        this.canvas.height = this.canvasHeight * this.scale;
        document.getElementById('zoom-level').textContent = `${Math.round(this.scale * 50)}%`;
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
        } else if (this.selectedShape) {
            this.selectedShape.color = index;
            this.render();
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

        this.mouseDown = false;
        this.isDragging = false;
        this.dragMode = null;
    }

    handleLeftClick(pos, shiftKey = false) {
        if (this.currentTool === 'select') {
            // Try to select a node first (higher priority) - only if single shape selected
            if (this.selectedShapes.length <= 1 && this.trySelectNode(pos)) {
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
    }

    trySelectNode(pos) {
        // Find closest point within threshold
        let closestDist = Infinity;
        let closestPoint = null;
        let closestShape = null;

        for (const shape of this.shapes) {
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
            this.selectedPoint = closestPoint;
            this.selectedShape = closestShape;
            this.isDragging = true;
            this.dragMode = 'point';
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
            points: [...this.currentPoints]
        };

        this.shapes.push(shape);
        this.selectedShape = shape;
        this.currentPoints = [];
        this.render();
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
            this.render();
        } else if (this.shapes.length > 0) {
            // Delete last shape if none selected
            this.shapes.pop();
            this.render();
        }
    }

    undo() {
        if (this.shapes.length > 0) {
            this.shapes.pop();
            this.selectedShape = null;
            this.selectedPoint = null;
            this.render();
        }
    }

    clear() {
        if (confirm('Clear all shapes?')) {
            this.shapes = [];
            this.currentPoints = [];
            this.selectedShape = null;
            this.selectedPoint = null;
            this.render();
        }
    }

    save() {
        const data = {
            canvasWidth: this.canvasWidth,
            canvasHeight: this.canvasHeight,
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

    handleKeyDown(e) {
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
            document.getElementById('toggle-grid').textContent = this.showGrid ? 'Hide Grid' : 'Show Grid';
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

        // Actions
        if (e.key === 'Escape') {
            this.currentPoints = [];
            this.selectedShape = null;
            this.selectedPoint = null;
            this.lockDirection = null;
            this.render();
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            this.deleteShape();
            e.preventDefault();
        }

        // Ctrl shortcuts
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'c' || e.key === 'C') {
                this.copyShape();
                e.preventDefault();
            }
            if (e.key === 'v' || e.key === 'V') {
                this.pasteShape();
                e.preventDefault();
            }
            if (e.key === 'z' || e.key === 'Z') {
                this.undo();
                e.preventDefault();
            }
            if (e.key === 's' || e.key === 'S') {
                this.save();
                e.preventDefault();
            }
        }
    }

    render() {
        // Clear canvas
        this.ctx.fillStyle = '#e8e8e8';
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
        if (this.selectedShape && this.selectedShapes.length === 1 && this.currentTool === 'select') {
            this.drawPoints(this.selectedShape);
        }

        // Draw bounding box for multiple selected shapes
        if (this.selectedShapes.length > 1 && this.currentTool === 'select') {
            this.drawMultiSelectionBox();
        }
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

    drawShape(shape, isSelected) {
        const color = this.colors[shape.color];
        const lineWidth = shape.lineWidth || 1; // Default to 1 for old shapes
        const outline = shape.outline || false; // Default to filled for old shapes

        switch (shape.type) {
            case 'line':
                this.drawLine(shape.points, color, lineWidth);
                break;
            case 'rect':
                this.drawRect(shape.points, color, lineWidth, outline);
                break;
            case 'circle':
                this.drawCircle(shape.points, color, lineWidth, outline);
                break;
            case 'oval':
                this.drawOval(shape.points, color, lineWidth, outline);
                break;
            case 'triangle':
                this.drawTriangle(shape.points, color, lineWidth, outline);
                break;
            case 'polygon':
                this.drawPolygon(shape.points, color, lineWidth, outline);
                break;
            case 'fill':
                this.drawFill(shape.points[0], color);
                break;
        }
    }

    drawFill(point, color) {
        const cellSize = this.getCellSize();

        if (cellSize > 0) {
            // Grid mode - fill the grid cell
            const cx = Math.floor(point.x / cellSize);
            const cy = Math.floor(point.y / cellSize);
            this.ctx.fillStyle = color;
            this.ctx.fillRect(cx * cellSize * this.scale, cy * cellSize * this.scale,
                             cellSize * this.scale, cellSize * this.scale);
        } else {
            // Regular mode - fill a small square
            this.ctx.fillStyle = color;
            this.ctx.fillRect(point.x * this.scale - 2 * this.scale,
                             point.y * this.scale - 2 * this.scale,
                             4 * this.scale, 4 * this.scale);
        }
    }

    // Bresenham line algorithm for pixel-perfect lines with width support
    drawLine(points, color, lineWidth = 1) {
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
                    this.ctx.fillStyle = color;
                    this.ctx.fillRect(cx * cellSize * this.scale, cy * cellSize * this.scale,
                                     cellSize * this.scale, cellSize * this.scale);
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
                    this.setPixel(x0, y0, color);
                } else {
                    // Draw a filled circle for thickness
                    const radius = Math.floor(lineWidth / 2);
                    for (let dy = -radius; dy <= radius; dy++) {
                        for (let dx = -radius; dx <= radius; dx++) {
                            // Circle equation
                            if (dx * dx + dy * dy <= radius * radius) {
                                this.setPixel(x0 + dx, y0 + dy, color);
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

    drawRect(points, color, lineWidth = 1, outline = false) {
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
                    this.ctx.fillStyle = color;
                    this.ctx.fillRect(cx * cellSize * this.scale, cy * cellSize * this.scale,
                                     cellSize * this.scale, cellSize * this.scale);
                }
            }
        } else {
            for (let y = y1; y <= y2; y++) {
                for (let x = x1; x <= x2; x++) {
                    this.setPixel(x, y, color);
                }
            }
        }
    }

    // Midpoint circle algorithm for pixel-perfect circles
    drawCircle(points, color, lineWidth = 1, outline = false) {
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
                        this.fillGridCell(px, py, color);
                    }
                }
            }
        } else {
            for (let y = -radius; y <= radius; y++) {
                const width = Math.floor(Math.sqrt(radius * radius - y * y));
                for (let x = -width; x <= width; x++) {
                    this.setPixel(cx + x, cy + y, color);
                }
            }
        }
    }

    drawOval(points, color, lineWidth = 1, outline = false) {
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
                            this.fillGridCell(x, y, color);
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
                        this.setPixel(x, y, color);
                    }
                }
            }
        }
    }

    drawTriangle(points, color, lineWidth = 1, outline = false) {
        if (outline) {
            // Draw outline - three lines
            this.drawLine([points[0], points[1]], color, lineWidth);
            this.drawLine([points[1], points[2]], color, lineWidth);
            this.drawLine([points[2], points[0]], color, lineWidth);
            return;
        }
        // Fill triangle using scanline algorithm
        this.fillPolygon([points[0], points[1], points[2]], color, lineWidth);
    }

    drawPolygon(points, color, lineWidth = 1, outline = false) {
        if (points.length < 3) return;

        if (outline) {
            // Draw outline - lines connecting all points
            for (let i = 0; i < points.length; i++) {
                const nextIndex = (i + 1) % points.length;
                this.drawLine([points[i], points[nextIndex]], color, lineWidth);
            }
            return;
        }

        this.fillPolygon(points, color, lineWidth);
    }

    // Scanline polygon fill algorithm
    fillPolygon(points, color, lineWidth = 1) {
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
                            this.ctx.fillStyle = color;
                            this.ctx.fillRect(cx * cellSize * this.scale, cellY * cellSize * this.scale,
                                            cellSize * this.scale, cellSize * this.scale);
                        }
                    } else {
                        for (let x = intersections[i]; x <= intersections[i + 1]; x++) {
                            this.setPixel(x, y, color);
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
    fillGridCell(x, y, color) {
        const cellSize = this.getCellSize();
        if (cellSize <= 0) {
            this.setPixel(x, y, color);
            return;
        }

        // Find which grid cell this pixel belongs to
        const cellX = Math.floor(x / cellSize) * cellSize;
        const cellY = Math.floor(y / cellSize) * cellSize;

        // Use direct canvas fillRect for entire cell - much faster than pixel-by-pixel
        this.ctx.fillStyle = color;
        this.ctx.fillRect(cellX * this.scale, cellY * this.scale, cellSize * this.scale, cellSize * this.scale);
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
            const isSelected = p === this.selectedPoint;
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
}

// Initialize the editor
const editor = new VectorEditor();
