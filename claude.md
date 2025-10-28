# Vexel Edit - Development Notes

## Project Overview
Vexel Edit is a vector pixel art editor that allows users to create pixel-perfect artwork using vector shapes that snap to a grid. It combines the precision of vector graphics with the aesthetic of pixel art.

## Key Features

### Canvas & Grid System
- **Grid Modes**: Off, 8×8, 16×16, 32×32, 64×64
- **Aspect Ratios**: 1:1, 16:9, 4:3, 3:2
- **Orientations**: Landscape, Portrait
- Canvas renders shapes at a scaled-up size for editing, but exports at actual pixel resolution

### Drawing Tools
- **Line**: Bresenham algorithm for pixel-perfect lines
- **Rectangle**: Filled and outline modes
- **Circle**: Pixel-perfect circles using midpoint algorithm
- **Oval**: Ellipse rendering
- **Triangle**: 3-point polygon
- **Polygon**: Multi-point shapes with node editing
- **Fill**: Flood fill tool
- **Select**: Node editing, multi-selection, shape manipulation

### Shape Operations
- **Boolean Operations**: Union, Subtract, Intersect (Ctrl+Shift+U/B/I)
- **Convert to Polygon**: Convert any shape to editable polygon (Ctrl+Shift+P)
- **Node Merging**: Merge multiple selected nodes (Ctrl+Shift+M)
- **Shape Ordering**: Bring to front/back with ] and [ keys

### Dither Patterns
- 19 built-in dither patterns (from solid to sparse)
- Patterns are 8×8 repeating tiles
- Scale control (1-16x) for pattern size
- Invert option to flip pattern (on pixels become off, vice versa)
- Applied per-shape basis
- Works with all shape types including lines

### Color System
- 32-color palette based on Lospec palettes
- Color picker for each palette slot
- Background color selection
- Named palette support

### History & Undo
- Undo: Ctrl+Z
- Redo: Ctrl+Y
- 50-step history
- Tracks shape modifications, additions, deletions
- Only saves history when shapes actually change (not on selection)

### Export System

#### Single Frame Export (PNG/JPG)
1. **Render to temp canvas**: Re-renders all shapes at current display size
2. **Nearest-neighbor downsampling**: Pixel-perfect scaling to grid resolution
3. **Scale up (optional)**: Multiply by export scale for larger outputs

**Export Dialog Options:**
- **Scale**: 1-16x multiplier for final size
- **Transparency** (PNG only): Strips background, exports shapes only
- **Format**: PNG (with transparency) or JPG (opaque)

#### Animation Export

**GIF Export:**
- Exports all frames as animated GIF
- Respects FPS setting and frame hold values
- Auto-detects environment:
  - **Local files (file://)**: Uses main thread encoding (no CORS issues)
  - **Server (https://)**: Uses web workers for better performance
- Frame delay calculated as: `(1000 / fps) × hold`
- Infinite loop by default
- Uses gif.js library from CDN

**Spritesheet Export:**
- Exports all frames arranged in a grid
- Scale support (1-16x) like PNG export
- Automatic grid layout (square-ish arrangement)
- Grid dimensions included in filename (e.g., `spritesheet-3x2.png`)
- Transparent background between frames
- Pixel-perfect nearest-neighbor scaling

#### Important Export Implementation Details
```javascript
// Nearest-neighbor downsampling algorithm
for (let y = 0; y < actualHeight; y++) {
    for (let x = 0; x < actualWidth; x++) {
        // Sample from center of source grid cell
        const srcX = Math.floor((x + 0.5) * scaleX);
        const srcY = Math.floor((y + 0.5) * scaleY);
        // Copy exact pixel RGBA values
    }
}
```

### Preview Panel
- **1:1 Mode**: Shows actual pixel-perfect size
- **Repeat Mode**: Tiles the artwork to show patterns
- Real-time preview of what export will look like

### Animation Timeline
- **Frame-based animation system** with full playback controls
- **Playback modes**: Loop, Bounce, Once
- **FPS control**: 1-60 frames per second
- **Frame management**: Add, delete, duplicate frames
- **Frame names**: Editable names for each frame (e.g., "Idle", "Jump")
- **Frame holds**: Hold frames for multiple ticks (1-60), multiplies frame duration
- **Onion skinning**:
  - Shows previous frames (red tint) and next frames (green tint)
  - Adjustable: 1-5 frames before/after
  - Adjustable opacity: 10-90%
  - Fading opacity based on distance from current frame
- **Frame thumbnails**:
  - Vertical layout with 64×64 previews
  - Shows frame name and hold value
  - Click to switch frames (disabled during playback)
  - Drag-and-drop to reorder frames
  - Visual feedback during drag (colored borders)
- **Auto-save**: Shapes automatically saved to current frame on any edit

### Shape Order Preview
- Visual list of all shapes in layer order
- Click to select shapes
- Drag to reorder layers
- Shows shape type and color

## Code Architecture

### File Structure
- `index.html`: UI layout, panels, menus, modals
- `editor.js`: Main PixelVectorEditor class with all functionality
- `dither_patterns_3x-1.png`: Dither pattern reference (not loaded due to CORS - patterns generated in code)

### Key Classes & Systems

#### PixelVectorEditor Class
Main editor singleton with properties:

**Canvas & Drawing:**
- `canvas`, `ctx`: Main drawing surface
- `shapes`: Array of shape objects for current frame
- `backgroundColor`: Canvas background color
- `scale`: Display scale multiplier
- `gridCells`: Current grid size (0 = off)

**History System:**
- `history`, `historyIndex`: Undo/redo system

**Dither System:**
- `ditherPatterns`: Array of 8×8 ImageData patterns
- `ditherScale`: Dither pattern scale multiplier (1-16)
- `invertDither`: Boolean to invert dither patterns

**Animation System:**
- `frames`: Array of frame objects `{ shapes: [], name: '', hold: 1 }`
- `currentFrame`: Current frame index
- `fps`: Frames per second (1-60)
- `isPlaying`: Boolean playback state
- `animationTimer`: setInterval timer reference
- `loopMode`: 'loop', 'bounce', or 'once'
- `bounceDirection`: 1 or -1 for bounce mode
- `frameHoldCounter`: Counter for frame hold duration

**Onion Skinning:**
- `onionSkinEnabled`: Boolean toggle
- `onionSkinFrames`: Number of frames to show (1-5)
- `onionSkinOpacity`: Base opacity percentage (10-90)

#### Shape Object Structure
```javascript
{
    type: 'line'|'rect'|'circle'|'oval'|'triangle'|'polygon'|'fill',
    points: [{x, y}, ...],
    color: 0-31, // palette index
    lineWidth: 1,
    outline: true|false,
    ditherPattern: 0-18, // optional
    invertDither: true|false // optional, inverts dither pattern
}
```

#### Frame Object Structure
```javascript
{
    shapes: [...], // Array of shape objects
    name: 'Frame 1', // Editable frame name
    hold: 1 // Frame hold duration (1-60)
}
```

### Drawing Functions

All drawing functions follow this signature:
```javascript
drawShape(points, color, lineWidth, outline, ditherPattern)
```

Key drawing implementations:
- **Grid mode**: Draws using `fillGridCell()` which fills entire grid cells
- **Non-grid mode**: Draws pixel-by-pixel using `setPixel()`
- **Dither support**: `applyDitherPattern()` checks pattern and only draws "on" pixels

### Critical Functions

#### `getCellSize()`
Calculates grid cell size based on canvas dimensions and grid setting.

#### `render()`
Main render loop that:
1. Fills background
2. Draws grid (if enabled)
3. Draws onion skin frames (if enabled) with red/green tints
4. Draws all shapes in current frame
5. Draws preview shape (currently being drawn)
6. Draws selection UI (if `showSelectionNodes = true`)
7. Updates preview panels

#### `exportPNG(exportScale, transparent)`
Export pipeline:
1. Re-render to temp canvas (with transparent bg if requested)
2. Downsample to pixel-perfect size using nearest-neighbor
3. Scale up by exportScale using `drawImage()` with smoothing disabled

#### `applyDitherPattern(x, y, color, ditherPatternIndex, invertDither)`
Applies dither pattern at a pixel position:
- Accounts for `ditherScale` to support pattern scaling
- Uses modulo to tile the 8×8 pattern
- Only draws pixel if pattern is "on" at that position
- If `invertDither` is true, flips the pattern

#### `exportGIF()`
GIF animation export:
1. Auto-detects environment (local file vs server)
2. Configures gif.js with or without web workers
3. Renders each frame to pixel-perfect size
4. Adds frames to GIF with delays based on `fps` and `hold` values
5. Encodes and downloads animated GIF

#### `exportSpritesheet(exportScale)`
Spritesheet export:
1. Calculates optimal grid layout (square-ish)
2. Creates spritesheet canvas sized for all frames
3. Renders each frame to pixel-perfect size
4. Optionally scales up each frame
5. Arranges frames in grid and exports as PNG

#### `drawOnionSkin()`
Onion skinning render:
1. Draws previous frames with red tint and fading opacity
2. Draws next frames with green tint and fading opacity
3. Opacity calculation: `baseOpacity × (1 - (distance - 1) / maxFrames)`
4. Temporarily modifies color palette to apply tints

#### Animation Frame Management
- `addFrame()`: Creates new empty frame after current
- `duplicateFrame()`: Copies current frame with " Copy" suffix
- `deleteFrame()`: Removes frame (prevents deletion of last frame)
- `reorderFrame(fromIndex, toIndex)`: Moves frame and updates currentFrame
- `saveCurrentFrame()`: Saves shapes to current frame
- `loadFrame(frameIndex)`: Loads shapes from specified frame
- `updateFrameName(frameIndex, newName)`: Updates frame name
- `updateFrameHold(frameIndex, newHold)`: Updates frame hold value

### Event Handling

#### Keyboard Shortcuts
- **Tools**: 1-6 for shapes, V for select, F for fill
- **Operations**: Ctrl+C/V (copy/paste), Del (delete)
- **Boolean**: Ctrl+Shift+U/B/I (union/subtract/intersect)
- **History**: Ctrl+Z (undo), Ctrl+Y (redo)
- **Nodes**: Ctrl+Shift+M (merge nodes), Ctrl+Shift+P (to polygon)
- **View**: G (grid), O (outline), Z (zen mode), H (lock horizontal)
- **Ordering**: [ (back), ] (front)

#### Mouse/Touch Handling
- Drawing mode: Click to add points, Enter/Escape to finish
- Select mode: Click shapes, drag nodes, Shift+Click for multi-select
- Selection box: Click and drag in empty space

### Important Implementation Notes

1. **History System**: Only saves when `shapeWasModified` flag is true to avoid unnecessary history entries. Calls `saveCurrentFrame()` to auto-save to animation timeline.

2. **Selection Nodes**: Hidden during export by checking `showSelectionNodes` flag in render()

3. **Coordinate Systems**:
   - Canvas space: Logical coordinates (e.g., 0-240)
   - Screen space: Scaled by `this.scale` for display
   - Grid space: Divided by `getCellSize()` for grid snapping
   - Export space: Downsampled to actual pixel size

4. **Dither Pattern Generation**: Patterns are created programmatically in `createDitherPatterns()` to avoid CORS issues with loading images. Supports invert mode for all patterns.

5. **Fill Tool**: Uses flood fill algorithm but only works in non-grid mode

6. **Boolean Operations**: Convert shapes to polygons, perform geometric operations, create new polygon shapes

7. **Animation Frame Storage**: Frames store deep copies of shape arrays using `JSON.parse(JSON.stringify())`. Each frame is an object with shapes array, name, and hold value.

8. **Frame Hold System**: `frameHoldCounter` increments each animation tick. When counter reaches frame's hold value, advance to next frame and reset counter. This allows frames to display for multiple ticks.

9. **Onion Skinning**: Renders previous/next frames with temporary color palette modifications. Red tint for past frames, green tint for future frames. Opacity fades based on frame distance.

10. **GIF Export CORS**: Auto-detects `window.location.protocol` to determine if web workers can be used. Local files use main thread to avoid CORS errors. Server-hosted files use workers for better performance.

11. **Canvas Dimension Alignment**: Canvas dimensions are rounded to be exact multiples of grid cells in `updateCanvasDimensions()`. This ensures pixel-perfect downsampling where each grid cell is a whole number of pixels.

## Known Limitations

- Fill tool doesn't work in grid mode
- SVG export was removed (only PNG/JPG/GIF)
- Dither patterns export as rasterized in images (can't be preserved as vector patterns)
- Maximum 50 history steps
- Grid mode forces shapes to align to grid boundaries
- GIF export uses main thread when running from local files (may freeze UI briefly)
- Canvas dimensions must be multiples of grid size for pixel-perfect export

## Future Considerations

- Implement fill tool for grid mode
- Add more dither patterns
- Layer system separate from shape ordering
- Custom brush patterns
- Gradient support
- Text tool
- Animation timeline scrubbing
- Frame duration in seconds/milliseconds display

## Development Tips

### Adding New Shape Types
1. Add case to `drawShape()` switch statement
2. Implement `drawShapeName()` function with dither support
3. Add to `drawPreview()` for live preview
4. Add tool button in HTML
5. Add keyboard shortcut in `handleKeyDown()`

### Modifying Export
- Export always uses nearest-neighbor sampling for pixel-perfect results
- Modify `exportPNG()` to change export behavior
- Remember to handle both transparent and opaque modes
- Test with different grid sizes and export scales

### Working with Dither
- Patterns are 8×8 pixels stored as ImageData
- `ditherScale` multiplies pattern size (1-16x)
- Pattern position is calculated using modulo: `x % (8 * ditherScale)`
- Each drawing function must check for and apply dither pattern
- `invertDither` parameter flips the pattern logic in `applyDitherPattern()`

### Working with Animation
- Always use `saveCurrentFrame()` when modifying shapes
- Frame switching is disabled during playback (`isPlaying` check)
- Frame thumbnails re-render entire frames at 64×64 with `drawShape()`
- Drag-and-drop uses HTML5 Drag API with `draggable` attribute
- Hold values multiply frame duration: `delay = (1000 / fps) × hold`
- Onion skin tinting is done by temporarily modifying color palette during render

### Debugging
- Console logs can be added to export functions
- Check browser console for shape rendering issues
- Use preview panel to verify export appearance before saving
- Test transparency with checkerboard background in image viewer

## Build & Deploy

This is a static web application:
- No build step required
- Simply serve `index.html` and `editor.js`
- External dependencies loaded from CDN:
  - gif.js for GIF animation export
- Can be hosted on any static file server (GitHub Pages, Netlify, etc.)
- Works offline once loaded (except GIF export requires CDN access)
- Dither patterns generated programmatically (no image files needed)

### GitHub Pages Deployment
- Works perfectly on GitHub Pages (https://)
- GIF export will use web workers for better performance
- No CORS issues when served over HTTPS
- Simply push to a repository and enable GitHub Pages

## Credits

- Azirona Drift palette attribution link included
- Ko-fi donation link: "Buy us a Mtn Dew"
