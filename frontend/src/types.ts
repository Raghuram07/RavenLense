export interface Project {
  id: string
  name: string
  description: string | null
  client: string | null
  created_at: string
  meeting_count: number
}

export interface MeetingListItem {
  id: string
  project_id: string
  title: string
  platform: string | null
  meeting_date: string | null
  created_at: string
  status: 'pending' | 'processing' | 'done' | 'failed' | 'joining' | 'recording'
  attendee_count: number
  action_count: number
  bot_status?: string | null
  recall_bot_id?: string | null
}

export interface ActionItem {
  owner: string
  task: string
  due: string | null
}

export interface Meeting {
  id: string
  project_id: string
  title: string
  platform: string | null
  meeting_date: string | null
  created_at: string
  status: 'pending' | 'processing' | 'done' | 'failed' | 'joining' | 'recording'
  attendees: string[] | null
  decisions: string[] | null
  action_items: ActionItem[] | null
  blockers: string[] | null
  summary: string | null
  full_mom: string | null
  recall_bot_id: string | null
  meeting_url: string | null
  bot_status: string | null
  bot_joined_at: string | null
  bot_left_at: string | null
}

export interface BotJoinResponse {
  meeting_id: string
  recall_bot_id: string
  status: string
  message: string
}

export interface BotStatusResponse {
  meeting_id: string
  title: string
  platform: string | null
  meeting_url: string | null
  recall_bot_id: string | null
  bot_status: string | null
  meeting_status: string
  bot_joined_at: string | null
  bot_left_at: string | null
}
