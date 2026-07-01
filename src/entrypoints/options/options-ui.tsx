import type React from "react"

export type ToastState = {
  message: string
  type: "success" | "error"
}

export function SettingsSection({
  action,
  children,
  description,
  title,
}: {
  action?: React.ReactNode
  children: React.ReactNode
  description?: string
  title: string
}) {
  return (
    <section className="settings-section">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function EmptyState({ description, title }: { description: string; title: string }) {
  return (
    <section className="empty-state">
      <strong>{title}</strong>
      <p>{description}</p>
    </section>
  )
}

export function Toast({ toast }: { toast: ToastState }) {
  return (
    <aside className={`settings-toast ${toast.type}`} role="status" aria-live="polite">
      {toast.message}
    </aside>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function SwitchField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="switch-field">
      <span className="switch-copy">
        <strong>{label}</strong>
        <span>{description}</span>
      </span>
      <span className="switch-control">
        <input
          aria-label={label}
          type="checkbox"
          checked={checked}
          onChange={event => onChange(event.target.checked)}
        />
        <span aria-hidden="true" />
      </span>
    </label>
  )
}
