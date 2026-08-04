import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="lede">{description}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  )
}

export function Panel({
  title,
  children,
  footer,
  className = '',
}: {
  title?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  return (
    <section className={`panel ${className}`.trim()}>
      {title ? (
        <div className="panel__heading">
          <h2 className="panel__title">{title}</h2>
          <span className="panel__heading-line" />
        </div>
      ) : null}
      <div className="panel__body">{children}</div>
      {footer ? <div className="panel__footer">{footer}</div> : null}
    </section>
  )
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'soft'
}) {
  return (
    <button
      className={`btn btn--${variant} ${className}`.trim()}
      type="button"
      {...props}
    />
  )
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string | null
  children: ReactNode
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint ? <span className="field__hint">{hint}</span> : null}
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="input" {...props} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="input input--area" {...props} />
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'info'
}) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
    </div>
  )
}

export function Stat({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: string
  hint?: string
  icon?: ReactNode
}) {
  return (
    <article className="stat">
      <div className="stat__top">
        <p className="stat__label">{label}</p>
        {icon ? <span className="stat__icon">{icon}</span> : null}
      </div>
      <p className="stat__value">{value}</p>
      {hint ? <p className="stat__hint">{hint}</p> : null}
    </article>
  )
}

export function Alert({
  children,
  tone = 'info',
  role = 'status',
}: {
  children: ReactNode
  tone?: 'info' | 'ok' | 'danger'
  role?: 'status' | 'alert'
}) {
  return (
    <div className={`alert alert--${tone}`} role={role}>
      {children}
    </div>
  )
}

export function LoadingBlock({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="loading-block">
      <span className="spinner" aria-hidden />
      <p>{label}</p>
    </div>
  )
}
