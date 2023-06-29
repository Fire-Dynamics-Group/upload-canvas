export function calcDistance(p1, p2) {
    let a = p1.x - p2.x
    let b = p1.y - p2.y
    return Math.sqrt( a*a + b*b );
}