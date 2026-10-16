import { useCallback, useEffect, useState } from 'react'
import { api } from '../../services/api.js'
import { Busy, Notice } from '../../components/Feedback.jsx'
import { date } from '../../utils/format.js'

export default function StudentAnnouncements() {
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setBusy(true); setError('')
    try { const result = await api.get('/students/announcements'); setRows(result.announcements || []) }
    catch (e) { setError(e.message || 'Could not load announcements.') }
    finally { setBusy(false) }
  }, [])
  useEffect(() => { load() }, [load])
  return <section className="section announcements-page">
    <div className="section-heading"><div><p className="eyebrow">PLACEMENT OFFICE</p><h1>Announcements</h1><p className="muted">Updates and important information from your placement office.</p></div></div>
    {error && <><Notice error={error}/><button type="button" className="button" onClick={load}>Retry</button></>}
    {busy ? <Busy/> : !error && (rows.length ? <div className="announcement-list">{rows.map((item) => <article className="panel announcement-card" key={item._id}><div className="announcement-date">Published {date(item.publishedAt)}</div><h2>{item.title}</h2><p>{item.body}</p></article>)}</div> : <div className="state">There are no announcements yet. Check back later.</div>)}
  </section>
}
