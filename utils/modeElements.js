// Per-mode element and tool allowlists. Ensures a mode (e.g. efs) can never
// accidentally select, draw, or commit elements belonging to another mode.

export const MODE_ELEMENT_COMMENTS = {
    fdsGen: [
        'obstruction',
        'mesh',
        'stairObstruction',
        'stairMesh',
        'landing',
        'inlet',
        'extract',
        'sprinkler',
        'fire',
        'door',
    ],
    radiation: ['obstruction', 'escapeRoute', 'fire', 'door'],
    timeEq: ['obstruction', 'opening'],
    efs: ['efsWall', 'efsBoundary', 'efsProtected', 'efsUnprotected'],
}

export const MODE_TOOLS = {
    fdsGen: ['selection', 'scale', 'polyline', 'rect', 'point'],
    radiation: ['selection', 'scale', 'polyline', 'point'],
    timeEq: ['selection', 'scale', 'polyline'],
    efs: ['selection', 'scale', 'polyline', 'efsBay'],
}

export function isCommentAllowedForMode(mode, comment) {
    if (!comment || comment === 'scale') return true
    const allowed = MODE_ELEMENT_COMMENTS[mode]
    if (!allowed) return true
    return allowed.includes(comment)
}

export function isElementAllowedForMode(mode, element) {
    if (!element?.comments) return true
    const allowed = MODE_ELEMENT_COMMENTS[mode]
    if (!allowed) return true
    return allowed.includes(element.comments)
}

export function isToolAllowedForMode(mode, tool) {
    const allowed = MODE_TOOLS[mode]
    if (!allowed) return true
    return allowed.includes(tool)
}

export function sanitizeCommentForMode(mode, comment) {
    return isCommentAllowedForMode(mode, comment) ? comment : ''
}

export function sanitizeToolForMode(mode, tool) {
    return isToolAllowedForMode(mode, tool) ? tool : 'selection'
}
