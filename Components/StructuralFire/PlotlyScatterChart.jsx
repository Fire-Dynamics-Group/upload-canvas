import { useEffect, useRef } from 'react'

const PASS_COLOR = '#4798EA'
const FAIL_COLOR = 'coral'

export function buildMacsScatterTraces(runs = []) {
    const passX = []
    const passY = []
    const failX = []
    const failY = []

    for (const run of runs) {
        if (run.error) continue
        const qf = run.qf
        const wp = run.window_percent
        const uf = run.uf_max
        if (qf == null || wp == null) continue
        if (uf != null && uf <= 1.0) {
            passX.push(Number(qf))
            passY.push(Number(wp))
        } else {
            failX.push(Number(qf))
            failY.push(Number(wp))
        }
    }

    const traces = []
    if (passX.length > 0) {
        traces.push({
            x: passX,
            y: passY,
            mode: 'markers',
            type: 'scatter',
            name: 'Unity factor < 1.0',
            marker: { color: PASS_COLOR, size: 5 },
        })
    }
    if (failX.length > 0) {
        traces.push({
            x: failX,
            y: failY,
            mode: 'markers',
            type: 'scatter',
            name: 'Unity factor >= 1.0',
            marker: { color: FAIL_COLOR, size: 7 },
        })
    }

    return {
        traces,
        xLabel: 'Fire Load Density (MJ/m²)',
        yLabel: 'Glazing Breakage (%)',
    }
}

export default function PlotlyScatterChart({ runs = [] }) {
    const ref = useRef(null)

    useEffect(() => {
        if (!ref.current || runs.length === 0) return
        const { traces, xLabel, yLabel } = buildMacsScatterTraces(runs)
        if (traces.length === 0) return

        let cancelled = false
        import('plotly.js-dist-min').then((PlotlyModule) => {
            if (cancelled || !ref.current) return
            const Plotly = PlotlyModule.default || PlotlyModule

            const layout = {
                margin: { t: 15, r: 20, b: 45, l: 55 },
                xaxis: { title: { text: xLabel, font: { size: 11 } } },
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
    }, [runs])

    return (
        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-xs">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                Fire Load Density vs Glazing Breakage
            </h2>
            {runs.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-xs text-slate-400">
                    No runs available for scatter plot
                </div>
            ) : (
                <div ref={ref} className="h-64 w-full" />
            )}
        </div>
    )
}
