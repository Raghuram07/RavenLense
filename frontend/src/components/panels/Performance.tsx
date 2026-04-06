import { useState, useEffect } from 'react'
import type { PerformanceOverview, PerformanceMember } from '../../types'
import * as api from '../../api'

export default function Performance() {
  const [overview, setOverview]   = useState<PerformanceOverview | null>(null)
  const [members, setMembers]     = useState<PerformanceMember[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.fetchPerformanceOverview(),
      api.fetchPerformanceMembers(),
    ])
      .then(([ov, mb]) => {
        setOverview(ov)
        setMembers(mb.members)
      })
      .catch(err => setError(err.message ?? 'Failed to load performance data.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="panel">
        <div className="panel-title">Performance overview</div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 24, textAlign: 'center' }}>
          Loading…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="panel">
        <div className="panel-title">Performance overview</div>
        <div style={{ fontSize: 13, color: 'var(--red)', marginTop: 12 }}>{error}</div>
      </div>
    )
  }

  if (!overview || overview.total_meetings === 0) {
    return (
      <div className="panel">
        <div className="perf-hdr">
          <div>
            <div className="panel-title">Performance overview</div>
            <div className="panel-sub" style={{ marginBottom: 0 }}>
              Synthesised from meeting transcripts and MOM data
            </div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 32, textAlign: 'center' }}>
          No completed meetings yet. Upload a transcript to start tracking performance.
        </div>
      </div>
    )
  }

  const scores = [
    {
      label: 'Avg participation score',
      val:   String(overview.avg_participation_score),
      pct:   Math.round(overview.avg_participation_score * 10),
    },
    {
      label: 'Action item completion',
      val:   `${overview.action_completion_pct}%`,
      pct:   overview.action_completion_pct,
    },
    {
      label: 'Decisions per meeting',
      val:   String(overview.decisions_per_meeting),
      pct:   Math.min(100, Math.round(overview.decisions_per_meeting * 20)),
    },
  ]

  return (
    <div className="panel">
      <div className="perf-hdr">
        <div>
          <div className="panel-title">Performance overview</div>
          <div className="panel-sub" style={{ marginBottom: 0 }}>
            Synthesised from meeting transcripts and MOM data
          </div>
        </div>
        <span style={{ fontSize: 11.5, color: 'var(--text3)', padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 20 }}>
          {overview.total_meetings} meeting{overview.total_meetings !== 1 ? 's' : ''} · {overview.total_action_items} actions
        </span>
      </div>

      <div className="perf-scores">
        {scores.map(s => (
          <div key={s.label} className="pscore">
            <div className="ps-lbl">{s.label}</div>
            <div className="ps-val">{s.val}</div>
            <div className="ps-bar-bg">
              <div className="ps-bar" style={{ width: `${s.pct}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="perf-table">
        <div className="pt-head">
          <span className="pth">Team member</span>
          <span className="pth">Items done</span>
          <span className="pth">Participation</span>
          <span className="pth">Status</span>
        </div>
        {members.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text3)', padding: '16px 0', textAlign: 'center' }}>
            No attendee data found in meeting MOMs.
          </div>
        ) : (
          members.map(t => (
            <div key={t.name} className="pt-row">
              <span className="pt-name">
                <div className="mini-av">{t.initials}</div>
                {t.name}
              </span>
              <span className="pt-val">{t.action_items_done} / {t.action_items_total}</span>
              <span className="pt-val">{t.participation_score}</span>
              <span className="pt-val">
                <span className={`pill pill-${t.pill}`}>{t.label}</span>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
