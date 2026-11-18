const DIRECTORY_API_URL = (
    process.env.DIRECTORY_API_URL ||
    process.env.NEXT_PUBLIC_DIRECTORY_API_URL ||
    'https://directory-api-production-7f250373.up.railway.app'
).replace(/\/+$/, '')

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' })
    }
    const ref = String(req.query.ref || '').trim()
    if (!ref) {
        return res.status(400).json({ error: 'Missing ref query parameter' })
    }

    const upstreamUrl = `${DIRECTORY_API_URL}/v1/projects/${encodeURIComponent(ref)}/fee-proposal-prefill`
    const headers = {}
    if (process.env.TOOLSTATION_SERVICE_KEY) {
        headers['x-toolstation-key'] = process.env.TOOLSTATION_SERVICE_KEY
    } else if (req.headers.authorization) {
        headers['authorization'] = req.headers.authorization
    }

    try {
        const upstream = await fetch(upstreamUrl, { headers })
        const body = await upstream.json().catch(() => ({ error: `Upstream HTTP ${upstream.status}` }))
        return res.status(upstream.status).json(body)
    } catch (err) {
        return res.status(502).json({ error: err?.message || 'Failed to reach directory-api' })
    }
}
