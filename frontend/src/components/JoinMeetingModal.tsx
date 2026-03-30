import { useState, useEffect, useRef } from 'react'
import type { Project, BotStatusResponse } from '../types'
import * as api from '../api'

interface Props {
  projectId: string
  onJoined: (meetingId: string, title: string) => void
  onClose: () => void
}

const STATUS_COLOR: Record<string, string> = {
  joining:   'var(--warning)',
  recording: 'var(--processing)',
  done:      'var(--success)',
  failed:    'var(--error)',
}

export default function JoinMeetingModal({ projectId, onJoined, onClose }: Props) {
  const [projects, setProjects]               = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState(projectId)
  const [title, setTitle]                     = useState('')
  const [meetingUrl, setMeetingUrl]           = useState('')
  const [loading, setLoading]                 = useState(false)
  const [error, setError]                     = useState('')
  const [dispatched, setDispatched]           = useState(false)
  const [botStatus, setBotStatus]             = useState<BotStatusResponse | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    api.fetchProjects().then(setProjects).catch(() => {})
  }, [])

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const startPolling = (meetingId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const status = await api.fetchBotStatus(meetingId)
        setBotStatus(status)
        if (status.meeting_status === 'done' || status.bot_status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current)
        }
      } catch { /* ignore */ }
    }, 10000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !meetingUrl.trim()) return
    setLoading(true)
    setError('')
    try {
      const response = await api.joinMeeting({
        project_id: selectedProjectId,
        title: title.trim(),
        meeting_url: meetingUrl.trim(),
      })
      setDispatched(true)
      onJoined(response.meeting_id, title.trim())
      startPolling(response.meeting_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dispatch bot')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Join Live Meeting</div>

        {!dispatched ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Meeting title *</label>
              <input
                className="form-input"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Sprint 15 Planning"
                autoFocus
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Meeting URL *</label>
              <input
                className="form-input"
                value={meetingUrl}
                onChange={e => setMeetingUrl(e.target.value)}
                placeholder="Paste Teams or Google Meet link"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Project *</label>
              <select
                className="form-input"
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
                required
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {error && <div className="error-msg">{error}</div>}

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !title.trim() || !meetingUrl.trim()}
              >
                {loading ? 'Dispatching bot…' : 'Dispatch Bot'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ color: 'var(--success)', fontSize: 14 }}>
              ✅ Bot is joining the meeting. MOM will appear here when the call ends.
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>Bot status:</span>
              {botStatus ? (
                <>
                  <span style={{
                    background: STATUS_COLOR[botStatus.bot_status ?? ''] ?? 'var(--surface2)',
                    color: '#fff',
                    padding: '2px 10px',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                  }}>
                    {botStatus.bot_status ?? 'unknown'}
                  </span>
                  {botStatus.meeting_status === 'done' && (
                    <span style={{ color: 'var(--success)', fontSize: 13 }}>— MOM ready!</span>
                  )}
                </>
              ) : (
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>waiting…</span>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={onClose}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
