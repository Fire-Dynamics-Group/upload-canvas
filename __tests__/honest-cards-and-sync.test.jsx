// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StructuralProjectCard from '../Components/StructuralProjectCard'
import TimeEqWorkspace from '../Components/StructuralFire/TimeEqWorkspace'

const cardProject = {
  id: 'p-card',
  name: 'Unset metrics',
  created_by: 'Dev',
  updated_at: '2026-11-10T10:00:00Z',
  settings: {
    timeEqInputs: {
      section: 'UB 305x165x40',
      criticalTemp: 620,
    },
  },
}

function field(label) {
  const node = screen.getByText(label).parentElement.querySelector('input, select')
  if (!node) throw new Error(`no field for ${label}`)
  return node
}

describe('cards and MACS sync stay honest', () => {
  it('does not print REI 90 or Office when the project did not store them', () => {
    render(
      <StructuralProjectCard
        project={cardProject}
        onOpen={() => {}}
        onOpenCanvas={() => {}}
        onRename={() => {}}
        onDelete={() => {}}
        timeAgo={() => 'just now'}
      />,
    )
    const period = screen.getByText('Target Fire Res.').parentElement
    const occupancy = screen.getByText('Occupancy').parentElement
    expect(period).toHaveTextContent('—')
    expect(period).not.toHaveTextContent('REI')
    expect(occupancy).toHaveTextContent('—')
    expect(occupancy).not.toHaveTextContent('Office')
    expect(screen.getByText('620°C')).toBeInTheDocument()
  })

  it('leaves critical temp, section factor, and section empty when the run did not send them', () => {
    const project = {
      id: 'p-bare',
      name: 'Bare member',
      settings: {
        timeEqInputs: { memberProtection: 'unprotected' },
        timeEqResult: {
          reliabilityPercent: 90,
          nSim: 10,
          nFailed: 1,
          charts: { steelTempSpaghetti: 'aa' },
        },
      },
    }
    render(
      <TimeEqWorkspace
        project={project}
        floorDetail={{ elements: [] }}
        selectedMacsRun={{ id: 'run-empty' }}
      />,
    )

    expect(field('Critical Temp (°C)')).toHaveValue(null)
    expect(field('Ap/V (m⁻¹)')).toHaveValue(null)
    expect(field('Steel Section')).toHaveValue('')
    expect(screen.getByText(/critical temperature limit/i)).toHaveTextContent('—')
    expect(screen.queryByText(/550/)).not.toBeInTheDocument()
    expect(screen.queryByText('UB 457x191x82')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Sync Critical Temp/i }))

    expect(field('Critical Temp (°C)')).toHaveValue(null)
    expect(field('Ap/V (m⁻¹)')).toHaveValue(null)
    expect(field('Steel Section')).toHaveValue('')
    expect(screen.getByLabelText('Exposure')).toHaveValue('')
    expect(screen.queryByDisplayValue('550')).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('140')).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('UB 457x191x82')).not.toBeInTheDocument()
  })
})
