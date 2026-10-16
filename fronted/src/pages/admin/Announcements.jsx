import { useCallback, useEffect, useState } from 'react'
import { api } from '../../services/api.js'
import { Busy, Notice } from '../../components/Feedback.jsx'
import { date } from '../../utils/format.js'

export default function AdminAnnouncements() {
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const load = useCallback(async () => {
    setBusy(true); setError('')
    try { const result = await api.get('/admin/announcements'); setRows(result.announcements || []) }
    catch (e) { setError(e.message || 'Could not load announcements.') }
    finally { setBusy(false) }
  }, [])
  useEffect(() => { load() }, [load])
  async function create(event) {
    event.preventDefault()
    if (submitting) return
    const form = event.currentTarget; const data = new FormData(form)
    setSubmitting(true); setError(''); setNotice('')
    try { await api.post('/admin/announcements', { title: data.get('title'), body: data.get('body') }); form.reset(); setNotice('Announcement saved as a draft.'); await load() }
    catch (e) { setError(e.message || 'Could not save announcement.') }
    finally { setSubmitting(false) }
  }
  async function action(id, publish) {
    setError(''); setNotice('')
    try { if (publish) await api.patch(`/admin/announcements/${id}/publish`, {}); else await api.delete(`/admin/announcements/${id}`); setNotice(publish ? 'Announcement published.' : 'Announcement deleted.'); await load() }
    catch (e) { setError(e.message || 'Could not update announcement.') }
  }
  return <section className="section admin announcements-page">
    <div className="section-heading"><div><p className="eyebrow">PLACEMENT OFFICE</p><h1>Announcements</h1><p className="muted">Draft and publish updates for authenticated students.</p></div></div>
    <Notice error={error}/><Notice>{notice}</Notice>
    <div className="admin-columns"><div><h2>Recent announcements</h2>{busy ? <Busy/> : rows.length ? <div className="announcement-list">{rows.map((item) => <article className="panel announcement-card" key={item._id}><div className="announcement-meta"><span className={`tag ${item.publishedAt ? '' : 'tag-draft'}`}>{item.publishedAt ? `Published ${date(item.publishedAt)}` : 'Draft'}</span><div className="table-actions">{!item.publishedAt && <button type="button" onClick={() => action(item._id, true)}>Publish</button>}<button type="button" className="danger-link" onClick={() => action(item._id, false)}>Delete</button></div></div><h3>{item.title}</h3><p>{item.body}</p></article>)}</div> : <div className="state">No announcements yet. Create a draft to get started.</div>}</div>
      <form className="panel form-stack" onSubmit={create}><h2>Create announcement</h2><label>Title<input name="title" maxLength="160" required/></label><label>Message<textarea name="body" rows="8" maxLength="10000" required/></label><button className="button" disabled={submitting}>{submitting ? 'Saving…' : 'Save draft'}</button></form>
    </div>
    {error && <button type="button" className="button ghost" onClick={load}>Retry list</button>}
  </section>
}
