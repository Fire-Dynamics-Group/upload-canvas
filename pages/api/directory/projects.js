const DIRECTORY_API_URL = (
    process.env.DIRECTORY_API_URL ||
    process.env.NEXT_PUBLIC_DIRECTORY_API_URL ||
    'https://directory-api-production-7f250373.up.railway.app'
).replace(/\/+$/, '')

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' })
    }
    const q = String(req.query.q || '').trim()
    const limit = String(req.query.limit || '12')
    const upstreamUrl = `${DIRECTORY_API_URL}/v1/projects?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(limit)}`

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
