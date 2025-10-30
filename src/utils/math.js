/**
 * Math and geometry utility functions
 */

/**
 * Calculate distance from point to line segment
 */
export function distanceToLine(point, lineStart, lineEnd) {
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

/**
 * Calculate squared distance from point to line segment (faster, no sqrt)
 */
export function distanceToLineSquared(point, lineStart, lineEnd) {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;

    if (dx === 0 && dy === 0) {
        return (point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2;
    }

    const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
    const clampedT = Math.max(0, Math.min(1, t));

    const projX = lineStart.x + clampedT * dx;
    const projY = lineStart.y + clampedT * dy;

    return (point.x - projX) ** 2 + (point.y - projY) ** 2;
}

/**
 * Douglas-Peucker algorithm for line simplification
 */
export function douglasPeucker(points, tolerance) {
    if (points.length <= 2) return points;

    let maxDist = 0;
    let index = 0;
    const end = points.length - 1;

    for (let i = 1; i < end; i++) {
        const dist = distanceToLineSquared(points[i], points[0], points[end]);
        if (dist > maxDist) {
            maxDist = dist;
            index = i;
        }
    }

    if (maxDist > tolerance * tolerance) {
        const left = douglasPeucker(points.slice(0, index + 1), tolerance);
        const right = douglasPeucker(points.slice(index), tolerance);
        return left.slice(0, -1).concat(right);
    } else {
        return [points[0], points[end]];
    }
}
