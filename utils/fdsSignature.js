// Compact signature of the drawn geometry, used to detect when a previously
// generated FDS file (and therefore the 3D / FDS-code views) has gone stale.
// Only id/type/comments/points affect the generated geometry, so the signature
// ignores everything else to avoid spurious "stale" flags. Shared by the store
// (captures it at generation time) and the views (compare against live state).
export function fdsElementSignature(elements, floors = null) {
    if (Array.isArray(floors) && floors.length > 1) {
        return JSON.stringify(
            floors.map((f) => [
                f.floor_number,
                f.z_level,
                f.wall_height,
                f.pixels_per_mesh,
                f.origin_pixels,
                (f.elements || []).map((el) => [el.id, el.type, el.comments, el.points]),
            ])
        )
    }
    if (!Array.isArray(elements)) return ''
    return JSON.stringify(elements.map((el) => [el.id, el.type, el.comments, el.points]))
}
