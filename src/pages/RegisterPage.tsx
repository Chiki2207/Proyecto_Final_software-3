import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Alert, Button, Input } from '@/components/ui'

export function RegisterPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [documentNumber, setDocumentNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)

    const { error: signUpError } = await signUp({
      email,
      password,
      fullName,
      documentNumber,
      phone,
    })
    setBusy(false)

    if (signUpError) {
      setError(signUpError)
      return
    }

    navigate('/dashboard', { replace: true })
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
            <span className="bank-login__label">Registro de asociado</span>
            <h1>Abre tu acceso digital en minutos.</h1>
            <p>
              Con tu documento puedes crear tu perfil, obtener tu cuenta de ahorros y operar en línea.
            </p>
            <div className="bank-login__assurance">
              <ShieldCheck size={18} />
              <span>Datos protegidos · Validación segura</span>
            </div>
          </div>
        </section>

        <section className="bank-login__access">
          <form className="bank-access-card" onSubmit={(e) => void onSubmit(e)}>
            <div className="bank-access-card__heading">
              <span className="bank-access-card__icon">
                <Building2 size={21} />
              </span>
              <div>
                <p>Nuevo asociado</p>
                <h2>Crear acceso digital</h2>
              </div>
            </div>

            <p className="bank-access-card__description">
              Completa tus datos. Te asignaremos perfil, rol y productos iniciales.
            </p>

            <label className="bank-field">
              <span>Nombre completo</span>
              <div className="bank-input bank-input--plain">
                <Input
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Como aparece en tu documento"
                />
              </div>
            </label>

            <div className="bank-field-row">
              <label className="bank-field">
                <span>Documento</span>
                <div className="bank-input bank-input--plain">
                  <Input
                    required
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    placeholder="Número de documento"
                  />
                </div>
              </label>
              <label className="bank-field">
                <span>Teléfono</span>
                <div className="bank-input bank-input--plain">
                  <Input
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="300 000 0000"
                  />
                </div>
              </label>
            </div>

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

            <label className="bank-field">
              <span>Contraseña</span>
              <div className="bank-input bank-input--plain">
                <Input
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            </label>

            {error ? (
              <Alert tone="danger" role="alert">
                {error}
              </Alert>
            ) : null}

            <Button type="submit" disabled={busy} className="btn--block bank-submit">
              {busy ? 'Creando…' : 'Crear cuenta'}
              {!busy ? <ArrowRight size={18} /> : null}
            </Button>

            <div className="bank-access-card__divider">
              <span>¿Ya tienes acceso?</span>
            </div>

            <Link className="bank-register-link" to="/login">
              Iniciar sesión
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
