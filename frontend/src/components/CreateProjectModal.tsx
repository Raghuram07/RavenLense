import { useState, useEffect, useMemo } from 'react'
import type { Project, Employee, Client } from '../types'
import * as api from '../api'

interface InternalRow {
  employee_id:     string
  role_in_project: string
}

interface ClientContactRow {
  client_contact_id: string
  role_in_project:   string
}

const PROJECT_ROLES = ['BA', 'Tester', 'Developer', 'QA', 'PM', 'Scrum Master', 'Designer', 'DevOps', 'Stakeholder', 'Other']

function emptyInternal(): InternalRow { return { employee_id: '', role_in_project: '' } }
function emptyClientContact(): ClientContactRow { return { client_contact_id: '', role_in_project: '' } }

interface Props {
  onCreated: (p: Project) => void
  onClose: () => void
}

export default function CreateProjectModal({ onCreated, onClose }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 1 – basic info
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [clientId, setClientId]       = useState('')

  // Step 2 – internal team members
  const [teamRows, setTeamRows] = useState<InternalRow[]>([emptyInternal()])
  const [employees, setEmployees] = useState<Employee[]>([])

  // Step 3 – client contacts
  const [contactRows, setContactRows] = useState<ClientContactRow[]>([emptyClientContact()])

  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    api.fetchEmployees().then(setEmployees).catch(() => {})
    api.fetchClients().then(setClients).catch(() => {})
  }, [])

  // Derive contacts from the already-loaded clients list
  const contacts = useMemo(
    () => clients.find(c => c.id === clientId)?.contacts ?? [],
    [clients, clientId]
  )

  const updateTeam = (i: number, field: keyof InternalRow, value: string) =>
    setTeamRows(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r))

  const updateContact = (i: number, field: keyof ClientContactRow, value: string) =>
    setContactRows(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r))

  const handleSubmit = async () => {
    if (!name.trim()) { setStep(1); setError('Project name is required.'); return }
    setLoading(true)
    setError('')
    try {
      const internalMembers = teamRows
        .filter(r => r.employee_id)
        .map(r => ({
          member_type: 'internal' as const,
          employee_id: r.employee_id,
          role_in_project: r.role_in_project || undefined,
        }))
      const clientMembers = contactRows
        .filter(r => r.client_contact_id)
        .map(r => ({
          member_type: 'client' as const,
          client_contact_id: r.client_contact_id,
          role_in_project: r.role_in_project || undefined,
        }))
      const p = await api.createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        client_id: clientId || undefined,
        members: [...internalMembers, ...clientMembers],
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
      <div className="modal" style={{ width: 820, maxWidth: '96vw' }} onClick={e => e.stopPropagation()}>

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
              <select className="form-input" value={clientId} onChange={e => setClientId(e.target.value)}>
                <option value="">— Select client —</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
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

        {/* ── Step 2: Internal team members ── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Step 2 of 3 — Our employees
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text2)' }}>
              Add your team — everyone who will participate in meetings for this project.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
              {teamRows.map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '8px 10px' }}>
                  <div style={{ flex: 3, minWidth: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Employee *</label>
                    <select className="form-input" style={{ fontSize: 12 }}
                      value={m.employee_id}
                      onChange={e => updateTeam(i, 'employee_id', e.target.value)}>
                      <option value="">— Select employee —</option>
                      {employees.map(e => (
                        <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.email})</option>
                      ))}
                    </select>
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
                    onClick={() => setTeamRows(rows => rows.filter((_, idx) => idx !== i))}
                    title="Remove">✕</button>
                </div>
              ))}
            </div>

            <button type="button" className="btn sm" onClick={() => setTeamRows(rows => [...rows, emptyInternal()])}>
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

            {!clientId && (
              <div style={{ fontSize: 12.5, color: 'var(--text3)', padding: '10px 0' }}>
                No client selected. Go back to step 1 to assign a client, or skip this step.
              </div>
            )}

            {clientId && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                {contactRows.map((m, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '8px 10px' }}>
                    <div style={{ flex: 3, minWidth: 0 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>Client contact *</label>
                      <select className="form-input" style={{ fontSize: 12 }}
                        value={m.client_contact_id}
                        onChange={e => updateContact(i, 'client_contact_id', e.target.value)}>
                        <option value="">— Select contact —</option>
                        {contacts.map(c => (
                          <option key={c.id} value={c.id}>{c.name}{c.email ? ` (${c.email})` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ flex: 2, minWidth: 0 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>Role</label>
                      <select className="form-input" style={{ fontSize: 12 }} value={m.role_in_project}
                        onChange={e => updateContact(i, 'role_in_project', e.target.value)}>
                        <option value="">— Select —</option>
                        {PROJECT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <button
                      type="button"
                      style={{ marginTop: 20, padding: '4px 6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14 }}
                      onClick={() => setContactRows(rows => rows.filter((_, idx) => idx !== i))}
                      title="Remove">✕</button>
                  </div>
                ))}
              </div>
            )}

            {clientId && (
              <button type="button" className="btn sm" onClick={() => setContactRows(rows => [...rows, emptyClientContact()])}>
                + Add client contact
              </button>
            )}

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
