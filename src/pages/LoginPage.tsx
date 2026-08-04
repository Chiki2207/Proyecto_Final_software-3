import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Alert, Button, Field, Input } from '@/components/ui'

export function LoginPage() {
  const { signIn, verifyMfa } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [mfaCode, setMfaCode] = useState('')
  const [needsMfa, setNeedsMfa] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)

    if (needsMfa) {
      const { error: mfaError } = await verifyMfa(mfaCode)
      setBusy(false)
      if (mfaError) {
        setError(mfaError)
        return
      }
      navigate('/dashboard', { replace: true })
      return
    }

    const result = await signIn({ email, password })
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    if (result.needsMfa) {
      setNeedsMfa(true)
      return
    }
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="bank-login">
      <header className="bank-login__header">
        <Link to="/" className="bank-brand">
          <span className="bank-brand__mark">
            <img src="/fincomer-emblem.png" alt="" className="fincomer-emblem" />
          </span>
          <span className="bank-brand__copy">
            <strong>Fincomer</strong>
            <small>Cooperativa Financiera</small>
          </span>
        </Link>
        <div className="bank-login__help">
          <span><ShieldCheck size={16} /> Sitio seguro</span>
        </div>
      </header>

      <main className="bank-login__main">
        <section className="bank-login__hero">
          <div className="bank-login__hero-content">
            <span className="bank-login__label">Banca digital para asociados</span>
            <h1>Tu bienestar financiero, siempre a tu alcance.</h1>
            <p>
              Consulta tus productos y realiza operaciones seguras desde cualquier lugar.
            </p>
            <div className="bank-login__assurance">
              <ShieldCheck size={18} />
              <span>Protección avanzada · Servicio disponible 24/7</span>
            </div>
          </div>
        </section>

        <section className="bank-login__access">
          <form className="bank-access-card" onSubmit={(e) => void onSubmit(e)}>
            <div className="bank-access-card__heading">
              <span className="bank-access-card__icon"><LockKeyhole size={21} /></span>
              <div>
                <p>Acceso seguro</p>
                <h2>{needsMfa ? 'Verifica tu identidad' : 'Ingresa a tu cuenta'}</h2>
              </div>
            </div>

            <p className="bank-access-card__description">
              {needsMfa
                ? 'Escribe el código de seis dígitos de tu aplicación autenticadora.'
                : 'Usa el correo y la contraseña registrados en Fincomer.'}
            </p>

            {!needsMfa ? (
              <>
                <label className="bank-field">
                  <span>Correo electrónico</span>
                  <div className="bank-input">
                    <Mail size={18} aria-hidden />
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
                <label className="bank-field">
                  <span>Contraseña</span>
                  <div className="bank-input">
                    <LockKeyhole size={18} aria-hidden />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Ingresa tu contraseña"
                    />
                    <button
                      type="button"
                      className="bank-input__toggle"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>
              </>
            ) : (
              <Field label="Código MFA (6 dígitos)">
                <Input
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  required
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="000000"
                />
              </Field>
            )}

            {!needsMfa ? (
              <Link className="bank-access-card__recover" to="/recuperar">
                ¿Olvidaste tu contraseña?
              </Link>
            ) : null}

            {error ? (
              <Alert tone="danger" role="alert">
                {error}
              </Alert>
            ) : null}

            <Button type="submit" disabled={busy} className="btn--block bank-submit">
              {busy ? 'Validando…' : needsMfa ? 'Verificar código' : 'Continuar'}
              {!busy ? <ArrowRight size={18} /> : null}
            </Button>

            <div className="bank-access-card__divider"><span>¿Aún no eres asociado digital?</span></div>

            <Link className="bank-register-link" to="/register">
              Crear acceso digital
            </Link>

            <p className="bank-access-card__legal">
              <ShieldCheck size={14} />
              Nunca te pediremos claves por llamadas o mensajes.
            </p>
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
