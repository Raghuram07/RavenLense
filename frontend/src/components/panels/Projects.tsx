import { useState, useEffect } from 'react'
import type { Project, MeetingListItem, Meeting, Employee, Client, ProjectMember } from '../../types'
import type { Role, ROLE_META, ProjectTab } from '../../App'
import MeetingList from '../MeetingList'
import MeetingDetail from '../MeetingDetail'
import CreateProjectModal from '../CreateProjectModal'
import Chat from './Chat'
import Knowledge from './Knowledge'
import * as api from '../../api'

type RoleMeta = typeof ROLE_META[Role]

// ── Edit Project modal ────────────────────────────────────

const PROJECT_ROLES = ['BA', 'Tester', 'Developer', 'QA', 'PM', 'Scrum Master', 'Designer', 'DevOps', 'Stakeholder', 'Other']

interface EditMemberRow {
  id:              string   // existing member id, '' = new
  name:            string
  email:           string
  role_in_project: string
  member_type:     'internal' | 'client'
  organization:    string
  employee_id:     string
}

function fromProjectMember(m: ProjectMember): EditMemberRow {
  return {
    id: m.id,
    name: m.name,
    email: m.email ?? '',
    role_in_project: m.role_in_project ?? '',
    member_type: m.member_type,
    organization: m.organization ?? '',
    employee_id: m.employee_id ?? '',
  }
}

function emptyEditMember(type: 'internal' | 'client'): EditMemberRow {
  return { id: '', name: '', email: '', role_in_project: '', member_type: type, organization: '', employee_id: '' }
}

interface EditModalProps {
  project:   Project
  onSaved:   (p: Project) => void
  onClose:   () => void
}

function EditProjectModal({ project, onSaved, onClose }: EditModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)

  const [name, setName]               = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [client, setClient]           = useState(project.client ?? '')

  const [teamMembers, setTeamMembers]     = useState<EditMemberRow[]>(
    project.members.filter(m => m.member_type === 'internal').map(fromProjectMember)
  )
  const [clientMembers, setClientMembers] = useState<EditMemberRow[]>(
    project.members.filter(m => m.member_type === 'client').map(fromProjectMember)
  )
  const [removedIds, setRemovedIds] = useState<string[]>([])

  const [employees, setEmployees] = useState<Employee[]>([])
  const [clients, setClients]     = useState<Client[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    api.fetchEmployees().then(setEmployees).catch(() => {})
    api.fetchClients().then(setClients).catch(() => {})
  }, [])

  const updateTeam = (i: number, field: keyof EditMemberRow, value: string) =>
    setTeamMembers(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r))

  const updateClientRow = (i: number, field: keyof EditMemberRow, value: string) =>
    setClientMembers(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r))

  const pickEmployee = (i: number, empId: string) => {
    const emp = employees.find(e => e.id === empId)
    if (!emp) { updateTeam(i, 'employee_id', ''); return }
    setTeamMembers(rows => rows.map((r, idx) =>
      idx === i
        ? { ...r, employee_id: emp.id, name: `${emp.first_name} ${emp.last_name}`, email: emp.email }
        : r
    ))
  }

  const removeMember = (rows: EditMemberRow[], setRows: React.Dispatch<React.SetStateAction<EditMemberRow[]>>, i: number) => {
    const row = rows[i]
    if (row.id) setRemovedIds(ids => [...ids, row.id])
    setRows(r => r.filter((_, idx) => idx !== i))
  }

  const handleSubmit = async () => {
    if (!name.trim()) { setStep(1); setError('Project name is required.'); return }
    setLoading(true)
    setError('')
    try {
      const updatedBase = await api.updateProject(project.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        client: client.trim() || undefined,
      })

      // Remove deleted members
      await Promise.all(removedIds.map(id => api.removeProjectMember(project.id, id)))

      // Add new members
      const allNew = [...teamMembers, ...clientMembers].filter(m => !m.id && m.name.trim())
      const added = await Promise.all(allNew.map(m =>
        api.addProjectMember(project.id, {
          name: m.name,
          email: m.email || undefined,
          role_in_project: m.role_in_project || undefined,
          member_type: m.member_type,
          organization: m.organization || undefined,
          employee_id: m.employee_id || undefined,
        })
      ))

      // Build updated members list
      const existing = [...teamMembers, ...clientMembers]
        .filter(m => m.id)
        .map(m => project.members.find(pm => pm.id === m.id)!)
        .filter(Boolean)

      onSaved({ ...updatedBase, members: [...existing, ...added] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update project.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 820, maxWidth: '96vw' }} onClick={e => e.stopPropagation()}>
        <div className="modal-title" style={{ marginBottom: 4 }}>Edit project</div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {[1, 2, 3].map((s, i) => (
            <div key={s} style={{
              height: 3, flex: 1, borderRadius: 2,
              background: step > i ? 'var(--accent)' : step === i + 1 ? 'var(--accent)' : 'var(--border2)',
            }} />
          ))}
        </div>

        {/* ── Step 1: Basic info ── */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Step 1 of 3 — Project details
            </div>
            <div className="form-group">
              <label className="form-label">Project name *</label>
              <input className="form-input" value={name} onChange={e => setName(e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Client / Organisation</label>
              <select className="form-input" value={client} onChange={e => setClient(e.target.value)}>
                <option value="">— Select client —</option>
                {clients.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description" />
            </div>
            {error && <div className="error-msg">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { if (!name.trim()) { setError('Project name is required.'); return } setError(''); setStep(2) }}>
                Next →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Our employees ── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Step 2 of 3 — Our employees
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text2)' }}>
              Manage your internal team members for this project.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
              {teamMembers.map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '8px 10px' }}>
                  <div style={{ flex: 2, minWidth: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Link to employee</label>
                    <select className="form-input" style={{ fontSize: 12 }}
                      value={m.employee_id}
                      onChange={e => pickEmployee(i, e.target.value)}>
                      <option value="">— Type manually —</option>
                      {employees.map(e => (
                        <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 2, minWidth: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Full name *</label>
                    <input className="form-input" style={{ fontSize: 12 }} value={m.name}
                      onChange={e => updateTeam(i, 'name', e.target.value)} placeholder="Jane Smith" />
                  </div>
                  <div style={{ flex: 2, minWidth: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Email</label>
                    <input className="form-input" style={{ fontSize: 12 }} value={m.email}
                      onChange={e => updateTeam(i, 'email', e.target.value)} placeholder="jane@co.com" />
                  </div>
                  <div style={{ flex: 2, minWidth: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Role in project</label>
                    <select className="form-input" style={{ fontSize: 12 }} value={m.role_in_project}
                      onChange={e => updateTeam(i, 'role_in_project', e.target.value)}>
                      <option value="">— Select —</option>
                      {PROJECT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <button
                    type="button"
                    style={{ marginTop: 20, padding: '4px 6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14 }}
                    onClick={() => removeMember(teamMembers, setTeamMembers, i)}
                    title="Remove">✕</button>
                </div>
              ))}
            </div>

            <button type="button" className="btn sm" onClick={() => setTeamMembers(rows => [...rows, emptyEditMember('internal')])}>
              + Add member
            </button>

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary" onClick={() => setStep(3)}>Next →</button>
            </div>
          </div>
        )}

        {/* ── Step 3: Client contacts ── */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Step 3 of 3 — Client contacts
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text2)' }}>
              Manage client-side participants for this project.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
              {clientMembers.map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '8px 10px' }}>
                  <div style={{ flex: 2, minWidth: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Full name *</label>
                    <input className="form-input" style={{ fontSize: 12 }} value={m.name}
                      onChange={e => updateClientRow(i, 'name', e.target.value)} placeholder="John Doe" />
                  </div>
                  <div style={{ flex: 2, minWidth: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Email</label>
                    <input className="form-input" style={{ fontSize: 12 }} value={m.email}
                      onChange={e => updateClientRow(i, 'email', e.target.value)} placeholder="john@client.com" />
                  </div>
                  <div style={{ flex: 2, minWidth: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Organisation</label>
                    <input className="form-input" style={{ fontSize: 12 }} value={m.organization}
                      onChange={e => updateClientRow(i, 'organization', e.target.value)} placeholder="Acme Corp" />
                  </div>
                  <div style={{ flex: 2, minWidth: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Role</label>
                    <select className="form-input" style={{ fontSize: 12 }} value={m.role_in_project}
                      onChange={e => updateClientRow(i, 'role_in_project', e.target.value)}>
                      <option value="">— Select —</option>
                      {PROJECT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <button
                    type="button"
                    style={{ marginTop: 20, padding: '4px 6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14 }}
                    onClick={() => removeMember(clientMembers, setClientMembers, i)}
                    title="Remove">✕</button>
                </div>
              ))}
            </div>

            <button type="button" className="btn sm" onClick={() => setClientMembers(rows => [...rows, emptyEditMember('client')])}>
              + Add client contact
            </button>

            {error && <div className="error-msg">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>← Back</button>
              <button className="btn btn-primary" disabled={loading} onClick={handleSubmit}>
                {loading ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const ICONS = ['🔭', '📊', '🚢', '🔬', '💡', '🌐', '🛠', '📱']
const ICON_CLASSES = ['pi-blue', 'pi-green', 'pi-purple', 'pi-amber', 'pi-blue', 'pi-green', 'pi-purple', 'pi-amber']

// ── Project Overview Tab ──────────────────────────────────

interface OverviewTabProps {
  project: Project
  meetingCount: number
  onEdit: () => void
}

function ProjectOverviewTab({ project, meetingCount, onEdit }: OverviewTabProps) {
  const internal = project.members.filter(m => m.member_type === 'internal')
  const client   = project.members.filter(m => m.member_type === 'client')

  const MemberRow = ({ m }: { m: ProjectMember }) => (
    <div className="proj-ov-member-row">
      <div className="emp-av" style={{ width: 30, height: 30, fontSize: 11, flexShrink: 0 }}>
        {m.name.slice(0, 2).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</div>
        {m.email && <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{m.email}</div>}
      </div>
      {m.role_in_project && (
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'var(--blue-bg)', color: 'var(--blue)', flexShrink: 0 }}>
          {m.role_in_project}
        </span>
      )}
      {m.organization && (
        <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>{m.organization}</span>
      )}
    </div>
  )

  return (
    <div className="proj-overview">
      <div className="proj-ov-header">
        <div>
          <div className="proj-ov-title">{project.name}</div>
          {project.description && (
            <div className="proj-ov-desc">{project.description}</div>
          )}
        </div>
        <button className="btn sm" onClick={onEdit}>Edit project</button>
      </div>

      {/* Stats */}
      <div className="proj-ov-stats">
        <div className="proj-ov-stat">
          <div className="proj-ov-stat-val">{meetingCount}</div>
          <div className="proj-ov-stat-lbl">Meetings</div>
        </div>
        <div className="proj-ov-stat">
          <div className="proj-ov-stat-val">{project.members.length}</div>
          <div className="proj-ov-stat-lbl">Members</div>
        </div>
        <div className="proj-ov-stat">
          <div className="proj-ov-stat-val">0</div>
          <div className="proj-ov-stat-lbl">Action Items</div>
        </div>
      </div>

      {/* Members */}
      {project.members.length > 0 && (
        <div className="proj-ov-members">
          <div className="proj-ov-team-section">
            <div className="proj-ov-section-head">
              <span>Our Team</span>
              <span>{internal.length}</span>
            </div>
            {internal.length > 0
              ? internal.map(m => <MemberRow key={m.id} m={m} />)
              : <div className="proj-ov-empty">No internal members yet.</div>
            }
          </div>
          <div className="proj-ov-team-section">
            <div className="proj-ov-section-head">
              <span>Client Contacts</span>
              <span>{client.length}</span>
            </div>
            {client.length > 0
              ? client.map(m => <MemberRow key={m.id} m={m} />)
              : <div className="proj-ov-empty">No client contacts yet.</div>
            }
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Projects component ───────────────────────────────

interface Props {
  projects: Project[]
  selectedProject: Project | null
  meetings: MeetingListItem[]
  selectedMeeting: Meeting | null
  onDeleteProject: (id: string) => void
  onProjectCreated: (p: Project) => void
  onProjectUpdated: (p: Project) => void
  onSelectMeeting: (m: MeetingListItem) => void
  onDeleteMeeting: (id: string) => void
  onBotJoined: (meetingId: string, title: string, projectId: string) => void
  onMeetingUploaded: (m: Meeting) => void
  role: Role
  roleMeta: RoleMeta
  viewingProject: Project | null
  onEnterProject: (p: Project) => void
  onBack: () => void
  projectTab: ProjectTab
}

export default function Projects({
  projects,
  selectedProject,
  meetings,
  selectedMeeting,
  onDeleteProject,
  onProjectCreated,
  onProjectUpdated,
  onSelectMeeting,
  onDeleteMeeting,
  onBotJoined,
  onMeetingUploaded,
  role,
  roleMeta,
  viewingProject,
  onEnterProject,
  onBack,
  projectTab,
}: Props) {
  const [showCreate, setShowCreate] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  // ── Project detail view ──
  if (viewingProject) {
    return (
      <div className="proj-panel-wrap">
        {/* Back bar */}
        <div className="proj-back-bar">
          <button className="proj-back-btn" onClick={onBack}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M10 3L5 8l5 5"/>
            </svg>
            Projects
          </button>
          <span style={{ color: 'var(--text3)', fontSize: 12 }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{viewingProject.name}</span>
          {viewingProject.client && (
            <span style={{ fontSize: 11.5, padding: '1px 7px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text3)' }}>
              {viewingProject.client}
            </span>
          )}
          <span className="proj-status ps-active" style={{ marginLeft: 'auto' }}>Active</span>
        </div>

        {/* Tab content */}
        {projectTab === 'overview' && (
          <ProjectOverviewTab
            project={viewingProject}
            meetingCount={meetings.length}
            onEdit={() => setEditingProject(viewingProject)}
          />
        )}

        {projectTab === 'chat' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Chat roleMeta={roleMeta} selectedProject={viewingProject} />
          </div>
        )}

        {projectTab === 'knowledge' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Knowledge role={role} selectedProject={viewingProject} />
          </div>
        )}

        {projectTab === 'actions' && (
          <div className="tab-placeholder">
            <div className="tab-placeholder-icon">✅</div>
            <div className="tab-placeholder-title">Action Items</div>
            <div className="tab-placeholder-sub">Track and manage action items from meetings.</div>
          </div>
        )}

        {projectTab === 'meetings' && (
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
        )}

        {projectTab === 'uploads' && (
          <div className="tab-placeholder">
            <div className="tab-placeholder-icon">📎</div>
            <div className="tab-placeholder-title">Uploads</div>
            <div className="tab-placeholder-sub">Upload and manage project documents and files.</div>
          </div>
        )}
      </div>
    )
  }

  // ── Projects grid ──
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
            onClick={() => onEnterProject(p)}
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
