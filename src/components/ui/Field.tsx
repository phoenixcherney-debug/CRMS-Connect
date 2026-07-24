import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useId } from 'react'

const CONTROL =
  'w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20 disabled:opacity-60'

interface FieldShellProps {
  label: string
  hint?: string
  error?: string | null
  required?: boolean
  children: (id: string, describedBy: string | undefined) => ReactNode
}

/** Label + control + hint/error wiring; every form control renders through this. */
function FieldShell({ label, hint, error, required, children }: FieldShellProps) {
  const id = useId()
  const hintId = hint || error ? `${id}-hint` : undefined
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {required && <span className="text-clay" aria-hidden> *</span>}
      </label>
      {children(id, hintId)}
      {error ? (
        <p id={hintId} className="text-sm text-danger">{error}</p>
      ) : hint ? (
        <p id={hintId} className="text-sm text-faint">{hint}</p>
      ) : null}
    </div>
  )
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string | null
}

export function TextField({ label, hint, error, required, className = '', ...rest }: TextFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required}>
      {(id, describedBy) => (
        <input id={id} aria-describedby={describedBy} aria-invalid={!!error} required={required} className={`${CONTROL} ${className}`} {...rest} />
      )}
    </FieldShell>
  )
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  hint?: string
  error?: string | null
}

export function TextAreaField({ label, hint, error, required, className = '', rows = 5, ...rest }: TextAreaFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required}>
      {(id, describedBy) => (
        <textarea id={id} aria-describedby={describedBy} aria-invalid={!!error} required={required} rows={rows} className={`${CONTROL} resize-y ${className}`} {...rest} />
      )}
    </FieldShell>
  )
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  hint?: string
  error?: string | null
  children: ReactNode
}

export function SelectField({ label, hint, error, required, className = '', children, ...rest }: SelectFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required}>
      {(id, describedBy) => (
        <select id={id} aria-describedby={describedBy} required={required} className={`${CONTROL} ${className}`} {...rest}>
          {children}
        </select>
      )}
    </FieldShell>
  )
}
