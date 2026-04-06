import type {
  Project, MeetingListItem, Meeting, BotJoinResponse, BotStatusResponse,
  Employee, EmployeeCreate, EmployeeUpdate,
  Client, ClientCreate, ClientContact,
  KnowledgeFolder, KnowledgeFile,
  OpenActionItem, PerformanceOverview, PerformanceMember,
  ChatResponse, ProjectMember,
} from './types'

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

// ── Projects ──────────────────────────────────────────────

export const fetchProjects = () => req<Project[]>('/projects/')

export const createProject = (data: {
  name: string
  description?: string
  client?: string
  members?: { name: string; email?: string; role_in_project?: string; member_type?: string; organization?: string; employee_id?: string }[]
}) =>
  req<Project>('/projects/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

export const updateProject = (id: string, data: { name?: string; description?: string; client?: string }) =>
  req<Project>(`/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

export const deleteProject = (id: string) => req<void>(`/projects/${id}`, { method: 'DELETE' })

// Project members
export const fetchProjectMembers = (projectId: string) =>
  req<ProjectMember[]>(`/projects/${projectId}/members`)

export const addProjectMember = (
  projectId: string,
  data: { name: string; email?: string; role_in_project?: string; member_type?: string; organization?: string; employee_id?: string }
) =>
  req<ProjectMember>(`/projects/${projectId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

export const removeProjectMember = (projectId: string, memberId: string) =>
  req<void>(`/projects/${projectId}/members/${memberId}`, { method: 'DELETE' })

// ── Meetings ──────────────────────────────────────────────

export const fetchMeetings = (projectId: string) =>
  req<MeetingListItem[]>(`/meetings/project/${projectId}`)
export const fetchMeeting = (id: string) => req<Meeting>(`/meetings/${id}`)
export const uploadMeeting = (form: FormData) =>
  req<Meeting>('/meetings/upload', { method: 'POST', body: form })
export const deleteMeeting = (id: string) => req<void>(`/meetings/${id}`, { method: 'DELETE' })

// ── Bot ───────────────────────────────────────────────────

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

// ── Employees ─────────────────────────────────────────────

export const fetchEmployees = () => req<Employee[]>('/employees/')

export const createEmployee = (data: EmployeeCreate) =>
  req<Employee>('/employees/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

export const updateEmployee = (id: string, data: EmployeeUpdate) =>
  req<Employee>(`/employees/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

export const toggleEmployeeStatus = (id: string) =>
  req<Employee>(`/employees/${id}/status`, { method: 'PATCH' })

export const deleteEmployee = (id: string) =>
  req<void>(`/employees/${id}`, { method: 'DELETE' })

// ── Clients ───────────────────────────────────────────────

export const fetchClients = () => req<Client[]>('/clients/')

export const createClient = (data: ClientCreate) =>
  req<Client>('/clients/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

export const updateClient = (id: string, data: { name?: string; email?: string; phone?: string }) =>
  req<Client>(`/clients/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

export const deleteClient = (id: string) =>
  req<void>(`/clients/${id}`, { method: 'DELETE' })

export const addClientContact = (clientId: string, data: { name: string; email?: string; role?: string }) =>
  req<ClientContact>(`/clients/${clientId}/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

export const updateClientContact = (clientId: string, contactId: string, data: { name?: string; email?: string; role?: string }) =>
  req<ClientContact>(`/clients/${clientId}/contacts/${contactId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

export const deleteClientContact = (clientId: string, contactId: string) =>
  req<void>(`/clients/${clientId}/contacts/${contactId}`, { method: 'DELETE' })

// ── Knowledge – Folders ───────────────────────────────────

export const fetchFolders = (projectId?: string) => {
  const qs = projectId ? `?project_id=${projectId}` : ''
  return req<KnowledgeFolder[]>(`/knowledge/folders${qs}`)
}

export const createFolder = (data: { name: string; emoji?: string; project_id?: string }) =>
  req<KnowledgeFolder>('/knowledge/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

export const deleteFolder = (id: string) =>
  req<void>(`/knowledge/folders/${id}`, { method: 'DELETE' })

// ── Knowledge – Files ─────────────────────────────────────

export const fetchFiles = (params?: { folder_id?: string; project_id?: string; status?: string }) => {
  const qs = new URLSearchParams()
  if (params?.folder_id)  qs.set('folder_id',  params.folder_id)
  if (params?.project_id) qs.set('project_id', params.project_id)
  if (params?.status)     qs.set('status',     params.status)
  const suffix = qs.toString() ? `?${qs}` : ''
  return req<KnowledgeFile[]>(`/knowledge/files${suffix}`)
}

export const fetchReviewQueue = () => req<KnowledgeFile[]>('/knowledge/review-queue')

export const uploadKnowledgeFile = (form: FormData) =>
  req<KnowledgeFile>('/knowledge/files/upload', { method: 'POST', body: form })

export const approveFile = (id: string, reviewedBy?: string) =>
  req<KnowledgeFile>(`/knowledge/files/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewed_by: reviewedBy }),
  })

export const rejectFile = (id: string, reason?: string) =>
  req<KnowledgeFile>(`/knowledge/files/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  })

export const deleteKnowledgeFile = (id: string) =>
  req<void>(`/knowledge/files/${id}`, { method: 'DELETE' })

// ── Dashboard ─────────────────────────────────────────────

export const fetchOpenActions = () =>
  req<{ action_items: OpenActionItem[]; total: number }>('/dashboard/open-actions')

// ── Performance ───────────────────────────────────────────

export const fetchPerformanceOverview = () =>
  req<PerformanceOverview>('/performance/overview')

export const fetchPerformanceMembers = () =>
  req<{ members: PerformanceMember[] }>('/performance/members')

// ── Chat ──────────────────────────────────────────────────

export const askChat = (question: string, projectId?: string, meetingIds?: string[]) =>
  req<ChatResponse>('/chat/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, project_id: projectId, meeting_ids: meetingIds }),
  })
