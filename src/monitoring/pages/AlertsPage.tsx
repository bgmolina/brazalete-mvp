import { Bell, CircleCheck, Clock3, Info, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAlerts } from '@monitoring/hooks/useAlerts'
import { EventRow } from '@monitoring/components/EventRow'
import { date, eventTitle, time } from '@shared/utils/format'
import type { EventType } from '@shared/types/monitoring'
export function AlertsPage() {
  const vm = useAlerts()
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SEÑALES PARA ACOMPAÑAR</span>
          <h1>
            Alertas y eventos<span className="heading-dot">.</span>
          </h1>
          <p>Un registro de los momentos que merecen una mirada más cercana.</p>
        </div>
        <span className={`mode-tag ${vm.mode === 'demo' ? 'demo-tag' : ''}`}>
          {vm.mode === 'demo' ? <Sparkles size={14} /> : <ShieldCheck size={14} />}{' '}
          {vm.mode === 'demo' ? 'Datos simulados' : 'Registro local'}
        </span>
      </div>
      <div className="notice notice-neutral">
        <Info size={18} />
        <span>
          {vm.mode === 'demo'
            ? 'Estos eventos son ficticios. Explorá sus detalles y marcá los que ya revisaste.'
            : 'Registro local; envío no implementado. No se envían mensajes, llamadas ni notificaciones externas.'}{' '}
          Ningún evento confirma un diagnóstico.
        </span>
      </div>
      <div className="event-summary">
        <div>
          <span className="summary-icon">
            <Bell size={20} />
          </span>
          <strong>{vm.total}</strong>
          <span>Eventos registrados</span>
        </div>
        <div>
          <span className="summary-icon amber">
            <Clock3 size={20} />
          </span>
          <strong>{vm.pending}</strong>
          <span>Pendientes de revisar</span>
        </div>
        <div>
          <span className="summary-icon">
            <CircleCheck size={20} />
          </span>
          <strong>{vm.total - vm.pending}</strong>
          <span>Revisados</span>
        </div>
      </div>
      <section className="panel alerts-panel">
        <div className="panel-heading">
          <div>
            <h2>Historial de eventos</h2>
            <p>
              {vm.mode === 'real'
                ? 'Últimas 24 horas · Dispositivo seleccionado'
                : 'Eventos de la simulación actual'}
            </p>
          </div>
          <div className="alert-filters">
            <Select value={vm.filter} onValueChange={(v) => vm.setFilter(v as EventType | 'all')}>
              <SelectTrigger className="w-48" aria-label="Filtrar por tipo de evento">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los eventos</SelectItem>
                <SelectItem value="zero-heart-rate">Lectura de 0 BPM</SelectItem>
                <SelectItem value="possible-fall">Posible caída</SelectItem>
                <SelectItem value="disconnected">Desconexión</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch
                id="pending-only"
                checked={vm.pendingOnly}
                onCheckedChange={vm.setPendingOnly}
              />
              <Label htmlFor="pending-only">Sin revisar</Label>
            </div>
          </div>
        </div>
        {vm.events.length ? (
          <div className="event-list">
            {vm.events.map((e) => (
              <EventRow key={e.id} event={e} onClick={() => vm.setSelectedId(e.id)} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-state-icon">
              <ShieldCheck size={30} />
            </span>
            <h3>Todo en orden por acá</h3>
            <p>
              No hay eventos para esta selección. Los nuevos registros aparecerán en este espacio.
            </p>
          </div>
        )}
      </section>
      <p className="safety-footnote">
        <ShieldCheck size={15} /> Una lectura de 0 BPM puede tener causas técnicas o de contacto.
        Revisá a la persona y la medición. Ante una emergencia, buscá asistencia médica.
      </p>
      <Dialog
        open={!!vm.selected}
        onOpenChange={(open) => {
          if (!open) vm.setSelectedId(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {vm.selected ? eventTitle[vm.selected.type] : 'Detalle del evento'}
            </DialogTitle>
            <DialogDescription>
              {vm.selected
                ? `${date(vm.selected.timestamp)} · ${time(vm.selected.timestamp, true)} · ${vm.selected.source === 'demo' ? 'Simulado' : 'Registro local'}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {vm.selected ? (
            <>
              <div className="event-detail">
                <Badge variant="secondary">
                  {vm.selected.reviewed ? 'Revisada' : 'Pendiente de revisión'}
                </Badge>
                <h3>Evidencia registrada</h3>
                <p>{vm.selected.evidence}</p>
                <div className="detail-device">
                  Dispositivo: <code>{vm.selected.deviceId}</code>
                </div>
                <div className="notice notice-neutral">
                  <Info size={16} />
                  {vm.mode === 'real'
                    ? 'Registro local; envío no implementado.'
                    : 'Evento ficticio. No se envió ninguna notificación.'}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => vm.setSelectedId(null)}>
                  Cerrar
                </Button>
                <Button disabled={vm.selected.reviewed} onClick={() => vm.review(vm.selected!.id)}>
                  <CircleCheck />
                  {vm.selected.reviewed ? 'Ya revisada' : 'Marcar como revisada'}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
