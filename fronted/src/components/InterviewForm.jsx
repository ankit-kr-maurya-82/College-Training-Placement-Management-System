import { useId, useRef, useState } from 'react'
import { CalendarDays, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '../services/api.js'

const slotMinutes = 30
const durations = [15, 30, 45, 60, 90, 120]

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function monthStart(date) { return new Date(date.getFullYear(), date.getMonth(), 1) }

function timeKey(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function initialSlot() {
  const now = new Date()
  const minutes = now.getMinutes()
  const rounded = Math.ceil((minutes + 1) / slotMinutes) * slotMinutes
  now.setMinutes(rounded, 0, 0)
  if (now.getHours() < 9) now.setHours(9, 0, 0, 0)
  if (now.getHours() >= 17) return ''
  return timeKey(now)
}

function newRequestId() {
  return globalThis.crypto?.randomUUID?.() || `interview-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function slotsForDate(date, selectedTime) {
  const slots = []
  for (let minutes = 9 * 60; minutes < 17 * 60; minutes += slotMinutes) {
    slots.push(`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`)
  }
  if (selectedTime && !slots.includes(selectedTime)) slots.push(selectedTime)
  const today = new Date()
  const todayKey = dateKey(today)
  return slots.sort().map((time) => ({
    time,
    unavailable: date < todayKey || (date === todayKey && new Date(`${date}T${time}:00`) <= today),
  }))
}

function calendarDays(month) {
  const startOffset = month.getDay()
  const dayCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cellCount = Math.ceil((startOffset + dayCount) / 7) * 7
  return Array.from({ length: cellCount }, (_, index) => {
    const day = index - startOffset + 1
    return day >= 1 && day <= dayCount ? day : null
  })
}

export default function InterviewForm({ applications = [], interview, onSaved }) {
  const id = useId()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const initialStart = interview?.startAt ? new Date(interview.startAt) : null
  const initialEnd = interview?.endAt ? new Date(interview.endAt) : null
  const initialDuration = initialStart && initialEnd ? Math.round((initialEnd - initialStart) / 60_000) : 60
  const durationOptions = [...new Set([...durations, ...(initialDuration > 0 ? [initialDuration] : [])])].sort((a, b) => a - b)
  const [applicationId, setApplicationId] = useState(interview?.application?._id || interview?.application || '')
  const [selectedDate, setSelectedDate] = useState(dateKey(initialStart || new Date()))
  const [selectedTime, setSelectedTime] = useState(initialStart ? timeKey(initialStart) : initialSlot())
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(initialStart || new Date()))
  const [duration, setDuration] = useState(initialDuration > 0 ? initialDuration : 60)
  const [mode, setMode] = useState(interview?.mode || 'ONLINE')
  const [meetingLink, setMeetingLink] = useState(interview?.meetingLink || '')
  const [venue, setVenue] = useState(interview?.venue || '')
  const [instructions, setInstructions] = useState(interview?.instructions || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const requestId = useRef('')

  function choose(setter, value) {
    requestId.current = ''
    setter(value)
  }

  function edited(setter) {
    return (event) => choose(setter, event.target.value)
  }

  function moveMonth(amount) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1))
  }

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setError('')
    if (!selectedDate || !selectedTime) {
      setError('Choose an interview date and start time.')
      return
    }
    const start = new Date(`${selectedDate}T${selectedTime}:00`)
    const end = new Date(start.getTime() + Number(duration) * 60_000)
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      setError('Choose a valid interview date and time.')
      return
    }
    if (start <= new Date()) {
      setError('Choose an interview time in the future.')
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

  const monthLabel = visibleMonth.toLocaleDateString([], { month: 'long', year: 'numeric' })
  const todayKey = dateKey(new Date())
  const slots = slotsForDate(selectedDate, selectedTime)

  return <form className="form-stack interview-form" onSubmit={submit}>
    {!interview && <label htmlFor={`${id}-application`}>Student application
      <select id={`${id}-application`} required value={applicationId} onChange={edited(setApplicationId)}>
        <option value="">Choose an applicant…</option>
        {applications.map((application) => <option key={application._id} value={application._id}>{application.student?.name || 'Student'} · {application.drive?.title || 'Drive'} · {application.status}</option>)}
      </select>
    </label>}

    <div className="interview-booking-picker">
      <section className="interview-calendar-panel" aria-labelledby={`${id}-calendar-title`}>
        <div className="interview-calendar-topline"><span className="interview-calendar-icon"><CalendarDays size={20} aria-hidden="true"/></span><span>{timeZone}</span></div>
        <div className="interview-calendar-heading">
          <h3 id={`${id}-calendar-title`}>{monthLabel}</h3>
          <div><button type="button" aria-label="Previous month" disabled={visibleMonth.getFullYear() === new Date().getFullYear() && visibleMonth.getMonth() === new Date().getMonth()} onClick={() => moveMonth(-1)}><ChevronLeft size={19}/></button><button type="button" aria-label="Next month" onClick={() => moveMonth(1)}><ChevronRight size={19}/></button></div>
        </div>
        <div className="interview-calendar-grid" aria-labelledby={`${id}-calendar-title`}>
          {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((day) => <span className="interview-weekday" key={day}><span aria-hidden="true">{day.slice(0, 2)}</span><span className="sr-only">{day}</span></span>)}
          {calendarDays(visibleMonth).map((day, index) => {
            if (!day) return <span className="interview-calendar-blank" aria-hidden="true" key={`blank-${index}`}/>
            const key = dateKey(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day))
            const disabled = key < todayKey
            return <button type="button" key={key} aria-label={new Date(`${key}T12:00:00`).toLocaleDateString([], { dateStyle: 'full' })} aria-pressed={key === selectedDate} className={`${key === selectedDate ? 'selected' : ''} ${key === todayKey ? 'today' : ''}`} disabled={disabled} onClick={() => { choose(setSelectedDate, key); if (key !== selectedDate) choose(setSelectedTime, slotsForDate(key, '').find((slot) => !slot.unavailable)?.time || '') }}>{day}</button>
          })}
        </div>
      </section>

      <section className="interview-time-panel" aria-labelledby={`${id}-time-title`}>
        <h3 id={`${id}-time-title`}>Select Time</h3>
        <p>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</p>
        <p className="interview-time-note">Suggested 30-minute increments. Availability is not checked.</p>
        <div className="interview-time-options" role="group" aria-label="Suggested interview start times">
          {slots.map(({ time, unavailable }) => <button type="button" key={time} disabled={unavailable} aria-pressed={selectedTime === time} className={selectedTime === time ? 'selected' : ''} onClick={() => choose(setSelectedTime, time)}>{new Date(`2025-01-01T${time}:00`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</button>)}
        </div>
        {!slots.some((slot) => !slot.unavailable) && <p className="interview-no-slots">No suggested times remain today. Choose another date or enter a custom time.</p>}
        <label htmlFor={`${id}-custom-time`}>Or enter a custom time<input id={`${id}-custom-time`} type="time" step="60" value={selectedTime} onChange={edited(setSelectedTime)}/></label>
        <label htmlFor={`${id}-duration`}>Duration
          <select id={`${id}-duration`} value={duration} onChange={edited(setDuration)}>{durationOptions.map((minutes) => <option value={minutes} key={minutes}>{minutes} minutes</option>)}</select>
        </label>
      </section>
    </div>

    {selectedDate && selectedTime && <p className="interview-slot-confirmation" role="status"><Check size={17} aria-hidden="true"/> Selected: {new Date(`${selectedDate}T12:00:00`).toLocaleDateString([], { dateStyle: 'medium' })} at {new Date(`2025-01-01T${selectedTime}:00`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {duration} minutes</p>}

    <div className="interview-form-details">
      <label htmlFor={`${id}-mode`}>Interview mode
        <select id={`${id}-mode`} value={mode} onChange={edited(setMode)}>
          <option value="ONLINE">Online</option><option value="OFFLINE">In person</option><option value="PHONE">Phone</option>
        </select>
      </label>
      {mode === 'ONLINE' && <label htmlFor={`${id}-link`}>HTTPS meeting link<input id={`${id}-link`} type="url" required placeholder="https://…" value={meetingLink} onChange={edited(setMeetingLink)}/></label>}
      {mode === 'OFFLINE' && <label htmlFor={`${id}-venue`}>Interview venue<input id={`${id}-venue`} required maxLength="500" value={venue} onChange={edited(setVenue)}/></label>}
      <label htmlFor={`${id}-instructions`}>Instructions (optional)<textarea id={`${id}-instructions`} rows="3" maxLength="4000" value={instructions} onChange={edited(setInstructions)}/></label>
    </div>
    {error && <p className="notice error" role="alert">{error}</p>}
    <button className="button interview-submit" type="submit" disabled={busy || (!interview && applications.length === 0) || !selectedTime}>{busy ? 'Saving…' : interview ? 'Save new interview time' : 'Schedule interview'}</button>
  </form>
}
