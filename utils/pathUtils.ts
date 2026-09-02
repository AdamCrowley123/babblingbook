/**
 * Vector and Path utilities for Babbling Book
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * Calculates squared distance between two points
 */
export function getSqDist(p: Point, p2: Point): number {
  const dx = p.x - p2.x;
  const dy = p.y - p2.y;
  return dx * dx + dy * dy;
}

/**
 * Calculates squared distance from point p to the segment between p1 and p2
 */
export function getSqSegDist(p: Point, p1: Point, p2: Point): number {
  let x = p1.x;
  let y = p1.y;
  let dx = p2.x - x;
  let dy = p2.y - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = p2.x;
      y = p2.y;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p.x - x;
  dy = p.y - y;
  return dx * dx + dy * dy;
}

/**
 * Ramer-Douglas-Peucker (RDP) algorithm for polygon / path simplification
 */
export function simplifyRDP(points: Point[], sqTolerance: number): Point[] {
  if (points.length < 2) return points;
  const len = points.length;
  const markers = new Uint8Array(len);
  let first = 0;
  let last = len - 1;
  const stack: number[] = [];
  const newPoints: Point[] = [];
  let i: number;
  let maxSqDist: number;
  let sqDist: number;
  let index: number;

  markers[first] = markers[last] = 1;

  while (last) {
    maxSqDist = 0;
    index = 0;
    for (i = first + 1; i < last; i++) {
      sqDist = getSqSegDist(points[i], points[first], points[last]);
      if (sqDist > maxSqDist) {
        index = i;
        maxSqDist = sqDist;
      }
    }
    if (maxSqDist > sqTolerance) {
      markers[index] = 1;
      stack.push(first, index, index, last);
    }

    const newLast = stack.pop();
    const newFirst = stack.pop();
    last = newLast !== undefined ? newLast : 0;
    first = newFirst !== undefined ? newFirst : 0;
  }

  for (i = 0; i < len; i++) {
    if (markers[i]) {
      newPoints.push(points[i]);
    }
  }
  return newPoints;
}

/**
 * Calculates Catmull-Rom control points
 */
export function getControlPoints(p0: Point, p1: Point, p2: Point, p3: Point, tension: number): [Point, Point] {
  const t = tension;
  const cp1 = {
    x: p1.x + ((p2.x - p0.x) / 6) * t,
    y: p1.y + ((p2.y - p0.y) / 6) * t,
  };
  const cp2 = {
    x: p2.x - ((p3.x - p1.x) / 6) * t,
    y: p2.y - ((p3.y - p1.y) / 6) * t,
  };
  return [cp1, cp2];
}

/**
 * Converts points to smooth SVG path data using Catmull-Rom splines
 */
export function createSmoothPath(points: Point[], tension: number, closed = true): string {
  if (points.length < 2) return '';
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;
  const p = [...points];

  if (closed) {
    p.unshift(points[points.length - 1]);
    p.push(points[0], points[1]);
  } else {
    p.unshift(points[0]);
    p.push(points[points.length - 1]);
  }

  for (let i = 1; i < p.length - 2; i++) {
    const [cp1, cp2] = getControlPoints(p[i - 1], p[i], p[i + 1], p[i + 2], tension);
    path += ` C ${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${p[i + 1].x},${p[i + 1].y}`;
  }

  if (closed) path += ' Z';

  return path;
}
