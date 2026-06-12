export function calcDistance(p1, p2) {
    let a = p1.x - p2.x
    let b = p1.y - p2.y
    return Math.sqrt( a*a + b*b );
}

// Map a pointer event's viewport coordinates to canvas-INTRINSIC coordinates
// (issue #16). The draw canvas only happens to map 1:1 today because it sits at
// the document origin at intrinsic resolution; the moment it's displayed at a
// CSS size != its intrinsic width/height (responsive fit, browser zoom, a small
// device shrinking the bitmap) a raw pageX/pageY read lands on the wrong pixel.
// Subtract the canvas origin, then rescale by intrinsic/CSS size per axis.
export function clientToCanvasPoint({ clientX, clientY }, rect, canvasWidth, canvasHeight) {
    const scaleX = rect.width ? canvasWidth / rect.width : 1
    const scaleY = rect.height ? canvasHeight / rect.height : 1
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
    }
}

// (px, py, fx, fy, obst1x, obst1y, obst2x, obst2y) 
export function intersects(a,b,c,d,p,q,r,s) {
    var det, gamma, lambda;
    det = (c - a) * (s - q) - (r - p) * (d - b);
    if (det === 0) {
      return false;
    } else {
      lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det;
      gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det;
      return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
    }
  };