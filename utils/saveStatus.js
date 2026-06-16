// Maps a save-status token to the message + tone the status indicator renders.
//
// Persistence failures used to be swallowed (console.error + return), so a user
// whose project never saved saw nothing. The create/PDF-upload paths now set a
// status here so the failure is visible. Tone drives the indicator colour.

export function describeSaveStatus(status) {
    switch (status) {
        case 'saving':
            return { label: 'Saving…', tone: 'pending' }
        case 'saved':
            return { label: 'Saved', tone: 'success' }
        case 'create-failed':
            return { label: "Couldn't save project — your work isn't being saved", tone: 'error' }
        case 'pdf-failed':
            return { label: "Couldn't upload the plan PDF", tone: 'error' }
        case 'error':
            return { label: 'Save failed', tone: 'error' }
        default:
            return null
    }
}
