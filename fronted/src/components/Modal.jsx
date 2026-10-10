import { useEffect } from 'react'

export default function Modal({ open, title, children, onClose, actions }) {
  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.() }}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-heading"><h2 id="modal-title">{title}</h2><button type="button" className="button ghost" onClick={onClose} aria-label="Close dialog">×</button></div>
      <div>{children}</div>
      {actions && <div className="modal-actions">{actions}</div>}
    </section>
  </div>
}
