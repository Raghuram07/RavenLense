// ── Projects ──────────────────────────────────────────────

export interface ProjectMember {
  id:              string
  project_id:      string
  name:            string
  email:           string | null
  role_in_project: string | null
  member_type:     'internal' | 'client'
  organization:    string | null
  employee_id:     string | null
  created_at:      string
}

export interface Project {
  id:            string
  name:          string
  description:   string | null
  client:        string | null
  created_at:    string
  meeting_count: number
  members:       ProjectMember[]
}

// ── Meetings ──────────────────────────────────────────────

export interface MeetingListItem {
  id:            string
  project_id:    string
  title:         string
  platform:      string | null
  meeting_date:  string | null
  created_at:    string
  status:        'pending' | 'processing' | 'done' | 'failed' | 'joining' | 'recording'
  attendee_count: number
  action_count:   number
  bot_status?:    string | null
  recall_bot_id?: string | null
}

export interface ActionItem {
  owner: string
  task:  string
  due:   string | null
}

export interface Meeting {
  id:           string
  project_id:   string
  title:        string
  platform:     string | null
  meeting_date: string | null
  created_at:   string
  status:       'pending' | 'processing' | 'done' | 'failed' | 'joining' | 'recording'
  attendees:    string[] | null
  decisions:    string[] | null
  action_items: ActionItem[] | null
  blockers:     string[] | null
  summary:      string | null
  full_mom:     string | null
  recall_bot_id: string | null
  meeting_url:   string | null
  bot_status:    string | null
  bot_joined_at: string | null
  bot_left_at:   string | null
}

export interface BotJoinResponse {
  meeting_id:    string
  recall_bot_id: string
  status:        string
  message:       string
}

export interface BotStatusResponse {
  meeting_id:     string
  title:          string
  platform:       string | null
  meeting_url:    string | null
  recall_bot_id:  string | null
  bot_status:     string | null
  meeting_status: string
  bot_joined_at:  string | null
  bot_left_at:    string | null
}

// ── Employee ──────────────────────────────────────────────

export interface Employee {
  id:           string
  first_name:   string
  last_name:    string
  email:        string
  department:   string | null
  organization: string | null
  role:         'admin' | 'manager' | 'employee'
  project:      string | null
  status:       'active' | 'inactive'
  created_at:   string
}

export interface EmployeeCreate {
  first_name:   string
  last_name:    string
  email:        string
  department?:  string
  organization?: string
  role?:        string
  project?:     string
  status?:      string
}

export interface EmployeeUpdate {
  first_name?:   string
  last_name?:    string
  email?:        string
  department?:   string
  organization?: string
  role?:         string
  project?:      string
  status?:       string
}

// ── Clients ───────────────────────────────────────────────

export interface ClientContact {
  id:         string
  client_id:  string
  name:       string
  email:      string | null
  role:       string | null
  created_at: string
}

export interface Client {
  id:         string
  name:       string
  email:      string | null
  phone:      string | null
  created_at: string
  contacts:   ClientContact[]
}

export interface ClientCreate {
  name:      string
  email?:    string
  phone?:    string
  contacts?: { name: string; email?: string; role?: string }[]
}

// ── Knowledge base ────────────────────────────────────────

export interface KnowledgeFolder {
  id:         string
  project_id: string | null
  name:       string
  emoji:      string | null
  created_at: string
  file_count: number
}

export interface KnowledgeFile {
  id:               string
  folder_id:        string | null
  project_id:       string | null
  name:             string
  mime_type:        string | null
  size_bytes:       number | null
  status:           'pending' | 'approved' | 'rejected'
  uploaded_by_name: string | null
  rejection_reason: string | null
  reviewed_by_name: string | null
  reviewed_at:      string | null
  created_at:       string
}

// ── Dashboard ─────────────────────────────────────────────

export interface DashboardSummary {
  total_meetings:    number
  done_meetings:     number
  pending_meetings:  number
  total_action_items: number
  mom_completion_pct: number
  active_projects:   number
}

export interface OpenActionItem {
  meeting_id:    string
  meeting_title: string
  project_id:    string
  owner:         string
  task:          string
  due:           string | null
  status:        string
}

// ── Performance ───────────────────────────────────────────

export interface PerformanceOverview {
  avg_participation_score: number
  action_completion_pct:   number
  decisions_per_meeting:   number
  total_meetings:          number
  total_action_items:      number
  total_decisions:         number
}

export interface PerformanceMember {
  name:               string
  initials:           string
  meetings_attended:  number
  action_items_total: number
  action_items_done:  number
  participation_score: number
  pill:               'hi' | 'md' | 'lo'
  label:              string
}

// ── Chat ──────────────────────────────────────────────────

export interface ChatSession {
  id:            string
  project_id:    string | null
  title:         string
  message_count?: number
  created_at:    string
  updated_at:    string
}

export interface ChatCitation {
  meeting_id:    string
  meeting_title: string
  excerpt?:      string
}

export interface ChatMessage {
  id:         string
  role:       'user' | 'assistant'
  content:    string
  citations:  ChatCitation[] | null
  created_at: string
}
