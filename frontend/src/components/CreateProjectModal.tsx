import { useState, useEffect } from 'react'
import type { Project, Employee } from '../types'
import * as api from '../api'

interface MemberRow {
  name:            string
  email:           string
  role_in_project: string
  member_type:     'internal' | 'client'
  organization:    string
  employee_id:     string
}

const PROJECT_ROLES = ['BA', 'Tester', 'Developer', 'QA', 'PM', 'Scrum Master', 'Designer', 'DevOps', 'Stakeholder', 'Other']

function emptyMember(type: 'internal' | 'client'): MemberRow {
  return { name: '', email: '', role_in_project: '', member_type: type, organization: '', employee_id: '' }
}

interface Props {
  onCreated: (p: Project) => void
  onClose: () => void
}

export default function CreateProjectModal({ onCreated, onClose }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 1 – basic info
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [client, setClient]           = useState('')

  // Step 2 – internal team members
  const [teamMembers, setTeamMembers] = useState<MemberRow[]>([emptyMember('internal')])
  const [employees, setEmployees]     = useState<Employee[]>([])

  // Step 3 – client contacts
  const [clientMembers, setClientMembers] = useState<MemberRow[]>([emptyMember('client')])

  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    api.fetchEmployees().then(setEmployees).catch(() => {})
  }, [])

  // ── member row helpers ──

  const updateTeam = (i: number, field: keyof MemberRow, value: string) =>
    setTeamMembers(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r))

  const updateClient = (i: number, field: keyof MemberRow, value: string) =>
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

  // ── submit ──

  const handleSubmit = async () => {
    if (!name.trim()) { setStep(1); setError('Project name is required.'); return }
    setLoading(true)
    setError('')
    try {
      const validTeam = teamMembers.filter(m => m.name.trim())
      const validClient = clientMembers.filter(m => m.name.trim())
      const members = [
        ...validTeam.map(m => ({
          name: m.name,
          email: m.email || undefined,
          role_in_project: m.role_in_project || undefined,
          member_type: 'internal' as const,
          employee_id: m.employee_id || undefined,
        })),
        ...validClient.map(m => ({
          name: m.name,
          email: m.email || undefined,
          role_in_project: m.role_in_project || undefined,
          member_type: 'client' as const,
          organization: m.organization || undefined,
        })),
      ]
      const p = await api.createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        client: client.trim() || undefined,
        members,
      })
      onCreated(p)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 560, maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>

        {/* Header + step indicator */}
        <div className="modal-title" style={{ marginBottom: 4 }}>New Project</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {(['1', '2', '3'] as const).map((s, i) => (
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
              <input className="form-input" value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Sprint 14" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Short project description" />
            </div>
            <div className="form-group">
              <label className="form-label">Client / Organisation</label>
              <input className="form-input" value={client} onChange={e => setClient(e.target.value)}
                placeholder="e.g. Acme Corp" />
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

        {/* ── Step 2: Team members ── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Step 2 of 3 — Internal team members
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text2)' }}>
              Add your team — everyone who will participate in meetings for this project.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
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
                    onClick={() => setTeamMembers(rows => rows.filter((_, idx) => idx !== i))}
                    title="Remove">✕</button>
                </div>
              ))}
            </div>

            <button type="button" className="btn sm" onClick={() => setTeamMembers(rows => [...rows, emptyMember('internal')])}>
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
              Add client-side participants — stakeholders or vendor contacts who attend meetings.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
              {clientMembers.map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '8px 10px' }}>
                  <div style={{ flex: 2, minWidth: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Full name *</label>
                    <input className="form-input" style={{ fontSize: 12 }} value={m.name}
                      onChange={e => updateClient(i, 'name', e.target.value)} placeholder="John Doe" />
                  </div>
                  <div style={{ flex: 2, minWidth: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Email</label>
                    <input className="form-input" style={{ fontSize: 12 }} value={m.email}
                      onChange={e => updateClient(i, 'email', e.target.value)} placeholder="john@client.com" />
                  </div>
                  <div style={{ flex: 2, minWidth: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Organisation</label>
                    <input className="form-input" style={{ fontSize: 12 }} value={m.organization}
                      onChange={e => updateClient(i, 'organization', e.target.value)} placeholder="Acme Corp" />
                  </div>
                  <div style={{ flex: 2, minWidth: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Role</label>
                    <select className="form-input" style={{ fontSize: 12 }} value={m.role_in_project}
                      onChange={e => updateClient(i, 'role_in_project', e.target.value)}>
                      <option value="">— Select —</option>
                      {PROJECT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <button
                    type="button"
                    style={{ marginTop: 20, padding: '4px 6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14 }}
                    onClick={() => setClientMembers(rows => rows.filter((_, idx) => idx !== i))}
                    title="Remove">✕</button>
                </div>
              ))}
            </div>

            <button type="button" className="btn sm" onClick={() => setClientMembers(rows => [...rows, emptyMember('client')])}>
              + Add client contact
            </button>

            {error && <div className="error-msg">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>← Back</button>
              <button className="btn btn-primary" disabled={loading} onClick={handleSubmit}>
                {loading ? 'Creating…' : 'Create project'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
