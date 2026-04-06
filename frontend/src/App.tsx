import { useState, useEffect, useCallback } from 'react'
import type { Project, MeetingListItem, Meeting } from './types'
import * as api from './api'
import Topbar from './components/Topbar'
import AppSidebar from './components/AppSidebar'
import Dashboard from './components/panels/Dashboard'
import Chat from './components/panels/Chat'
import Knowledge from './components/panels/Knowledge'
import Performance from './components/panels/Performance'
import Employees from './components/panels/Employees'
import Projects from './components/panels/Projects'
import './App.css'

export type Mode = 'dashboard' | 'chat' | 'knowledge' | 'performance' | 'employees' | 'projects'
export type Role = 'admin' | 'manager' | 'employee'

export const ROLE_META: Record<Role, {
  name: string
  initials: string
  roleLabel: string
  badgeClass: string
  sbRoleLabel: string
  showModes: Mode[]
  showAdminSection: boolean
  dashTitle: string
  dashSub: string
  ragView: 'admin' | 'manager' | 'employee'
}> = {
  admin: {
    name: 'Raghuram',
    initials: 'RG',
    roleLabel: 'Admin',
    badgeClass: 'rb-admin',
    sbRoleLabel: 'Admin · RavenLens',
    showModes: ['dashboard', 'chat', 'knowledge', 'performance', 'employees', 'projects'],
    showAdminSection: true,
    dashTitle: 'Good morning, Raghuram.',
    dashSub: 'Org-wide view — all projects, all users.',
    ragView: 'admin',
  },
  manager: {
    name: 'Sarah J.',
    initials: 'SJ',
    roleLabel: 'Manager',
    badgeClass: 'rb-manager',
    sbRoleLabel: 'Manager · RavenLens',
    showModes: ['dashboard', 'chat', 'knowledge', 'performance'],
    showAdminSection: false,
    dashTitle: 'Good morning, Sarah.',
    dashSub: 'RavenLens project — your team this week.',
    ragView: 'manager',
  },
  employee: {
    name: 'Sneha K.',
    initials: 'SK',
    roleLabel: 'Employee',
    badgeClass: 'rb-employee',
    sbRoleLabel: 'Employee · RavenLens',
    showModes: ['dashboard', 'chat', 'knowledge', 'performance'],
    showAdminSection: false,
    dashTitle: 'Good morning, Sneha.',
    dashSub: 'Your meetings and actions this week.',
    ragView: 'employee',
  },
}

export default function App() {
  const [dark, setDark] = useState(false)
  const [role, setRole] = useState<Role>('admin')
  const [mode, setMode] = useState<Mode>('dashboard')

  // API state
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [meetings, setMeetings] = useState<MeetingListItem[]>([])
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null)

  const loadProjects = useCallback(async () => {
    try {
      const data = await api.fetchProjects()
      setProjects(data)
    } catch (e) {
      console.error(e)
    }
  }, [])

  const loadMeetings = useCallback(async (projectId: string) => {
    try {
      const data = await api.fetchMeetings(projectId)
      setMeetings(data)
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => { loadProjects() }, [loadProjects])

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project)
    setSelectedMeeting(null)
    loadMeetings(project.id)
  }

  const handleDeleteProject = async (id: string) => {
    await api.deleteProject(id)
    setProjects(p => p.filter(x => x.id !== id))
    if (selectedProject?.id === id) {
      setSelectedProject(null)
      setMeetings([])
      setSelectedMeeting(null)
    }
  }

  const handleProjectCreated = (project: Project) => {
    setProjects(p => [project, ...p])
    handleSelectProject(project)
  }

  const handleProjectUpdated = (project: Project) => {
    setProjects(p => p.map(x => x.id === project.id ? project : x))
    if (selectedProject?.id === project.id) setSelectedProject(project)
  }

  const handleSelectMeeting = async (item: MeetingListItem) => {
    try {
      const data = await api.fetchMeeting(item.id)
      setSelectedMeeting(data)
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteMeeting = async (id: string) => {
    await api.deleteMeeting(id)
    setMeetings(m => m.filter(x => x.id !== id))
    if (selectedMeeting?.id === id) setSelectedMeeting(null)
    if (selectedProject) {
      setProjects(p =>
        p.map(x => x.id === selectedProject.id ? { ...x, meeting_count: x.meeting_count - 1 } : x)
      )
    }
  }

  const handleBotJoined = useCallback(async (meetingId: string, title: string, projectId: string) => {
    if (meetingId === '__refresh__') {
      if (selectedProject) await loadMeetings(selectedProject.id)
      return
    }
    const placeholderItem: MeetingListItem = {
      id: meetingId,
      project_id: projectId,
      title,
      platform: null,
      meeting_date: null,
      created_at: new Date().toISOString(),
      status: 'joining',
      attendee_count: 0,
      action_count: 0,
    }
    setMeetings(m => [placeholderItem, ...m])
    setProjects(p =>
      p.map(x => x.id === projectId ? { ...x, meeting_count: x.meeting_count + 1 } : x)
    )
  }, [selectedProject, loadMeetings])

  const handleMeetingUploaded = (meeting: Meeting) => {
    const item: MeetingListItem = {
      id: meeting.id,
      project_id: meeting.project_id,
      title: meeting.title,
      platform: meeting.platform,
      meeting_date: meeting.meeting_date,
      created_at: meeting.created_at,
      status: meeting.status,
      attendee_count: meeting.attendees?.length ?? 0,
      action_count: meeting.action_items?.length ?? 0,
    }
    setMeetings(m => [item, ...m])
    setSelectedMeeting(meeting)
    if (selectedProject) {
      setProjects(p =>
        p.map(x => x.id === selectedProject.id ? { ...x, meeting_count: x.meeting_count + 1 } : x)
      )
    }
  }

  const switchMode = (m: Mode) => {
    const meta = ROLE_META[role]
    if (!meta.showModes.includes(m)) return
    setMode(m)
  }

  const switchRole = (r: Role) => {
    setRole(r)
    const meta = ROLE_META[r]
    if (!meta.showModes.includes(mode)) {
      setMode('dashboard')
    }
  }

  const roleMeta = ROLE_META[role]

  return (
    <div className={`shell${dark ? ' dark' : ''}`}>
      <Topbar
        dark={dark}
        onToggleDark={() => setDark(d => !d)}
        role={role}
        onRoleChange={switchRole}
        mode={mode}
        onModeChange={switchMode}
        roleMeta={roleMeta}
      />
      <div className="app-main">
        <AppSidebar
          role={role}
          mode={mode}
          onModeChange={switchMode}
          roleMeta={roleMeta}
        />
        <div className="app-content">
          {mode === 'dashboard' && (
            <Dashboard role={role} roleMeta={roleMeta} projects={projects} meetings={meetings} />
          )}
          {mode === 'chat' && <Chat roleMeta={roleMeta} selectedProject={selectedProject} />}
          {mode === 'knowledge' && <Knowledge role={role} selectedProject={selectedProject} />}
          {mode === 'performance' && <Performance />}
          {mode === 'employees' && <Employees />}
          {mode === 'projects' && (
            <Projects
              projects={projects}
              selectedProject={selectedProject}
              meetings={meetings}
              selectedMeeting={selectedMeeting}
              onSelectProject={handleSelectProject}
              onDeleteProject={handleDeleteProject}
              onProjectCreated={handleProjectCreated}
              onProjectUpdated={handleProjectUpdated}
              onSelectMeeting={handleSelectMeeting}
              onDeleteMeeting={handleDeleteMeeting}
              onBotJoined={handleBotJoined}
              onMeetingUploaded={handleMeetingUploaded}
            />
          )}
        </div>
      </div>
    </div>
  )
}
