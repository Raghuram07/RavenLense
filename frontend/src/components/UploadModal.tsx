import { useState } from 'react'
import type { Meeting } from '../types'
import * as api from '../api'

interface Props {
  projectId: string
  onUploaded: (m: Meeting) => void
  onClose: () => void
}

export default function UploadModal({ projectId, onUploaded, onClose }: Props) {
  const [title, setTitle] = useState('')
  const [platform, setPlatform] = useState('')
  const [meetingDate, setMeetingDate] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !file) return
    setLoading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('project_id', projectId)
      form.append('title', title.trim())
      if (platform) form.append('platform', platform)
      if (meetingDate) form.append('meeting_date', meetingDate)
      form.append('vtt_file', file)
      const meeting = await api.uploadMeeting(form)
      onUploaded(meeting)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Upload Meeting Transcript</div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Meeting title *</label>
            <input
              className="form-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Sprint 14 Review"
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Transcript file (.vtt or .docx) *</label>
            <input
              className="form-input"
              type="file"
              accept=".vtt,.docx"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Platform (optional)</label>
            <select
              className="form-input"
              value={platform}
              onChange={e => setPlatform(e.target.value)}
            >
              <option value="">— Select —</option>
              <option value="teams">Microsoft Teams</option>
              <option value="zoom">Zoom</option>
              <option value="meet">Google Meet</option>
              <option value="webex">Webex</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Meeting date (optional)</label>
            <input
              className="form-input"
              type="date"
              value={meetingDate}
              onChange={e => setMeetingDate(e.target.value)}
            />
          </div>

          {error && <div className="error-msg">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !title.trim() || !file}
            >
              {loading ? 'Processing…' : 'Upload & Generate MOM'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
