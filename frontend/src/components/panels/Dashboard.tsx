import { useState, useEffect } from 'react'
import type { Role, ROLE_META } from '../../App'
import type { Project, MeetingListItem, OpenActionItem } from '../../types'
import * as api from '../../api'

type RoleMeta = typeof ROLE_META[Role]

interface Props {
  role: Role
  roleMeta: RoleMeta
  projects: Project[]
  meetings: MeetingListItem[]
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function Dashboard({ roleMeta, projects, meetings }: Props) {
  const [openActions, setOpenActions] = useState<OpenActionItem[]>([])
  const [actionsLoading, setActionsLoading] = useState(true)

  useEffect(() => {
    setActionsLoading(true)
    api.fetchOpenActions()
      .then(data => setOpenActions(data.action_items.slice(0, 5)))
      .catch(() => setOpenActions([]))
      .finally(() => setActionsLoading(false))
  }, [])

  const totalMeetings    = projects.reduce((s, p) => s + p.meeting_count, 0)
  const pendingMeetings  = meetings.filter(m => m.status === 'pending' || m.status === 'processing').length
  const doneMeetings     = meetings.filter(m => m.status === 'done').length
  const actionItems      = meetings.reduce((s, m) => s + m.action_count, 0)

  const recentMeetings = [...meetings]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 4)

  function dotClass(status: string) {
    if (status === 'done') return 'dot-g'
    if (status === 'processing') return 'dot-b'
    return 'dot-a'
  }

  function statusClass(status: string) {
    if (status === 'done') return 'st-done'
    if (status === 'processing' || status === 'recording') return 'st-proc'
    return 'st-pend'
  }

  function statusLabel(status: string) {
    if (status === 'done') return 'Done'
    if (status === 'processing') return 'Processing'
    if (status === 'recording') return 'Recording'
    if (status === 'joining') return 'Joining'
    return 'Pending'
  }

  return (
    <div className="panel">
      <div className="panel-title">{roleMeta.dashTitle}</div>
      <div className="panel-sub">{roleMeta.dashSub}</div>

      {/* Metrics */}
      <div className="metrics">
        <div className="metric">
          <div className="metric-val">{totalMeetings}</div>
          <div className="metric-lbl">Meetings processed</div>
          <div className="metric-delta up">↑ this week</div>
        </div>
        <div className="metric">
          <div className="metric-val">{actionItems}</div>
          <div className="metric-lbl">Action items tracked</div>
          <div className="metric-delta dn">{pendingMeetings > 0 ? `${pendingMeetings} pending` : 'All caught up'}</div>
        </div>
        <div className="metric">
          <div className="metric-val">
            {totalMeetings > 0 ? Math.round((doneMeetings / totalMeetings) * 100) : 0}%
          </div>
          <div className="metric-lbl">MOM completion rate</div>
          <div className="metric-delta up">↑ this sprint</div>
        </div>
        <div className="metric">
          <div className="metric-val">{projects.length}</div>
          <div className="metric-lbl">Active projects</div>
          <div className="metric-delta neu">Across all teams</div>
        </div>
      </div>

      {/* Cards */}
      <div className="grid2">
        {/* Recent meetings */}
        <div className="card">
          <div className="card-head">
            <span className="card-title">Recent meetings</span>
            <span className="card-action">View all →</span>
          </div>
          {recentMeetings.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '16px 0' }}>
              No meetings yet. Upload a transcript to get started.
            </div>
          ) : (
            recentMeetings.map(m => (
              <div className="mrow" key={m.id}>
                <span className={`mdot ${dotClass(m.status)}`} />
                <div className="minfo">
                  <div className="mname">{m.title}</div>
                  <div className="mmeta">
                    {m.meeting_date ? formatDate(m.meeting_date) : formatDate(m.created_at)}
                    {m.platform ? ` · ${m.platform}` : ''}
                    {m.attendee_count > 0 ? ` · ${m.attendee_count} attendees` : ''}
                  </div>
                </div>
                <span className={`status ${statusClass(m.status)}`}>{statusLabel(m.status)}</span>
              </div>
            ))
          )}
        </div>

        {/* Open actions — real data */}
        <div className="card">
          <div className="card-head">
            <span className="card-title">Open actions</span>
            <span className="card-action">View all →</span>
          </div>

          {actionsLoading && (
            <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '16px 0' }}>
              Loading…
            </div>
          )}

          {!actionsLoading && openActions.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '16px 0' }}>
              No open actions. Process a meeting to see action items here.
            </div>
          )}

          {!actionsLoading && openActions.map((item, i) => (
            <div className="arow" key={i}>
              <div className="achk" />
              <div className="abody">
                <div className="atitle">{item.task}</div>
                <div className="ameta">
                  {item.due ? `Due ${item.due} · ` : ''}
                  {item.owner ? `${item.owner} · ` : ''}
                  {item.meeting_title}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
