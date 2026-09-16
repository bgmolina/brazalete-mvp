import { ArrowRight, Eye, EyeOff, Heart, ShieldCheck } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Brand } from '@shared/components/Brand'
import { CareIllustration } from '@shared/components/CareIllustration'
import { useLogin } from '@auth/hooks/useLogin'
import { useAuthStore } from '@auth/store/authStore'
export function LoginPage() {
  const vm = useLogin()
  const authenticated = useAuthStore((s) => s.authenticated)
  if (authenticated) return <Navigate to="/demo" replace />
  return (
    <main className="login-page">
      <section className="login-story">
        <Brand />
        <div className="login-story-content">
          <span className="eyebrow">CUIDAR TAMBIÉN ES ESTAR CERCA</span>
          <h1>
            Su bienestar.
            <br />
            Tu tranquilidad.
          </h1>
          <p>Un espacio para acompañar a quienes más querés, una lectura a la vez.</p>
          <CareIllustration />
          <div className="story-footnote">
            <Heart size={16} /> Tecnología al servicio del cuidado.
          </div>
        </div>
      </section>
      <section className="login-form-panel">
        <div className="login-form-wrap">
          <span className="small-icon">
            <ShieldCheck size={23} />
          </span>
          <span className="eyebrow mt-7">BIENVENIDO A BRAZALETE</span>
          <h2>
            Estamos para
            <br />
            acompañarte.
          </h2>
          <p className="text-muted-foreground mt-3 mb-9">Ingresá a tu espacio de cuidado.</p>
          <form onSubmit={vm.submit} className="space-y-6" noValidate>
            <div className="space-y-2.5">
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                autoComplete="username"
                placeholder="Tu usuario"
                className="h-12"
                aria-invalid={!!vm.form.formState.errors.username}
                aria-describedby="username-error"
                {...vm.form.register('username')}
              />
              <p id="username-error" className="field-error">
                {vm.form.formState.errors.username?.message}
              </p>
            </div>
            <div className="space-y-2.5">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  autoComplete="current-password"
                  type={vm.visible ? 'text' : 'password'}
                  placeholder="Tu contraseña"
                  className="h-12 pr-12"
                  aria-invalid={!!vm.form.formState.errors.password}
                  aria-describedby="password-error"
                  {...vm.form.register('password')}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={vm.toggleVisible}
                  aria-label={vm.visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {vm.visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p id="password-error" className="field-error">
                {vm.form.formState.errors.password?.message}
              </p>
            </div>
            {vm.error ? (
              <p role="alert" className="field-error">
                {vm.error}
              </p>
            ) : null}
            <Button
              type="submit"
              className="h-12 w-full justify-between px-5"
            >
              Ingresar a mi espacio <ArrowRight size={17} />
            </Button>
          </form>
          <div className="login-local-note">
            <span className="status-dot" /> Acceso de prueba · Datos en este navegador
          </div>
        </div>
        <p className="login-footer">Hecho para cuidar lo que más importa.</p>
      </section>
    </main>
  )
}
