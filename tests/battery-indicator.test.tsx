import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BatteryIndicator } from '@monitoring/components/BatteryIndicator'

describe('Indicador de batería', () => {
  it.each([
    { value: null, name: 'Batería sin datos', label: 'Batería sin datos', width: '0%' },
    { value: 0, name: '0% de batería, nivel crítico', label: 'Batería crítica', width: '0%' },
    { value: 10, name: '10% de batería, nivel crítico', label: 'Batería crítica', width: '10%' },
    { value: 20, name: '20% de batería, nivel bajo', label: 'Batería baja', width: '20%' },
    { value: 40, name: '40% de batería, carga media', label: 'Carga media', width: '40%' },
    {
      value: 100,
      name: '100% de batería, carga suficiente',
      label: 'Carga suficiente',
      width: '100%',
    },
  ])('representa $value como $label', ({ value, name, label, width }) => {
    const { container } = render(<BatteryIndicator value={value} />)
    expect(screen.getByRole('status', { name })).toBeVisible()
    expect(screen.getByText(label)).toBeVisible()
    expect(container.querySelector('.battery-level')).toHaveStyle({ width })
  })

  it('limita valores fuera del rango visual de batería', () => {
    const { container, rerender } = render(<BatteryIndicator value={125} />)
    expect(screen.getByRole('status', { name: '100% de batería, carga suficiente' })).toBeVisible()
    expect(container.querySelector('.battery-level')).toHaveStyle({ width: '100%' })
    rerender(<BatteryIndicator value={-4} />)
    expect(screen.getByRole('status', { name: '0% de batería, nivel crítico' })).toBeVisible()
    expect(container.querySelector('.battery-level')).toHaveStyle({ width: '0%' })
  })
})
