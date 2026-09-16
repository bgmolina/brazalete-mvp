import {
  Bluetooth,
  Check,
  Download,
  FileJson,
  Info,
  LockKeyhole,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { publicUrl } from '@shared/utils/publicUrl'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useSettings } from '@settings/hooks/useSettings'
import { Capabilities } from '@monitoring/components/Capabilities'
export function SettingsPage() {
  const vm = useSettings()
  return (
    <div className="settings-page page-enter">
      <div className="page-heading">
        <div>
          <span className="eyebrow">TU ESPACIO, A TU MANERA</span>
          <h1>
            Configuración<span className="heading-dot">.</span>
          </h1>
          <p>Los pequeños detalles que hacen más personal el cuidado.</p>
        </div>
        <span className="mode-tag">
          <LockKeyhole size={14} /> Sólo en este navegador
        </span>
      </div>
      {vm.settings.warning ? (
        <div className="notice notice-warning" role="status">
          {vm.settings.warning}
        </div>
      ) : null}
      <div className="settings-top-grid">
        <section className="panel settings-card">
          <div className="section-icon">
            <UserRound size={22} />
          </div>
          <h2>La persona que acompañás</h2>
          <p>
            Esta ficha se muestra únicamente en el monitoreo real. La demo conserva su perfil
            ficticio.
          </p>
          <form onSubmit={vm.savePerson} className="settings-person-form" noValidate>
            <div>
              <Label htmlFor="person-name">Nombre</Label>
              <Input
                id="person-name"
                placeholder="¿Cómo se llama?"
                autoComplete="off"
                maxLength={80}
                aria-invalid={!!vm.form.formState.errors.name}
                aria-describedby="name-error"
                {...vm.form.register('name')}
              />
              <p id="name-error" className="field-error">
                {vm.form.formState.errors.name?.message}
              </p>
            </div>
            <div>
              <Label htmlFor="person-age">
                Edad <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                id="person-age"
                type="number"
                min={1}
                max={120}
                placeholder="Años"
                aria-invalid={!!vm.form.formState.errors.age}
                aria-describedby="age-error"
                {...vm.form.register('age')}
              />
              <p id="age-error" className="field-error">
                {vm.form.formState.errors.age?.message}
              </p>
            </div>
            <Button type="submit">
              <Save /> Guardar ficha
            </Button>
          </form>
        </section>
        <section className="panel settings-card storage-card">
          <div className="section-icon">
            <ShieldCheck size={22} />
          </div>
          <h2>Tu información, cerca tuyo</h2>
          <p>
            Los resúmenes y eventos reales se guardan localmente durante 24 horas. No se envían a un
            servidor.
          </p>
          <div className="storage-features">
            <span>
              <Check size={16} /> Limpieza automática cada minuto
            </span>
            <span>
              <Check size={16} /> Datos separados por dispositivo
            </span>
            <span>
              <Check size={16} /> Simulación independiente, sólo en memoria
            </span>
          </div>
          <div className="storage-summary">
            <strong>24 h</strong>
            <span>
              Retención máxima
              <br />
              del historial real
            </span>
            <span className="storage-icon">
              <ShieldCheck size={28} />
            </span>
          </div>
          <p className="storage-explanation">
            Las muestras detalladas de la sesión se pierden al recargar. Se conservan los resúmenes
            por minuto y los eventos vigentes.
          </p>
          <Button
            variant="outline"
            className="clear-button"
            onClick={() => vm.setConfirmClear(true)}
          >
            <Trash2 /> Limpiar historial real
          </Button>
        </section>
      </div>
      <section className="panel settings-card">
        <div className="settings-section-heading">
          <div className="section-icon">
            <Bluetooth size={22} />
          </div>
          <div>
            <h2>Compatibilidad Bluetooth</h2>
            <p>La disponibilidad depende de los servicios que expone cada dispositivo.</p>
          </div>
          <Badge variant="secondary">Una pulsera activa</Badge>
        </div>
        <Capabilities value={vm.real.capabilities} />
        <div className="compatibility-info">
          <div>
            <h3>Pulso estándar</h3>
            <p>
              Se lee el servicio Heart Rate (0x180D). Batería e identificación del navegador son
              opcionales. No se utiliza una dirección MAC.
            </p>
          </div>
          <div>
            <h3>Movimiento y pasos</h3>
            <p>
              Necesitan un perfil GATT conocido. Si la pulsera utiliza autenticación o comandos
              propietarios, requiere un adaptador específico.
            </p>
          </div>
          <div>
            <h3>Caídas: función experimental</h3>
            <p>
              Requiere aceleración calibrada en g, con gravedad y señal continua de al menos 20 Hz.
              No es una detección médica certificada.
            </p>
          </div>
        </div>
      </section>
      <section className="panel settings-card advanced-settings">
        <div className="settings-section-heading">
          <div className="section-icon">
            <FileJson size={22} />
          </div>
          <div>
            <h2>Perfil BLE avanzado</h2>
            <p>Configuración técnica de los sensores de movimiento y pasos.</p>
          </div>
          <Badge variant="outline">{vm.settings.profile?.name || 'Sin perfil adicional'}</Badge>
        </div>
        <div className="notice notice-neutral">
          <Info size={17} />
          <span>
            Importá únicamente un formato documentado por el fabricante. La plantilla es
            ilustrativa: sus UUID no corresponden a una pulsera comercial. Al aplicar un perfil se
            desconecta la pulsera.
          </span>
        </div>
        <div className="profile-actions">
          <Button variant="outline" asChild>
            <a href={publicUrl('profiles/perfil-ejemplo.json')} download>
              <Download /> Descargar plantilla
            </a>
          </Button>
          <Button variant="outline" onClick={() => vm.fileInputRef.current?.click()}>
            <Upload /> Importar JSON
          </Button>
          <input
            ref={vm.fileInputRef}
            tabIndex={-1}
            id="profile-file"
            type="file"
            accept=".json,application/json"
            className="sr-only"
            aria-label="Importar perfil JSON"
            onChange={(e) => {
              void vm.importProfile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>
        <Label htmlFor="profile-json">Definición del perfil (JSON)</Label>
        <Textarea
          id="profile-json"
          className="profile-editor"
          value={vm.profileText}
          onChange={(e) => vm.setProfileText(e.target.value)}
          placeholder={'{\n  "version": 1,\n  "name": "Mi dispositivo",\n  ...\n}'}
          spellCheck={false}
          aria-invalid={!!vm.profileError}
          aria-describedby="profile-error"
        />
        <p className="field-error" id="profile-error" role={vm.profileError ? 'alert' : undefined}>
          {vm.profileError}
        </p>
        <div className="flex flex-wrap gap-3 mt-4">
          <Button onClick={vm.saveProfile} disabled={!vm.profileText.trim()}>
            <Check /> Validar y aplicar perfil
          </Button>
          <Button variant="ghost" disabled={!vm.settings.profile} onClick={vm.removeProfile}>
            Quitar perfil adicional
          </Button>
        </div>
      </section>
      <p className="safety-footnote">
        <LockKeyhole size={15} /> El acceso admin es una barrera de demostración. Las credenciales
        VITE_* forman parte del código cliente; no usar contraseñas reales.
      </p>
      <AlertDialog open={vm.confirmClear} onOpenChange={vm.setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Limpiar el historial real?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán los resúmenes y eventos de todas las pulseras guardadas por Brazalete en
              este navegador. No se puede deshacer. Tu ficha, el perfil BLE, la demo y otros sitios
              no se modificarán. Si la pulsera está conectada, las próximas lecturas iniciarán un
              nuevo historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Conservar historial</AlertDialogCancel>
            <AlertDialogAction
              onClick={vm.clear}
              className="bg-destructive hover:bg-destructive/90"
            >
              <Trash2 /> Sí, limpiar historial
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
