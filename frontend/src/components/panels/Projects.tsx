import { useState } from 'react'
import type { Project, MeetingListItem, Meeting } from '../../types'
import MeetingList from '../MeetingList'
import MeetingDetail from '../MeetingDetail'
import CreateProjectModal from '../CreateProjectModal'
import * as api from '../../api'

// ── Edit Project modal ────────────────────────────────────

interface EditModalProps {
  project:   Project
  onSaved:   (p: Project) => void
  onClose:   () => void
}

function EditProjectModal({ project, onSaved, onClose }: EditModalProps) {
  const [name, setName]               = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [client, setClient]           = useState(project.client ?? '')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Project name is required.'); return }
    setLoading(true)
    setError('')
    try {
      const updated = await api.updateProject(project.id, {
        name:        name.trim(),
        description: description.trim() || undefined,
        client:      client.trim()      || undefined,
      })
      onSaved(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update project.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Edit project</div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Project name *</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Client / Organisation</label>
            <input className="form-input" value={client} onChange={e => setClient(e.target.value)} placeholder="e.g. Acme Corp" />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description" />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !name.trim()}>
              {loading ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const ICONS = ['🔭', '📊', '🚢', '🔬', '💡', '🌐', '🛠', '📱']
const ICON_CLASSES = ['pi-blue', 'pi-green', 'pi-purple', 'pi-amber', 'pi-blue', 'pi-green', 'pi-purple', 'pi-amber']

interface Props {
  projects: Project[]
  selectedProject: Project | null
  meetings: MeetingListItem[]
  selectedMeeting: Meeting | null
  onSelectProject: (p: Project) => void
  onDeleteProject: (id: string) => void
  onProjectCreated: (p: Project) => void
  onProjectUpdated: (p: Project) => void
  onSelectMeeting: (m: MeetingListItem) => void
  onDeleteMeeting: (id: string) => void
  onBotJoined: (meetingId: string, title: string, projectId: string) => void
  onMeetingUploaded: (m: Meeting) => void
}

export default function Projects({
  projects,
  selectedProject,
  meetings,
  selectedMeeting,
  onSelectProject,
  onDeleteProject,
  onProjectCreated,
  onProjectUpdated,
  onSelectMeeting,
  onDeleteMeeting,
  onBotJoined,
  onMeetingUploaded,
}: Props) {
  const [showCreate, setShowCreate] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [viewingProject, setViewingProject] = useState<Project | null>(null)

  const handleEnterProject = (p: Project) => {
    setViewingProject(p)
    onSelectProject(p)
  }

  const handleBack = () => {
    setViewingProject(null)
  }

  // Project detail / meeting view
  if (viewingProject) {
    return (
      <div className="proj-panel-wrap">
        <div className="proj-back-bar">
          <button className="proj-back-btn" onClick={handleBack}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M10 3L5 8l5 5"/>
            </svg>
            All projects
          </button>
          <span style={{ color: 'var(--text3)', fontSize: 12 }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{viewingProject.name}</span>
          {viewingProject.client && (
            <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{viewingProject.client}</span>
          )}
        </div>
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <MeetingList
            project={viewingProject}
            meetings={meetings}
            selectedId={selectedMeeting?.id ?? null}
            onSelect={onSelectMeeting}
            onDelete={onDeleteMeeting}
            onUploaded={onMeetingUploaded}
            onBotJoined={onBotJoined}
          />
          {selectedMeeting ? (
            <MeetingDetail meeting={selectedMeeting} />
          ) : (
            <div className="empty-state" style={{ flex: 1, background: 'var(--bg)' }}>
              <div className="empty-state-icon">📋</div>
              <h3>Select a meeting to view MOM</h3>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Projects grid
  return (
    <div className="panel">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div className="panel-title">Projects</div>
          <div className="panel-sub" style={{ marginBottom: 0 }}>
            Create and manage projects, assign managers and members.
          </div>
        </div>
        <button className="btn pri" onClick={() => setShowCreate(true)}>+ Create project</button>
      </div>

      <div className="proj-grid">
        {projects.map((p, i) => (
          <div
            key={p.id}
            className="proj-card"
            onClick={() => handleEnterProject(p)}
          >
            <div className="proj-card-top">
              <div className={`proj-icon ${ICON_CLASSES[i % ICON_CLASSES.length]}`}>
                {ICONS[i % ICONS.length]}
              </div>
              <span className="proj-status ps-active">Active</span>
            </div>
            <div className="proj-name">{p.name}</div>
            <div className="proj-desc">{p.description ?? 'No description.'}</div>
            <div className="proj-meta">
              <span className="proj-stat"><span>{p.meeting_count}</span> meetings</span>
              {p.client && <span className="proj-stat"><span>{p.client}</span></span>}
            </div>
            <div className="proj-members" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex' }}>
                <div className="member-av">{p.name.slice(0, 2).toUpperCase()}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn sm"
                  onClick={e => { e.stopPropagation(); setEditingProject(p) }}
                >
                  Edit
                </button>
                <button
                  className="btn sm danger"
                  onClick={e => { e.stopPropagation(); onDeleteProject(p.id) }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* New project card */}
        <div
          className="proj-card"
          style={{ borderStyle: 'dashed', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 }}
          onClick={() => setShowCreate(true)}
        >
          <div style={{ fontSize: 24, opacity: .2 }}>+</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>New project</div>
        </div>
      </div>

      {showCreate && (
        <CreateProjectModal
          onCreated={p => { onProjectCreated(p); setShowCreate(false) }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {editingProject && (
        <EditProjectModal
          project={editingProject}
          onSaved={p => { onProjectUpdated(p); setEditingProject(null) }}
          onClose={() => setEditingProject(null)}
        />
      )}
    </div>
  )
}
