import { useId, useRef, useState } from 'react'
import { api } from '../services/api.js'

function localInputValue(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function newRequestId() {
  return globalThis.crypto?.randomUUID?.() || `interview-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function InterviewForm({ applications = [], interview, onSaved }) {
  const id = useId()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const [applicationId, setApplicationId] = useState(interview?.application?._id || interview?.application || '')
  const [startAt, setStartAt] = useState(localInputValue(interview?.startAt))
  const [endAt, setEndAt] = useState(localInputValue(interview?.endAt))
  const [mode, setMode] = useState(interview?.mode || 'ONLINE')
  const [meetingLink, setMeetingLink] = useState(interview?.meetingLink || '')
  const [venue, setVenue] = useState(interview?.venue || '')
  const [instructions, setInstructions] = useState(interview?.instructions || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const requestId = useRef('')

  function edited(setter) {
    return (event) => {
      requestId.current = ''
      setter(event.target.value)
    }
  }

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setError('')
    const start = new Date(startAt)
    const end = new Date(endAt)
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      setError('Enter both an interview start and end time.')
      return
    }
    if (end <= start) {
      setError('The end time must be later than the start time.')
      return
    }
    if (!interview && !applicationId) {
      setError('Choose an application before scheduling an interview.')
      return
    }
    requestId.current ||= newRequestId()
    const body = {
      ...(interview ? {} : { applicationId }),
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      timeZone,
      mode,
      ...(mode === 'ONLINE' ? { meetingLink: meetingLink.trim() } : {}),
      ...(mode === 'OFFLINE' ? { venue: venue.trim() } : {}),
      ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
    }
    setBusy(true)
    try {
      const config = { headers: { 'Idempotency-Key': requestId.current } }
      const result = interview
        ? await api.patch(`/companies/me/interviews/${interview._id}/reschedule`, body, config)
        : await api.post('/companies/me/interviews', body, config)
      requestId.current = ''
      onSaved?.(result)
    } catch (requestError) {
      setError(requestError.message || 'Interview could not be saved. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return <form className="form-stack interview-form" onSubmit={submit}>
    {!interview && <label htmlFor={`${id}-application`}>Student application
      <select id={`${id}-application`} required value={applicationId} onChange={edited(setApplicationId)}>
        <option value="">Choose an applicant…</option>
        {applications.map((application) => <option key={application._id} value={application._id}>{application.student?.name || 'Student'} · {application.drive?.title || 'Drive'} · {application.status}</option>)}
      </select>
    </label>}
    <div className="form-pair">
      <label htmlFor={`${id}-start`}>Start time ({timeZone})<input id={`${id}-start`} type="datetime-local" required value={startAt} onChange={edited(setStartAt)}/></label>
      <label htmlFor={`${id}-end`}>End time ({timeZone})<input id={`${id}-end`} type="datetime-local" required value={endAt} onChange={edited(setEndAt)}/></label>
    </div>
    <label htmlFor={`${id}-mode`}>Interview mode
      <select id={`${id}-mode`} value={mode} onChange={edited(setMode)}>
        <option value="ONLINE">Online</option><option value="OFFLINE">In person</option><option value="PHONE">Phone</option>
      </select>
    </label>
    {mode === 'ONLINE' && <label htmlFor={`${id}-link`}>HTTPS meeting link<input id={`${id}-link`} type="url" required placeholder="https://…" value={meetingLink} onChange={edited(setMeetingLink)}/></label>}
    {mode === 'OFFLINE' && <label htmlFor={`${id}-venue`}>Interview venue<input id={`${id}-venue`} required maxLength="500" value={venue} onChange={edited(setVenue)}/></label>}
    <label htmlFor={`${id}-instructions`}>Instructions (optional)<textarea id={`${id}-instructions`} rows="3" maxLength="4000" value={instructions} onChange={edited(setInstructions)}/></label>
    {error && <p className="notice error" role="alert">{error}</p>}
    <button className="button" type="submit" disabled={busy || (!interview && applications.length === 0)}>{busy ? 'Saving…' : interview ? 'Save new interview time' : 'Schedule interview'}</button>
  </form>
}
