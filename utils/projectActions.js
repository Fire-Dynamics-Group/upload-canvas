// Pure helpers for destructive project actions.

// GitHub-style confirmation gate: the Delete button is enabled only when the
// user has typed the project's exact name. Surrounding whitespace is tolerated
// (accidental trailing space / autofill), but the match is otherwise exact and
// case-sensitive — deleting a project is irreversible.
export function deleteConfirmationMatches(input, projectName) {
    if (typeof input !== 'string' || typeof projectName !== 'string') return false
    const name = projectName.trim()
    if (name === '') return false
    return input.trim() === name
}
