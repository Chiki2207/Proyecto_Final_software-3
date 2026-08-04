import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { requestPasswordReset } from '@/services/fincomer'
import { Alert, Button, Input } from '@/components/ui'

export function RecoverPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await requestPasswordReset(email)
      setOk(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el correo')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bank-login">
      <header className="bank-login__header">
        <Link to="/login" className="bank-brand">
          <span className="bank-brand__mark">
            <img src="/fincomer-emblem.png" alt="" className="fincomer-emblem" />
          </span>
          <span className="bank-brand__copy">
            <strong>Fincomer</strong>
            <small>Cooperativa Financiera</small>
          </span>
        </Link>
        <div className="bank-login__help">
          <span>
            <ShieldCheck size={16} /> Sitio seguro
          </span>
        </div>
      </header>

      <main className="bank-login__main">
        <section className="bank-login__hero">
          <div className="bank-login__hero-content">
            <span className="bank-login__label">Recuperación de acceso</span>
            <h1>Restablece tu contraseña con seguridad.</h1>
            <p>Te enviaremos un enlace al correo registrado para crear una nueva clave.</p>
            <div className="bank-login__assurance">
              <ShieldCheck size={18} />
              <span>Proceso cifrado · Sin compartir claves</span>
            </div>
          </div>
        </section>

        <section className="bank-login__access">
          <form className="bank-access-card" onSubmit={(e) => void onSubmit(e)}>
            <div className="bank-access-card__heading">
              <span className="bank-access-card__icon">
                <ShieldCheck size={21} />
              </span>
              <div>
                <p>Acceso seguro</p>
                <h2>Recuperar contraseña</h2>
              </div>
            </div>

            <p className="bank-access-card__description">
              Ingresa el correo de tu cuenta digital Fincomer.
            </p>

            <label className="bank-field">
              <span>Correo electrónico</span>
              <div className="bank-input bank-input--plain">
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre@correo.com"
                />
              </div>
            </label>

            {error ? (
              <Alert tone="danger" role="alert">
                {error}
              </Alert>
            ) : null}
            {ok ? (
              <Alert tone="ok" role="status">
                Revisa tu bandeja de correo para continuar.
              </Alert>
            ) : null}

            <Button type="submit" disabled={busy} className="btn--block bank-submit">
              {busy ? 'Enviando…' : 'Enviar enlace'}
              {!busy ? <ArrowRight size={18} /> : null}
            </Button>

            <Link className="bank-register-link" to="/login">
              Volver al inicio de sesión
            </Link>
          </form>
        </section>
      </main>

      <footer className="bank-login__footer">
        <span>© 2026 Cooperativa Financiera Fincomer</span>
        <nav>
          <a href="#seguridad">Seguridad</a>
          <a href="#privacidad">Privacidad</a>
          <a href="#terminos">Términos</a>
        </nav>
      </footer>
    </div>
  )
}
