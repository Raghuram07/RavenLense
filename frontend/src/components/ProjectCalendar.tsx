import { useState, useEffect, useRef } from 'react'
import type { Project } from '../types'
import {
  type CalendarEvent,
  type MeetingType,
  MEETING_TYPE_COLOR,
  MEETING_TYPE_LABEL,
  getCalendarEvents,
  weekStart,
  weekDays,
  formatDisplayDate,
  formatMonth,
} from '../services/calendarService'

// ── Constants ─────────────────────────────────────────────

/** Hours shown in the grid (inclusive). */
const HOUR_START = 8
const HOUR_END   = 20

/** Pixel height of one hour row. */
const HOUR_H = 56

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// ── Time helpers ──────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToTop(minutes: number): number {
  return ((minutes - HOUR_START * 60) / 60) * HOUR_H
}

function minutesToHeight(start: string, end: string): number {
  return ((timeToMinutes(end) - timeToMinutes(start)) / 60) * HOUR_H
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${hour}${ampm}` : `${hour}:${m.toString().padStart(2, '0')}${ampm}`
}

// ── Event pill ────────────────────────────────────────────

interface EventPillProps {
  event:    CalendarEvent
  onClick:  (e: CalendarEvent) => void
}

function EventPill({ event, onClick }: EventPillProps) {
  const top    = minutesToTop(timeToMinutes(event.startTime))
  const height = Math.max(minutesToHeight(event.startTime, event.endTime), 22)
  const color  = event.color ?? MEETING_TYPE_COLOR[event.meetingType]
  const short  = height < 36

  return (
    <div
      onClick={() => onClick(event)}
      style={{
        position: 'absolute',
        top:      top + 1,
        left:     2,
        right:    2,
        height:   height - 2,
        borderRadius:    5,
        background:      `${color}22`,
        borderLeft:      `3px solid ${color}`,
        padding:         short ? '2px 5px' : '4px 6px',
        cursor:          'pointer',
        overflow:        'hidden',
        transition:      'filter 0.1s',
        zIndex:          1,
      }}
      title={`${event.title} · ${formatTime(event.startTime)}–${formatTime(event.endTime)}`}
      onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.92)')}
      onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
    >
      <div style={{
        fontSize:    11,
        fontWeight:  600,
        color,
        whiteSpace:  'nowrap',
        overflow:    'hidden',
        textOverflow: 'ellipsis',
        lineHeight:  1.3,
      }}>
        {event.title}
      </div>
      {!short && (
        <div style={{ fontSize: 10.5, color, opacity: 0.8, lineHeight: 1.3 }}>
          {formatTime(event.startTime)}–{formatTime(event.endTime)}
        </div>
      )}
    </div>
  )
}

// ── Event detail popover ──────────────────────────────────

interface EventDetailProps {
  event:   CalendarEvent
  onClose: () => void
}

function EventDetail({ event, onClose }: EventDetailProps) {
  const color = event.color ?? MEETING_TYPE_COLOR[event.meetingType]

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ width: 380, maxWidth: '92vw' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Colour header */}
        <div style={{
          height: 4, borderRadius: '6px 6px 0 0',
          background: color,
          margin: '-20px -20px 16px',
        }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            background: `${color}22`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>
            {event.meetingType === 'standup'       ? '☀️' :
             event.meetingType === 'review'        ? '🔍' :
             event.meetingType === 'planning'      ? '🗓' :
             event.meetingType === 'retrospective' ? '🔄' :
             event.meetingType === 'demo'          ? '🎯' :
             event.meetingType === 'sync'          ? '🔗' :
             event.meetingType === 'one-on-one'    ? '👥' : '📅'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>{event.title}</div>
            <div style={{ fontSize: 12, marginTop: 2 }}>
              <span style={{
                display: 'inline-block', fontSize: 10.5, fontWeight: 600,
                padding: '1px 7px', borderRadius: 99,
                background: `${color}22`, color,
              }}>
                {MEETING_TYPE_LABEL[event.meetingType]}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text3)', fontSize: 16, lineHeight: 1,
          }}>✕</button>
        </div>

        {/* Date & time */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
            <span style={{ opacity: 0.5 }}>📅</span>
            <span>{new Date(event.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, marginBottom: 14 }}>
          <span style={{ opacity: 0.5 }}>🕐</span>
          <span>{formatTime(event.startTime)} – {formatTime(event.endTime)}</span>
          <span style={{ color: 'var(--text3)', fontSize: 11.5 }}>
            ({Math.round((timeToMinutes(event.endTime) - timeToMinutes(event.startTime)))} min)
          </span>
        </div>

        {/* Description */}
        {event.description && (
          <div style={{
            fontSize: 12.5, color: 'var(--text2)',
            padding: '8px 10px', borderRadius: 'var(--r-sm)',
            background: 'var(--surface2)', marginBottom: 12,
            lineHeight: 1.5,
          }}>
            {event.description}
          </div>
        )}

        {/* Participants */}
        {event.participants.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Participants ({event.participants.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {event.participants.map(name => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px 3px 3px', borderRadius: 99, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: color, color: '#fff',
                    fontSize: 9, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <span style={{ fontSize: 12 }}>{name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Source badge */}
        <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text3)' }}>
          Source: {event.source === 'google' ? '🗓 Google Calendar' : event.source === 'outlook' ? '📧 Outlook' : '🪶 RavenLens'}
        </div>
      </div>
    </div>
  )
}

// ── Current-time indicator ────────────────────────────────

function CurrentTimeBar() {
  const [top, setTop] = useState(0)

  useEffect(() => {
    const update = () => {
      const now = new Date()
      const mins = now.getHours() * 60 + now.getMinutes()
      setTop(minutesToTop(mins))
    }
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{
      position:   'absolute',
      top,
      left:       0,
      right:      0,
      height:     2,
      background: 'var(--red)',
      zIndex:     2,
      pointerEvents: 'none',
    }}>
      <div style={{
        position: 'absolute',
        left:     -4,
        top:      -4,
        width:    10,
        height:   10,
        borderRadius: '50%',
        background: 'var(--red)',
      }} />
    </div>
  )
}

// ── Main calendar ─────────────────────────────────────────

interface Props {
  project: Project
}

export default function ProjectCalendar({ project }: Props) {
  const today        = todayStr()
  const [monday, setMonday]   = useState(() => weekStart(new Date()))
  const [events, setEvents]   = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CalendarEvent | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const days = weekDays(monday)

  // Load events when week changes
  useEffect(() => {
    setLoading(true)
    const end = new Date(monday)
    end.setDate(end.getDate() + 6)
    getCalendarEvents(project.id, monday, end)
      .then(setEvents)
      .finally(() => setLoading(false))
  }, [monday, project.id])

  // Scroll to 8 AM on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [])

  const goBack = () => {
    const d = new Date(monday)
    d.setDate(d.getDate() - 7)
    setMonday(d)
  }

  const goForward = () => {
    const d = new Date(monday)
    d.setDate(d.getDate() + 7)
    setMonday(d)
  }

  const goToday = () => setMonday(weekStart(new Date()))

  const eventsForDay = (dateStr: string) =>
    events.filter(e => e.date === dateStr)

  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i)

  const totalGridH = (HOUR_END - HOUR_START) * HOUR_H

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ── Calendar header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>{formatMonth(monday)}</div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginRight: 8 }}>
          {(Object.entries(MEETING_TYPE_COLOR) as [MeetingType, string][]).slice(0, 5).map(([type, color]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text3)' }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
              {MEETING_TYPE_LABEL[type]}
            </div>
          ))}
        </div>

        {/* Nav */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button
            className="btn sm"
            onClick={goToday}
            style={{ fontSize: 12 }}
          >
            Today
          </button>
          <button
            onClick={goBack}
            style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r-sm)', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)' }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M10 3L5 8l5 5"/>
            </svg>
          </button>
          <button
            onClick={goForward}
            style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r-sm)', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)' }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 3l5 5-5 5"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Day header row ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '48px repeat(7, 1fr)',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        flexShrink: 0,
      }}>
        <div />  {/* gutter */}
        {days.map((day, i) => {
          const dateStr = day.toISOString().slice(0, 10)
          const isToday = dateStr === today
          const dayEvCount = eventsForDay(dateStr).length
          return (
            <div
              key={i}
              style={{
                textAlign: 'center',
                padding: '8px 4px 10px',
                borderLeft: '1px solid var(--border)',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {DAY_LABELS[i]}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 2 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isToday ? 'var(--accent)' : 'transparent',
                  color: isToday ? 'var(--accent-fg)' : 'var(--text)',
                  fontWeight: isToday ? 700 : 500,
                  fontSize: 13.5,
                }}>
                  {day.getDate()}
                </div>
                {dayEvCount > 0 && (
                  <div style={{
                    fontSize: 10, fontWeight: 600,
                    color: 'var(--text3)',
                  }}>
                    {dayEvCount}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Scrollable time grid ── */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, fontSize: 13, color: 'var(--text3)' }}>
            Loading calendar…
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '48px repeat(7, 1fr)',
            height: totalGridH,
            position: 'relative',
          }}>

            {/* Hour labels + horizontal lines */}
            <div style={{ position: 'relative' }}>
              {hours.map(h => (
                <div
                  key={h}
                  style={{
                    position: 'absolute',
                    top: (h - HOUR_START) * HOUR_H - 7,
                    right: 8,
                    fontSize: 10.5,
                    color: 'var(--text3)',
                    fontWeight: 500,
                    lineHeight: 1,
                    userSelect: 'none',
                  }}
                >
                  {h === 12 ? '12pm' : h > 12 ? `${h - 12}pm` : `${h}am`}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day, i) => {
              const dateStr = day.toISOString().slice(0, 10)
              const isToday = dateStr === today
              const dayEvents = eventsForDay(dateStr)

              return (
                <div
                  key={i}
                  style={{
                    position: 'relative',
                    borderLeft: '1px solid var(--border)',
                    background: isToday ? 'rgba(24,24,21,0.018)' : 'transparent',
                    height: totalGridH,
                  }}
                >
                  {/* Hour grid lines */}
                  {hours.map(h => (
                    <div
                      key={h}
                      style={{
                        position: 'absolute',
                        top: (h - HOUR_START) * HOUR_H,
                        left: 0, right: 0,
                        borderTop: `1px solid var(--border)`,
                      }}
                    />
                  ))}

                  {/* Half-hour lines */}
                  {hours.map(h => (
                    <div
                      key={`${h}-half`}
                      style={{
                        position: 'absolute',
                        top: (h - HOUR_START) * HOUR_H + HOUR_H / 2,
                        left: 0, right: 0,
                        borderTop: `1px dashed var(--border)`,
                        opacity: 0.5,
                      }}
                    />
                  ))}

                  {/* Current time indicator (today only) */}
                  {isToday && <CurrentTimeBar />}

                  {/* Events */}
                  {dayEvents.map(event => (
                    <EventPill
                      key={event.id}
                      event={event}
                      onClick={setSelected}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Event detail modal ── */}
      {selected && (
        <EventDetail event={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
