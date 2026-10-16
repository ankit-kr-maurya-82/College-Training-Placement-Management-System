import { useEffect, useId, useRef, useState } from 'react'
import { UserRound } from 'lucide-react'
import { api } from '../services/api.js'
import './ProfilePictureUpload.css'

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const configuredMaxBytes = Number(import.meta.env.VITE_PROFILE_PICTURE_MAX_BYTES)
const maxBytes = Number.isSafeInteger(configuredMaxBytes) && configuredMaxBytes > 0 ? Math.min(configuredMaxBytes, 10 * 1024 * 1024) : 2 * 1024 * 1024
const maxMegabytes = Number((maxBytes / (1024 * 1024)).toFixed(2))

export default function ProfilePictureUpload({ endpoint, imageUrl, onUploaded }) {
  const inputId = useId()
  const inputRef = useRef(null)
  const previewRef = useRef('')
  const submitting = useRef(false)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
  }, [])

  function clearPreview() {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = ''
    setPreview('')
  }

  function chooseFile(event) {
    const selected = event.target.files?.[0]
    setError('')
    setNotice('')
    setProgress(0)
    if (!selected) return
    if (!allowedTypes.has(selected.type)) {
      setFile(null); clearPreview(); event.target.value = ''
      setError('Choose a JPEG, PNG, or WebP image.')
      return
    }
    if (selected.size > maxBytes) {
      setFile(null); clearPreview(); event.target.value = ''
      setError(`The image must be ${maxMegabytes} MB or smaller.`)
      return
    }
    clearPreview()
    const objectUrl = URL.createObjectURL(selected)
    previewRef.current = objectUrl
    setPreview(objectUrl)
    setFile(selected)
  }

  async function upload(event) {
    event.preventDefault()
    if (!file || submitting.current) return
    submitting.current = true
    setBusy(true); setError(''); setNotice(''); setProgress(0)
    const body = new FormData()
    body.append('profilePicture', file)
    try {
      const result = await api.post(endpoint, body, {
        onUploadProgress: (uploadEvent) => {
          if (uploadEvent.total) setProgress(Math.round((uploadEvent.loaded / uploadEvent.total) * 100))
        },
      })
      clearPreview()
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
      onUploaded(result.student?.profilePictureUrl || result.company?.profilePictureUrl || '')
      setNotice(result.message || 'Profile picture updated.')
    } catch (requestError) {
      setError(requestError.message || 'Profile picture upload failed. Please try again.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  const currentImage = preview || imageUrl
  return <section className="profile-picture-upload" aria-label="Profile picture">
    <div className="profile-picture-preview">
      {currentImage ? <img src={currentImage} alt="Profile picture preview" /> : <UserRound size={42} strokeWidth={1.4} aria-label="Default profile avatar" />}
    </div>
    <form className="profile-picture-controls" onSubmit={upload}>
      <p className="eyebrow">PROFILE PICTURE</p>
      <p className="muted">JPEG, PNG, or WebP · up to {maxMegabytes} MB</p>
      <label className="button ghost profile-picture-picker" htmlFor={inputId}>{file ? 'Choose a different image' : 'Choose image'}</label>
      <input ref={inputRef} className="profile-picture-input" id={inputId} aria-label="Choose a profile picture" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseFile} disabled={busy} />
      {file && <button className="button" type="submit" disabled={busy}>{busy ? 'Uploading…' : 'Upload picture'}</button>}
      {busy && <div className="profile-picture-progress" role="status"><progress max="100" value={progress} aria-label="Upload progress"/><span>{progress}%</span></div>}
      {error && <p className="notice error" role="alert">{error}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
    </form>
  </section>
}
