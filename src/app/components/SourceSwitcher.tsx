import { Monitor, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useMonitoringActions } from '@shared/hooks/useMonitoringActions'
export function SourceSwitcher() {
  const actions = useMonitoringActions()
  const navigate = useNavigate()
  return (
    <div className="mode-box">
      <span className="nav-section-label">FUENTE DE DATOS</span>
      <div className="mode-switch" role="group" aria-label="Modo de monitoreo">
        <button
          className={actions.mode === 'demo' ? 'selected' : ''}
          onClick={() => {
            if (actions.mode === 'real') actions.disconnect()
            navigate('/demo')
          }}
          aria-pressed={actions.mode === 'demo'}
        >
          <Sparkles size={15} /> Demo
        </button>
        <button
          className={actions.mode === 'real' ? 'selected' : ''}
          onClick={() => navigate('/monitoreo')}
          aria-pressed={actions.mode === 'real'}
        >
          <Monitor size={15} /> En vivo
        </button>
      </div>
      <p>
        {actions.mode === 'demo'
          ? 'Explorá con datos simulados.'
          : 'Datos de tu pulsera Bluetooth.'}
      </p>
    </div>
  )
}
