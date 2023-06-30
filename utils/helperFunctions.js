export function calcDistance(p1, p2) {
    let a = p1.x - p2.x
    let b = p1.y - p2.y
    return Math.sqrt( a*a + b*b );
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