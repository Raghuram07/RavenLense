import { useState } from 'react'
import type { Meeting, ActionItem } from '../types'
import * as api from '../api'

interface Props {
  meeting: Meeting
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

const STATUS_CYCLE: Record<ActionItem['status'], ActionItem['status']> = {
  open:        'in_progress',
  in_progress: 'done',
  done:        'open',
}

const STATUS_LABEL: Record<ActionItem['status'], string> = {
  open:        'Open',
  in_progress: 'In Progress',
  done:        'Done',
}

const STATUS_STYLE: Record<ActionItem['status'], React.CSSProperties> = {
  open:        { background: 'var(--surface2)', color: 'var(--text3)', border: '1px solid var(--border2)' },
  in_progress: { background: 'var(--blue-bg)',  color: 'var(--blue)',  border: '1px solid var(--blue)' },
  done:        { background: '#dcfce7',          color: '#16a34a',      border: '1px solid #86efac' },
}

export default function MeetingDetail({ meeting }: Props) {
  const { title, platform, meeting_date, status, summary, attendees, decisions, action_items, blockers, full_mom } = meeting

  const [items, setItems] = useState<ActionItem[]>(action_items ?? [])
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const cycleStatus = async (item: ActionItem) => {
    const next = STATUS_CYCLE[item.status]
    setUpdatingId(item.id)
    try {
      await api.updateActionItemStatus(meeting.id, item.id, next)
      setItems(prev => prev.map(it => it.id === item.id ? { ...it, status: next } : it))
    } catch {
      /* silently ignore — keep old status */
    } finally {
      setUpdatingId(null)
    }
  }

  if (status === 'joining') {
    return (
      <div className="detail-panel" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="empty-state">
          <div className="empty-state-icon">🤖</div>
          <h3>Bot is joining the meeting…</h3>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            The RavenLens bot is entering the call. This may take up to 30 seconds.
          </p>
        </div>
      </div>
    )
  }

  if (status === 'recording') {
    return (
      <div className="detail-panel" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="empty-state">
          <div className="empty-state-icon">🔴</div>
          <h3>Recording in progress</h3>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            The bot is live in the meeting and recording the transcript.<br />
            MOM will be generated automatically when the call ends.
          </p>
        </div>
      </div>
    )
  }

  if (status === 'processing') {
    return (
      <div className="detail-panel" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="empty-state">
          <div className="empty-state-icon">⏳</div>
          <h3>Processing transcript…</h3>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>AI is generating the MOM. Refresh in a moment.</p>
        </div>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="detail-panel" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="empty-state">
          <div className="empty-state-icon">❌</div>
          <h3>Processing failed</h3>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Check the transcript file and try again.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div className="detail-title">{title}</div>
        <div className="detail-meta">
          <span className={`badge badge-${status}`}>{status}</span>
          {platform && <span>{platform}</span>}
          {meeting_date && <span>{formatDate(meeting_date)}</span>}
        </div>
      </div>

      {summary && (
        <div className="section">
          <div className="section-title">Summary</div>
          <div className="summary-box">{summary}</div>
        </div>
      )}

      {attendees && attendees.length > 0 && (
        <div className="section">
          <div className="section-title">Attendees ({attendees.length})</div>
          <div className="attendee-chips">
            {attendees.map((a, i) => <span key={i} className="attendee-chip">{a}</span>)}
          </div>
        </div>
      )}

      {decisions && decisions.length > 0 && (
        <div className="section">
          <div className="section-title">Decisions</div>
          <div className="list-items">
            {decisions.map((d, i) => (
              <div key={i} className="list-item">
                <span className="list-item-dot" />
                <span>{d}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="section">
          <div className="section-title">Action Items ({items.length})</div>
          <div className="list-items">
            {items.map(item => (
              <div key={item.id} className="action-item">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div className="action-task" style={{ flex: 1 }}>{item.task}</div>
                  <button
                    onClick={() => cycleStatus(item)}
                    disabled={updatingId === item.id}
                    title="Click to advance status"
                    style={{
                      ...STATUS_STYLE[item.status],
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 99,
                      cursor: updatingId === item.id ? 'wait' : 'pointer',
                      flexShrink: 0,
                      fontWeight: 500,
                      background: STATUS_STYLE[item.status].background,
                    }}
                  >
                    {updatingId === item.id ? '…' : STATUS_LABEL[item.status]}
                  </button>
                </div>
                <div className="action-owner">👤 {item.owner}</div>
                {item.due_date && <div className="action-due">📅 {item.due_date}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {blockers && blockers.length > 0 && (
        <div className="section">
          <div className="section-title">Blockers</div>
          <div className="list-items">
            {blockers.map((b, i) => (
              <div key={i} className="list-item" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
                <span className="list-item-dot" style={{ background: 'var(--error)' }} />
                <span>{b}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {full_mom && (
        <div className="section">
          <div className="section-title">Full MOM</div>
          <div className="full-mom">{full_mom}</div>
        </div>
      )}
    </div>
  )
}
