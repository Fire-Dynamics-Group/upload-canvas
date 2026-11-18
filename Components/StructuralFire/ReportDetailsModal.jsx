import { useState, useEffect } from 'react'
import { saveProjectToServer } from '../ApiCalls'

const DEFAULT_DETAILS = {
    client: '',
    location: '',
    reportTitle: 'Fire Resistance of the Office Floor Slab Structure',
    author: '',
    checkedBy: '',
    verifiedBy: '',
    targetReliability: '98.2',
    buildingDescription: '',
}

export default function ReportDetailsModal({ isOpen, onClose, project, onSaved }) {
    const [form, setForm] = useState(DEFAULT_DETAILS)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!isOpen) return
        const saved = project?.settings?.reportDetails || {}
        setForm({
            client: saved.client || '',
            location: saved.location || '',
            reportTitle: saved.reportTitle || DEFAULT_DETAILS.reportTitle,
            author: saved.author || '',
            checkedBy: saved.checkedBy || '',
            verifiedBy: saved.verifiedBy || '',
            targetReliability:
                saved.targetReliability !== undefined && saved.targetReliability !== null
                    ? String(saved.targetReliability)
                    : DEFAULT_DETAILS.targetReliability,
            buildingDescription: saved.buildingDescription || '',
        })
        setError(null)
    }, [isOpen, project?.id])

    if (!isOpen) return null

    const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

    const handleSave = async (e) => {
        e.preventDefault()
        if (!project?.id) return
        setIsSaving(true)
        setError(null)
        try {
            const parsedTarget = Number(form.targetReliability)
            const reportDetails = {
                client: form.client.trim(),
                location: form.location.trim(),
                reportTitle: form.reportTitle.trim() || DEFAULT_DETAILS.reportTitle,
                author: form.author.trim(),
                checkedBy: form.checkedBy.trim(),
                verifiedBy: form.verifiedBy.trim(),
                targetReliability: Number.isFinite(parsedTarget) ? parsedTarget : 98.2,
                buildingDescription: form.buildingDescription.trim(),
            }
            const nextSettings = {
                ...(project.settings || {}),
                reportDetails,
            }
            const updated = await saveProjectToServer(project.id, { settings: nextSettings })
            if (onSaved) onSaved(updated)
            onClose()
        } catch (err) {
            setError(err.message || 'Failed to save report details')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Report Details"
        >
            <form
                onSubmit={handleSave}
                className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-xl p-5 space-y-4"
            >
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900">Collated Report Details</h3>
                        <p className="text-xs text-gray-500">
                            Project-specific metadata slotted into the Structural Fire Resistance (.docx) report.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-xs text-gray-400 hover:text-gray-700 font-bold px-2 py-1"
                    >
                        ✕
                    </button>
                </div>

                {error && (
                    <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <label className="block">
                        <span className="font-semibold text-gray-700">Client Name</span>
                        <input
                            type="text"
                            value={form.client}
                            onChange={(e) => update('client', e.target.value)}
                            placeholder="e.g. Winvic Construction Ltd"
                            className="mt-1 w-full rounded border border-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </label>

                    <label className="block">
                        <span className="font-semibold text-gray-700">Site Location</span>
                        <input
                            type="text"
                            value={form.location}
                            onChange={(e) => update('location', e.target.value)}
                            placeholder="e.g. Castleford, West Yorkshire"
                            className="mt-1 w-full rounded border border-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </label>

                    <label className="block sm:col-span-2">
                        <span className="font-semibold text-gray-700">Report Title</span>
                        <input
                            type="text"
                            value={form.reportTitle}
                            onChange={(e) => update('reportTitle', e.target.value)}
                            className="mt-1 w-full rounded border border-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </label>

                    <label className="block">
                        <span className="font-semibold text-gray-700">Author</span>
                        <input
                            type="text"
                            value={form.author}
                            onChange={(e) => update('author', e.target.value)}
                            placeholder="Engineer name"
                            className="mt-1 w-full rounded border border-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </label>

                    <label className="block">
                        <span className="font-semibold text-gray-700">Checked By</span>
                        <input
                            type="text"
                            value={form.checkedBy}
                            onChange={(e) => update('checkedBy', e.target.value)}
                            placeholder="Reviewer name"
                            className="mt-1 w-full rounded border border-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </label>

                    <label className="block">
                        <span className="font-semibold text-gray-700">Verified By</span>
                        <input
                            type="text"
                            value={form.verifiedBy}
                            onChange={(e) => update('verifiedBy', e.target.value)}
                            placeholder="Optional"
                            className="mt-1 w-full rounded border border-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </label>

                    <label className="block">
                        <span className="font-semibold text-gray-700">Target Reliability (%)</span>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={form.targetReliability}
                            onChange={(e) => update('targetReliability', e.target.value)}
                            className="mt-1 w-full rounded border border-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </label>

                    <label className="block sm:col-span-2">
                        <span className="font-semibold text-gray-700">Building Description</span>
                        <textarea
                            rows={3}
                            value={form.buildingDescription}
                            onChange={(e) => update('buildingDescription', e.target.value)}
                            placeholder="Brief description of the building, office floors, and structural framing..."
                            className="mt-1 w-full rounded border border-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving || !project?.id}
                        className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                    >
                        {isSaving ? 'Saving…' : 'Save Report Details'}
                    </button>
                </div>
            </form>
        </div>
    )
}
