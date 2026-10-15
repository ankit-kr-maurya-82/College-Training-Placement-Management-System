import { useEffect, useState } from 'react'
import { api } from '../../services/api.js'

export default function StudentProfile() {
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({ name: '', phone: '', department: '', course: '', graduationYear: '', cgpa: '', skills: '', resumeUrl: '' })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    api.get('/students/me/profile')
      .then(({ student }) => {
        setProfile(student)
        setForm({ name: student.name || '', phone: student.phone || '', department: student.department || '', course: student.course || '', graduationYear: student.graduationYear ?? '', cgpa: student.cgpa ?? '', skills: (student.skills || []).join(', '), resumeUrl: student.resumeUrl || '' })
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false))
  }, [])

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
    setError('')
    setNotice('')
  }

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    const payload = {
      name: form.name,
      phone: form.phone,
      department: form.department,
      course: form.course,
      graduationYear: form.graduationYear === '' ? null : Number(form.graduationYear),
      cgpa: form.cgpa === '' ? null : Number(form.cgpa),
      skills: form.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
      resumeUrl: form.resumeUrl,
    }
    try {
      const response = await api.put('/students/me/profile', payload)
      setProfile(response.student)
      setForm((current) => ({ ...current, skills: response.student.skills.join(', ') }))
      setNotice(response.message || 'Profile saved successfully.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return <section className="admin">
    <div className="dashboard-heading"><div><p className="eyebrow">STUDENT PORTAL</p><h1>My profile</h1><p className="muted">Keep your academic and contact details up to date.</p></div></div>
    {error && <div className="notice error" role="alert">{error}</div>}
    {notice && <div className="notice" role="status">{notice}</div>}
    {loading ? <div className="state" role="status">Loading your profile…</div> : profile ? <div className="panel profile-card">
      <p className="muted">Account email: <b>{profile.email}</b></p>
      <form className="form-stack" onSubmit={save}>
        <label>Full name<input name="name" autoComplete="name" maxLength="120" required value={form.name} onChange={updateField} /></label>
        <div className="form-pair">
          <label>Phone<input name="phone" type="tel" autoComplete="tel" maxLength="24" value={form.phone} onChange={updateField} /></label>
          <label>Department<input name="department" maxLength="100" value={form.department} onChange={updateField} /></label>
        </div>
        <div className="form-pair">
          <label>Course<input name="course" maxLength="100" value={form.course} onChange={updateField} /></label>
          <label>Graduation year<input name="graduationYear" type="number" min="1900" max={new Date().getFullYear() + 10} step="1" value={form.graduationYear} onChange={updateField} /></label>
        </div>
        <div className="form-pair">
          <label>CGPA<input name="cgpa" type="number" min="0" max="10" step="0.01" value={form.cgpa} onChange={updateField} /></label>
          <label>Skills <small>Separate skills with commas.</small><input name="skills" maxLength="1600" value={form.skills} onChange={updateField} /></label>
        </div>
        <label>Resume URL<input name="resumeUrl" type="url" placeholder="https://…" maxLength="2048" value={form.resumeUrl} onChange={updateField} /><small>Use a secure HTTPS link. File uploads are not supported here.</small></label>
        <div className="form-actions"><button className="button" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button></div>
      </form>
    </div> : <div className="state">Your profile could not be loaded.</div>}
  </section>
}
