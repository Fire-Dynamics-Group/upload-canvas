// Compact signature of the drawn geometry, used to detect when a previously
// generated FDS file (and therefore the 3D / FDS-code views) has gone stale.
// Only id/type/comments/points affect the generated geometry, so the signature
// ignores everything else to avoid spurious "stale" flags. Shared by the store
// (captures it at generation time) and the views (compare against live state).
export function fdsElementSignature(elements) {
    if (!Array.isArray(elements)) return ''
    return JSON.stringify(elements.map((el) => [el.id, el.type, el.comments, el.points]))
}
