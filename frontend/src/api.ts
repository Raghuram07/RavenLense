import type { Project, MeetingListItem, Meeting, BotJoinResponse, BotStatusResponse } from './types'

const API_BASE = import.meta.env.VITE_API_URL || ''

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, options)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail || `Request failed: ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// Projects
export const fetchProjects = () => req<Project[]>('/projects/')
export const createProject = (data: { name: string; description?: string; client?: string }) =>
  req<Project>('/projects/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
export const deleteProject = (id: string) => req<void>(`/projects/${id}`, { method: 'DELETE' })

// Meetings
export const fetchMeetings = (projectId: string) =>
  req<MeetingListItem[]>(`/meetings/project/${projectId}`)
export const fetchMeeting = (id: string) => req<Meeting>(`/meetings/${id}`)
export const uploadMeeting = (form: FormData) =>
  req<Meeting>('/meetings/upload', { method: 'POST', body: form })
export const deleteMeeting = (id: string) => req<void>(`/meetings/${id}`, { method: 'DELETE' })

// Bot
export const joinMeeting = (data: {
  project_id: string
  title: string
  meeting_url: string
  platform?: string
}) =>
  req<BotJoinResponse>('/bot/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

export const fetchBotStatus = (meetingId: string) =>
  req<BotStatusResponse>(`/bot/status/${meetingId}`)
