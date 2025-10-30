/**
 * Utility helper functions
 */

/**
 * Convert x,y coordinates to a numeric key for Set storage
 */
export function coordToKey(x, y, width) {
    return y * width + x;
}

/**
 * Convert numeric key back to x,y coordinates
 */
export function keyToCoord(key, width) {
    return {
        x: key % width,
        y: Math.floor(key / width)
    };
}

/**
 * Convert hex color to RGB object
 */
export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * Deep clone an object using native structuredClone or JSON fallback
 */
export function deepClone(obj) {
    if (typeof structuredClone !== 'undefined') {
        return structuredClone(obj);
    }
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Shallow clone a shape (optimized for shape objects)
 */
export function shallowCloneShape(shape) {
    return {
        ...shape,
        points: shape.points ? shape.points.map(p => ({x: p.x, y: p.y})) : []
    };
}

/**
 * Shallow clone an array of shapes
 */
export function shallowCloneShapes(shapes) {
    return shapes.map(shape => shallowCloneShape(shape));
}
