import type { Meeting } from '../types'

interface Props {
  meeting: Meeting
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export default function MeetingDetail({ meeting }: Props) {
  const { title, platform, meeting_date, status, summary, attendees, decisions, action_items, blockers, full_mom } = meeting

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

      {action_items && action_items.length > 0 && (
        <div className="section">
          <div className="section-title">Action Items ({action_items.length})</div>
          <div className="list-items">
            {action_items.map((item, i) => (
              <div key={i} className="action-item">
                <div className="action-task">{item.task}</div>
                <div className="action-owner">👤 {item.owner}</div>
                {item.due && <div className="action-due">📅 {item.due}</div>}
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
