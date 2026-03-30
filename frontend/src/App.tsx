import { useState, useEffect, useCallback } from 'react'
import type { Project, MeetingListItem, Meeting } from './types'
import * as api from './api'
import Sidebar from './components/Sidebar'
import MeetingList from './components/MeetingList'
import MeetingDetail from './components/MeetingDetail'

export default function App() {
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
      title: title,
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

  return (
    <div className="layout">
      <Sidebar
        projects={projects}
        selectedId={selectedProject?.id ?? null}
        onSelect={handleSelectProject}
        onDelete={handleDeleteProject}
        onCreated={handleProjectCreated}
      />
      <div className="main">
        {!selectedProject ? (
          <div className="empty-state">
            <div className="empty-state-icon">🪟</div>
            <h3>Select a project to get started</h3>
          </div>
        ) : (
          <>
            <MeetingList
              project={selectedProject}
              meetings={meetings}
              selectedId={selectedMeeting?.id ?? null}
              onSelect={handleSelectMeeting}
              onDelete={handleDeleteMeeting}
              onUploaded={handleMeetingUploaded}
              onBotJoined={handleBotJoined}
            />
            {selectedMeeting ? (
              <MeetingDetail meeting={selectedMeeting} />
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <h3>Select a meeting to view MOM</h3>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
