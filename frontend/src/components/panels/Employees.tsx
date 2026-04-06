import { useState, useEffect } from 'react'
import type { Employee, EmployeeCreate, Client, ClientCreate } from '../../types'
import * as api from '../../api'

// ── Role display maps ─────────────────────────────────────

const ROLE_PILL: Record<string, string> = {
  admin:    'rp-admin',
  manager:  'rp-manager',
  employee: 'rp-employee',
}

const ROLE_LABEL: Record<string, string> = {
  admin:    'Admin',
  manager:  'Manager',
  employee: 'Employee',
}

function initials(emp: Employee) {
  return `${emp.first_name[0] ?? ''}${emp.last_name[0] ?? ''}`.toUpperCase()
}

// ── Invite Employee modal ─────────────────────────────────

interface InviteModalProps {
  onCreated: (emp: Employee) => void
  onClose: () => void
}

function InviteModal({ onCreated, onClose }: InviteModalProps) {
  const [form, setForm] = useState<EmployeeCreate>({
    first_name:   '',
    last_name:    '',
    email:        '',
    department:   '',
    organization: '',
    role:         'employee',
    project:      '',
    status:       'active',
  })
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)

  const set = (field: keyof EmployeeCreate) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.first_name.trim() || !form.email.trim()) {
      setError('First name and email are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const emp = await api.createEmployee({
        ...form,
        department:   form.department   || undefined,
        organization: form.organization || undefined,
        project:      form.project      || undefined,
      })
      onCreated(emp)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to invite employee.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Invite employee</div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">First name *</label>
              <input className="form-input" value={form.first_name} onChange={set('first_name')} placeholder="Jane" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Last name</label>
              <input className="form-input" value={form.last_name} onChange={set('last_name')} placeholder="Smith" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email *</label>
            <input className="form-input" type="email" value={form.email} onChange={set('email')} placeholder="jane@company.com" />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Organisation</label>
              <input className="form-input" value={form.organization} onChange={set('organization')} placeholder="Acme Corp" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Department</label>
              <input className="form-input" value={form.department} onChange={set('department')} placeholder="Engineering" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Role</label>
              <select className="form-input" value={form.role} onChange={set('role')}>
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Project</label>
              <input className="form-input" value={form.project} onChange={set('project')} placeholder="Project name (optional)" />
            </div>
          </div>
          {error && <div className="error-msg">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn pri sm" disabled={saving}>
              {saving ? 'Inviting…' : 'Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Add Client modal ──────────────────────────────────────

interface AddClientModalProps {
  onCreated: (c: Client) => void
  onClose:   () => void
}

function AddClientModal({ onCreated, onClose }: AddClientModalProps) {
  const [name,    setName]    = useState('')
  const [email,   setEmail]   = useState('')
  const [phone,   setPhone]   = useState('')
  const [contacts, setContacts] = useState([{ name: '', email: '', role: '' }])
  const [error,   setError]   = useState('')
  const [saving,  setSaving]  = useState(false)

  const updContact = (i: number, field: string, val: string) =>
    setContacts(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Client name is required.'); return }
    setSaving(true)
    setError('')
    try {
      const data: ClientCreate = {
        name,
        email: email || undefined,
        phone: phone || undefined,
        contacts: contacts
          .filter(c => c.name.trim())
          .map(c => ({ name: c.name, email: c.email || undefined, role: c.role || undefined })),
      }
      const c = await api.createClient(data)
      onCreated(c)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add client.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">Add client</div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Organisation name *</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Acme Corp" autoFocus />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Contact email</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="info@acme.com" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Phone</label>
              <input className="form-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555 000" />
            </div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginTop: 4 }}>Client contacts</div>
          {contacts.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 6 }}>
              <input className="form-input" style={{ flex: 2 }} value={c.name}
                onChange={e => updContact(i, 'name', e.target.value)} placeholder="Name" />
              <input className="form-input" style={{ flex: 2 }} value={c.email}
                onChange={e => updContact(i, 'email', e.target.value)} placeholder="Email" />
              <input className="form-input" style={{ flex: 1 }} value={c.role}
                onChange={e => updContact(i, 'role', e.target.value)} placeholder="Role" />
              <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}
                onClick={() => setContacts(rows => rows.filter((_, idx) => idx !== i))}>✕</button>
            </div>
          ))}
          <button type="button" className="btn sm"
            onClick={() => setContacts(rows => [...rows, { name: '', email: '', role: '' }])}>
            + Add contact
          </button>

          {error && <div className="error-msg">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn pri sm" disabled={saving}>
              {saving ? 'Adding…' : 'Add client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Team tab ──────────────────────────────────────────────

function TeamTab() {
  const [employees, setEmployees]     = useState<Employee[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [search, setSearch]           = useState('')
  const [roleFilter, setRoleFilter]   = useState('All roles')
  const [showInvite, setShowInvite]   = useState(false)

  useEffect(() => {
    setLoading(true)
    api.fetchEmployees()
      .then(data => setEmployees(data))
      .catch(err => setError(err.message ?? 'Failed to load employees.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = employees.filter(e => {
    const fullName = `${e.first_name} ${e.last_name}`.toLowerCase()
    const matchSearch = !search || fullName.includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase())
    const matchRole   = roleFilter === 'All roles' || ROLE_LABEL[e.role] === roleFilter
    return matchSearch && matchRole
  })

  const handleToggleStatus = async (emp: Employee) => {
    try {
      const updated = await api.toggleEmployeeStatus(emp.id)
      setEmployees(prev => prev.map(e => e.id === emp.id ? updated : e))
    } catch { /* ignore */ }
  }

  const handleDelete = async (emp: Employee) => {
    if (!confirm(`Remove ${emp.first_name} ${emp.last_name}?`)) return
    try {
      await api.deleteEmployee(emp.id)
      setEmployees(prev => prev.filter(e => e.id !== emp.id))
    } catch { /* ignore */ }
  }

  return (
    <>
      <div className="toolbar">
        <div className="search-box">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="6.5" cy="6.5" r="4"/>
            <path d="M10 10L13.5 13.5" strokeLinecap="round"/>
          </svg>
          <input placeholder="Search employees…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select
          style={{ fontFamily: 'var(--font)', fontSize: 12.5, padding: '7px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)', outline: 'none' }}
          value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option>All roles</option>
          <option>Admin</option>
          <option>Manager</option>
          <option>Employee</option>
        </select>
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn pri sm" onClick={() => setShowInvite(true)}>+ Invite employee</button>
        </div>
      </div>

      {loading && <div style={{ fontSize: 13, color: 'var(--text3)', padding: '24px 0', textAlign: 'center' }}>Loading…</div>}
      {!loading && error && <div style={{ fontSize: 13, color: 'var(--red)', padding: '12px 0' }}>{error}</div>}

      {!loading && !error && (
        <div className="emp-table">
          <div className="et-head">
            <span className="eth">Name</span>
            <span className="eth">Organisation</span>
            <span className="eth">Role</span>
            <span className="eth">Department</span>
            <span className="eth">Status</span>
            <span className="eth" />
          </div>
          {filtered.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text3)', padding: '24px 0', textAlign: 'center' }}>
              {employees.length === 0 ? 'No employees yet. Click "Invite employee" to add the first one.' : 'No employees match your search.'}
            </div>
          ) : filtered.map(emp => (
            <div key={emp.id} className="et-row">
              <div className="emp-name-cell">
                <div className="emp-av">{initials(emp)}</div>
                <div>
                  <div className="emp-name">{emp.first_name} {emp.last_name}</div>
                  <div className="emp-email">{emp.email}</div>
                </div>
              </div>
              <div className="etd">{emp.organization ?? '—'}</div>
              <div>
                <span className={`role-pill ${ROLE_PILL[emp.role] ?? ''}`}>{ROLE_LABEL[emp.role] ?? emp.role}</span>
              </div>
              <div className="etd">{emp.department ?? '—'}</div>
              <div>
                <span
                  className={emp.status === 'active' ? 'active-dot' : 'inactive-dot'}
                  style={{ cursor: 'pointer' }}
                  title="Click to toggle"
                  onClick={() => handleToggleStatus(emp)}>
                  {emp.status === 'active' ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="row-actions">
                <button className="icon-btn" title="Remove" onClick={() => handleDelete(emp)}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 3l10 10M13 3L3 13"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showInvite && (
        <InviteModal
          onCreated={emp => { setEmployees(prev => [emp, ...prev]); setShowInvite(false) }}
          onClose={() => setShowInvite(false)}
        />
      )}
    </>
  )
}

// ── Clients tab ───────────────────────────────────────────

function ClientsTab() {
  const [clients, setClients]       = useState<Client[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [showAdd, setShowAdd]       = useState(false)
  const [expanded, setExpanded]     = useState<Set<string>>(new Set())

  useEffect(() => {
    api.fetchClients()
      .then(setClients)
      .catch(err => setError(err.message ?? 'Failed to load clients.'))
      .finally(() => setLoading(false))
  }, [])

  const toggle = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const handleDeleteClient = async (c: Client) => {
    if (!confirm(`Remove client "${c.name}" and all their contacts?`)) return
    try {
      await api.deleteClient(c.id)
      setClients(prev => prev.filter(x => x.id !== c.id))
    } catch { /* ignore */ }
  }

  const handleDeleteContact = async (clientId: string, contactId: string) => {
    try {
      await api.deleteClientContact(clientId, contactId)
      setClients(prev => prev.map(c =>
        c.id === clientId ? { ...c, contacts: c.contacts.filter(x => x.id !== contactId) } : c
      ))
    } catch { /* ignore */ }
  }

  return (
    <>
      <div className="toolbar">
        <div style={{ flex: 1 }} />
        <button className="btn pri sm" onClick={() => setShowAdd(true)}>+ Add client</button>
      </div>

      {loading && <div style={{ fontSize: 13, color: 'var(--text3)', padding: '24px 0', textAlign: 'center' }}>Loading…</div>}
      {!loading && error && <div style={{ fontSize: 13, color: 'var(--red)', padding: '12px 0' }}>{error}</div>}

      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {clients.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text3)', padding: '24px 0', textAlign: 'center' }}>
              No clients yet. Click "Add client" to create one.
            </div>
          )}
          {clients.map(c => (
            <div key={c.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
              {/* Client header */}
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface)', cursor: 'pointer' }}
                onClick={() => toggle(c.id)}>
                <span style={{ fontSize: 12, color: 'var(--text3)', transform: expanded.has(c.id) ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.15s' }}>▶</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{c.name}</div>
                  {(c.email || c.phone) && (
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{[c.email, c.phone].filter(Boolean).join(' · ')}</div>
                  )}
                </div>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>{c.contacts.length} contact{c.contacts.length !== 1 ? 's' : ''}</span>
                <button className="icon-btn" title="Remove" onClick={e => { e.stopPropagation(); handleDeleteClient(c) }}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 3l10 10M13 3L3 13"/>
                  </svg>
                </button>
              </div>

              {/* Contacts */}
              {expanded.has(c.id) && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  {c.contacts.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: 'var(--text3)', padding: '10px 40px' }}>No contacts.</div>
                  ) : c.contacts.map(contact => (
                    <div key={contact.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px 8px 40px', borderBottom: '1px solid var(--border)' }}>
                      <div className="emp-av" style={{ width: 28, height: 28, fontSize: 11 }}>
                        {contact.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13 }}>{contact.name}</div>
                        {contact.email && <div style={{ fontSize: 12, color: 'var(--text3)' }}>{contact.email}</div>}
                      </div>
                      {contact.role && (
                        <span style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 99, background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                          {contact.role}
                        </span>
                      )}
                      <button className="icon-btn" title="Remove contact" onClick={() => handleDeleteContact(c.id, contact.id)}>
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M3 3l10 10M13 3L3 13"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddClientModal
          onCreated={c => { setClients(prev => [c, ...prev]); setShowAdd(false) }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </>
  )
}

// ── Main component ────────────────────────────────────────

export default function Employees() {
  const [tab, setTab] = useState<'team' | 'clients'>('team')

  return (
    <div className="panel">
      <div className="panel-title">People</div>
      <div className="panel-sub">Manage team members, clients, roles, and access.</div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        {(['team', 'clients'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 16px', fontSize: 13, fontWeight: tab === t ? 600 : 400,
              color: tab === t ? 'var(--accent)' : 'var(--text2)',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
            }}>
            {t === 'team' ? 'Team' : 'Clients'}
          </button>
        ))}
      </div>

      {tab === 'team'    && <TeamTab />}
      {tab === 'clients' && <ClientsTab />}
    </div>
  )
}
