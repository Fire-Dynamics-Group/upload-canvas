import { describe, it, expect } from 'vitest'
import { computeCenterlinePoints } from '../utils/corridorCenterline.js'

describe('real lobby from Railway DB (project 1910aba9)', () => {
  const lobby = [
    {x:1135.7, y:945.7},
    {x:999.4,  y:945.7},
    {x:999.4,  y:1313.3},
    {x:1135.7, y:1313.3}
  ]
  const pxPerMesh = 4.129842240026431
  const pxPerM = pxPerMesh * 10

  it('produces a single centerline, not a sensor grid', () => {
    const sensors = computeCenterlinePoints(lobby, [], {}, pxPerMesh)
    const ux = [...new Set(sensors.map(s => s.x))].sort((a,b)=>a-b)
    const uy = [...new Set(sensors.map(s => s.y))].sort((a,b)=>a-b)
    console.log('sensors:', sensors.length)
    console.log('unique X m:', ux.map(x=>(x/pxPerM).toFixed(2)))
    console.log('unique Y m:', uy.map(y=>(y/pxPerM).toFixed(2)))
    // Lobby is 3.3m × 8.9m — long axis is Y, so centerline is a single X,
    // multiple Y values.
    expect(ux.length).toBe(1)
    expect(uy.length).toBeGreaterThan(10)
  })
})
