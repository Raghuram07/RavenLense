/**
 * Calendar Service — future-ready abstraction layer.
 *
 * Currently backed by a MockCalendarProvider.
 * To swap in a real provider:
 *   1. Implement CalendarProvider with the same interface.
 *   2. Replace `activeProvider` below.
 *
 * Planned providers:
 *   - GoogleCalendarProvider  (Google Workspace Calendar API)
 *   - OutlookCalendarProvider (Microsoft Graph API)
 *   - Each project can have its own calendar identity / service account.
 */

// ── Types ─────────────────────────────────────────────────

export type MeetingType =
  | 'standup'
  | 'review'
  | 'planning'
  | 'retrospective'
  | 'demo'
  | 'sync'
  | 'one-on-one'
  | 'other'

export type CalendarSource = 'manual' | 'google' | 'outlook' | 'ravenlens'

export interface CalendarEvent {
  id:          string
  projectId:   string
  title:       string
  date:        string        // YYYY-MM-DD
  startTime:   string        // HH:MM (24h)
  endTime:     string        // HH:MM (24h)
  participants: string[]
  meetingType:  MeetingType
  description?: string
  source:       CalendarSource
  color?:       string       // optional override colour
  meetingUrl?:  string       // video call link
}

/** Provider interface — implement this for real integrations */
export interface CalendarProvider {
  /** Return events for a project within a date range (inclusive). */
  getEvents(
    projectId: string,
    startDate: Date,
    endDate:   Date,
  ): Promise<CalendarEvent[]>

  /** Create an event (future). */
  createEvent?(event: Omit<CalendarEvent, 'id' | 'source'>): Promise<CalendarEvent>
}

// ── Colour map ────────────────────────────────────────────

export const MEETING_TYPE_COLOR: Record<MeetingType, string> = {
  standup:       '#2563eb',
  review:        '#7c3aed',
  planning:      '#0891b2',
  retrospective: '#b45309',
  demo:          '#16a34a',
  sync:          '#64748b',
  'one-on-one':  '#db2777',
  other:         '#6b7280',
}

export const MEETING_TYPE_LABEL: Record<MeetingType, string> = {
  standup:       'Standup',
  review:        'Review',
  planning:      'Planning',
  retrospective: 'Retrospective',
  demo:          'Demo',
  sync:          'Sync',
  'one-on-one':  '1-on-1',
  other:         'Meeting',
}

// ── Helpers ───────────────────────────────────────────────

function fmt(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d
}

/** Return the Monday of the week containing `date`. */
export function weekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()               // 0=Sun…6=Sat
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function weekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function formatMonth(monday: Date): string {
  const sunday = addDays(monday, 6)
  const mStart = monday.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const mEnd   = sunday.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  return mStart === mEnd ? mStart : `${monday.toLocaleDateString(undefined, { month: 'short' })} – ${mEnd}`
}

// ── Mock provider ─────────────────────────────────────────

/**
 * Generates realistic mock events relative to today so the calendar
 * is always populated when you open it.
 * Replace this class with a real API provider when ready.
 */
class MockCalendarProvider implements CalendarProvider {
  private generateEvents(projectId: string): CalendarEvent[] {
    const today  = new Date()
    const monday = weekStart(today)

    // Helper: date string N days from this week's Monday
    const d = (offset: number) => fmt(addDays(monday, offset))

    const TEAM = ['Sarah J.', 'Raghuram', 'Sneha K.', 'Arjun M.', 'Priya R.']
    const CLIENT = ['David L.', 'Emma W.']

    return [
      {
        id: 'mock-1', projectId, source: 'ravenlens',
        title: 'Daily Standup',
        date: d(0), startTime: '09:30', endTime: '09:45',
        meetingType: 'standup',
        participants: [TEAM[0], TEAM[1], TEAM[2]],
        description: 'Daily team sync — blockers and progress.',
        color: MEETING_TYPE_COLOR['standup'],
      },
      {
        id: 'mock-2', projectId, source: 'ravenlens',
        title: 'Daily Standup',
        date: d(1), startTime: '09:30', endTime: '09:45',
        meetingType: 'standup',
        participants: [TEAM[0], TEAM[1], TEAM[2]],
        color: MEETING_TYPE_COLOR['standup'],
      },
      {
        id: 'mock-3', projectId, source: 'ravenlens',
        title: 'Sprint Planning',
        date: d(0), startTime: '11:00', endTime: '12:30',
        meetingType: 'planning',
        participants: TEAM,
        description: 'Plan next sprint — story points, prioritisation.',
        color: MEETING_TYPE_COLOR['planning'],
      },
      {
        id: 'mock-4', projectId, source: 'ravenlens',
        title: 'Client Review',
        date: d(2), startTime: '14:00', endTime: '15:00',
        meetingType: 'review',
        participants: [TEAM[0], TEAM[1], ...CLIENT],
        description: 'Demo progress to client stakeholders.',
        color: MEETING_TYPE_COLOR['review'],
      },
      {
        id: 'mock-5', projectId, source: 'ravenlens',
        title: 'Daily Standup',
        date: d(2), startTime: '09:30', endTime: '09:45',
        meetingType: 'standup',
        participants: [TEAM[0], TEAM[2], TEAM[3]],
        color: MEETING_TYPE_COLOR['standup'],
      },
      {
        id: 'mock-6', projectId, source: 'ravenlens',
        title: 'Tech Sync',
        date: d(1), startTime: '15:30', endTime: '16:15',
        meetingType: 'sync',
        participants: [TEAM[1], TEAM[3], TEAM[4]],
        description: 'Architecture decisions and technical debt review.',
        color: MEETING_TYPE_COLOR['sync'],
      },
      {
        id: 'mock-7', projectId, source: 'ravenlens',
        title: '1-on-1: Sarah & Raghuram',
        date: d(3), startTime: '10:00', endTime: '10:30',
        meetingType: 'one-on-one',
        participants: [TEAM[0], TEAM[1]],
        color: MEETING_TYPE_COLOR['one-on-one'],
      },
      {
        id: 'mock-8', projectId, source: 'ravenlens',
        title: 'Sprint Retrospective',
        date: d(4), startTime: '16:00', endTime: '17:00',
        meetingType: 'retrospective',
        participants: TEAM,
        description: 'What went well, what to improve.',
        color: MEETING_TYPE_COLOR['retrospective'],
      },
      {
        id: 'mock-9', projectId, source: 'ravenlens',
        title: 'Product Demo',
        date: d(4), startTime: '11:00', endTime: '12:00',
        meetingType: 'demo',
        participants: [TEAM[0], TEAM[1], CLIENT[0]],
        description: 'End-of-sprint demo for the client.',
        color: MEETING_TYPE_COLOR['demo'],
      },
      {
        id: 'mock-10', projectId, source: 'ravenlens',
        title: 'Daily Standup',
        date: d(3), startTime: '09:30', endTime: '09:45',
        meetingType: 'standup',
        participants: [TEAM[0], TEAM[1], TEAM[2]],
        color: MEETING_TYPE_COLOR['standup'],
      },
      {
        id: 'mock-11', projectId, source: 'ravenlens',
        title: 'Daily Standup',
        date: d(4), startTime: '09:30', endTime: '09:45',
        meetingType: 'standup',
        participants: [TEAM[0], TEAM[2]],
        color: MEETING_TYPE_COLOR['standup'],
      },
      // Next week preview
      {
        id: 'mock-12', projectId, source: 'ravenlens',
        title: 'Sprint Planning',
        date: d(7), startTime: '10:00', endTime: '11:30',
        meetingType: 'planning',
        participants: TEAM,
        color: MEETING_TYPE_COLOR['planning'],
      },
    ]
  }

  async getEvents(
    projectId: string,
    startDate: Date,
    endDate:   Date,
  ): Promise<CalendarEvent[]> {
    // Simulate slight network delay
    await new Promise(r => setTimeout(r, 120))

    const start = fmt(startDate)
    const end   = fmt(endDate)

    return this.generateEvents(projectId).filter(
      e => e.date >= start && e.date <= end
    )
  }
}

// ── Active provider (swap here to switch to real API) ─────

const activeProvider: CalendarProvider = new MockCalendarProvider()

// ── Public API ────────────────────────────────────────────

export async function getCalendarEvents(
  projectId: string,
  startDate: Date,
  endDate:   Date,
): Promise<CalendarEvent[]> {
  return activeProvider.getEvents(projectId, startDate, endDate)
}
