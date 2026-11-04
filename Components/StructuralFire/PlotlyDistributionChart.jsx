import { useEffect, useRef, useState } from 'react'
import { getMacsBatchDistribution } from '../ApiCalls'

const SPAGHETTI_COLOR = '#4798EA'
const AVERAGE_COLOR = 'coral'
const FACTORED_COLOR = '#DC2626'
const FACTORED_EPSILON = 1e-6

export function buildDistributionTraces(payload) {
    const traces = []
    if (!payload) return { traces }

    const spaghetti = payload.spaghetti || []
    const average = payload.average || []

    if (spaghetti.length === 0 && average.length === 0) {
        return { traces }
    }

    spaghetti.forEach((run, idx) => {
        traces.push({
            x: (run.points || []).map((p) => p[0]),
            y: (run.points || []).map((p) => p[1]),
            mode: 'lines',
            type: 'scatter',
            name: 'Recorded',
            legendgroup: 'spaghetti',
            showlegend: idx === 0,
            line: { color: SPAGHETTI_COLOR, width: 0.8 },
            hoverinfo: 'skip',
        })
    })

    if (average.length > 0) {
        traces.push({
            x: average.map((p) => p[0]),
            y: average.map((p) => p[1]),
            mode: 'lines',
            type: 'scatter',
            name: 'Average Value',
            line: { color: AVERAGE_COLOR, width: 2 },
        })
    }

    const fMin = payload.factored_hot_min
    const fMax = payload.factored_hot_max
    if (fMin != null && fMax != null && average.length > 0) {
        const xs = average.map((p) => p[0])
        const xLine = [xs[0], xs[xs.length - 1]]
        const range = Math.abs(fMax - fMin)
        if (range <= FACTORED_EPSILON) {
            traces.push({
                x: xLine,
                y: [fMin, fMin],
                mode: 'lines',
                type: 'scatter',
                name: 'Factored load',
                line: { color: FACTORED_COLOR, width: 1.5, dash: 'dash' },
            })
        } else {
            traces.push({
                x: xLine,
                y: [fMin, fMin],
                mode: 'lines',
                type: 'scatter',
                name: 'Factored load (min)',
                line: { color: FACTORED_COLOR, width: 1 },
                showlegend: false,
                hoverinfo: 'skip',
            })
            traces.push({
                x: xLine,
                y: [fMax, fMax],
                mode: 'lines',
                type: 'scatter',
                name: 'Factored load (range)',
                line: { color: FACTORED_COLOR, width: 1 },
                fill: 'tonexty',
                fillcolor: 'rgba(220, 38, 38, 0.15)',
            })
        }
    }

    return { traces }
}

export default function PlotlyDistributionChart({
    projectId,
    batchId,
    column,
    title,
    yLabel,
    spaghettiN = 300,
}) {
    const ref = useRef(null)
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!projectId || !batchId || !column) return
        let active = true
        setLoading(true)
        setError(null)

        getMacsBatchDistribution(projectId, batchId, column, spaghettiN)
            .then((res) => {
                if (!active) return
                setData(res)
                setLoading(false)
            })
            .catch((err) => {
                if (!active) return
                setError(err.message || 'Failed to load chart')
                setLoading(false)
            })

        return () => { active = false }
    }, [projectId, batchId, column, spaghettiN])

    useEffect(() => {
        if (!ref.current || !data) return
        const { traces } = buildDistributionTraces(data)
        if (traces.length === 0) return

        let cancelled = false
        import('plotly.js-dist-min').then((PlotlyModule) => {
            if (cancelled || !ref.current) return
            const Plotly = PlotlyModule.default || PlotlyModule

            const layout = {
                margin: { t: 15, r: 20, b: 45, l: 55 },
                xaxis: { title: { text: 'Time (min)', font: { size: 11 } } },
                yaxis: { title: { text: yLabel, font: { size: 11 } } },
                showlegend: true,
                legend: { orientation: 'h', y: -0.25, font: { size: 10 } },
                hovermode: 'closest',
            }

            Plotly.react(ref.current, traces, layout, {
                responsive: true,
                displaylogo: false,
                modeBarButtonsToRemove: ['lasso2d', 'select2d'],
            })
        })

        return () => { cancelled = true }
    }, [data, yLabel])

    return (
        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-xs">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                {title}
            </h2>
            {loading && (
                <div className="flex h-64 items-center justify-center text-xs text-slate-400">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600 mr-2" />
                    Loading chart data…
                </div>
            )}
            {error && (
                <div className="flex h-64 items-center justify-center text-xs text-rose-500">
                    {error}
                </div>
            )}
            {!loading && !error && (
                <div ref={ref} className="h-64 w-full" />
            )}
        </div>
    )
}
