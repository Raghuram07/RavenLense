import { useState, useEffect } from 'react'
import type { Project, MeetingListItem, Meeting } from '../types'
import type { BotStatusResponse } from '../types'
import * as api from '../api'
import UploadModal from './UploadModal'
import JoinMeetingModal from './JoinMeetingModal'

interface Props {
  project: Project
  meetings: MeetingListItem[]
  selectedId: string | null
  onSelect: (m: MeetingListItem) => void
  onDelete: (id: string) => void
  onUploaded: (m: Meeting) => void
  onBotJoined: (meetingId: string, title: string, projectId: string) => void
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'recording') {
    return (
      <span className="badge badge-recording">
        <span className="pulse-dot" />recording
      </span>
    )
  }
  return <span className={`badge badge-${status}`}>{status}</span>
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function MeetingList({ project, meetings, selectedId, onSelect, onDelete, onUploaded, onBotJoined }: Props) {
  const [showUpload, setShowUpload] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [pollingIds, setPollingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (pollingIds.size === 0) return

    const interval = setInterval(async () => {
      for (const meetingId of pollingIds) {
        try {
          const status: BotStatusResponse = await api.fetchBotStatus(meetingId)
          if (status.meeting_status === 'done' || status.meeting_status === 'failed') {
            setPollingIds(prev => {
              const next = new Set(prev)
              next.delete(meetingId)
              return next
            })
            onBotJoined('__refresh__', '', project.id)
          }
        } catch {
          // silently ignore polling errors
        }
      }
    }, 8000)

    return () => clearInterval(interval)
  }, [pollingIds, project.id, onBotJoined])

  return (
    <div className="meeting-panel">
      <div className="panel-header">
        <div>
          <div className="panel-title">{project.name}</div>
          {project.client_name && <div className="panel-subtitle">{project.client_name}</div>}
        </div>
        <div className="panel-header-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => setShowJoin(true)}>
            🔴 Join Live
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowUpload(true)}>
            + Upload
          </button>
        </div>
      </div>

      <div className="meeting-list">
        {meetings.length === 0 ? (
          <div className="sidebar-empty">No meetings yet.<br />Upload a transcript to begin.</div>
        ) : (
          meetings.map(m => (
            <div
              key={m.id}
              className={`meeting-item ${m.id === selectedId ? 'active' : ''}`}
              onClick={() => onSelect(m)}
            >
              <div className="meeting-item-info">
                <div className="meeting-item-title">{m.title}</div>
                <div className="meeting-item-meta">
                  <StatusBadge status={m.status} />
                  {m.meeting_date && <> · {formatDate(m.meeting_date)}</>}
                  {m.platform && <> · {m.platform}</>}
                </div>
                <div className="meeting-item-meta" style={{ marginTop: 2 }}>
                  {m.attendee_count} attendees · {m.action_count} actions
                </div>
              </div>
              <button
                className="meeting-delete"
                title="Delete meeting"
                onClick={e => { e.stopPropagation(); onDelete(m.id) }}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      {showUpload && (
        <UploadModal
          projectId={project.id}
          onUploaded={m => { onUploaded(m); setShowUpload(false) }}
          onClose={() => setShowUpload(false)}
        />
      )}

      {showJoin && (
        <JoinMeetingModal
          projectId={project.id}
          onJoined={(meetingId, title) => {
            setShowJoin(false)
            setPollingIds(prev => new Set(prev).add(meetingId))
            onBotJoined(meetingId, title, project.id)
          }}
          onClose={() => setShowJoin(false)}
        />
      )}
    </div>
  )
}
