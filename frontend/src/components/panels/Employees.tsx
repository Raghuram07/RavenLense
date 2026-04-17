import { useState, useEffect } from 'react'
import type { Employee, EmployeeCreate } from '../../types'
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

const AV_COLORS = ['av-blue', 'av-teal', 'av-purple', 'av-green', 'av-orange', 'av-pink', 'av-indigo', 'av-amber']
function avColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AV_COLORS[h % AV_COLORS.length]
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
          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="form-input" value={form.role} onChange={set('role')}>
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
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
                <div className={`emp-av ${avColor(emp.first_name + emp.last_name)}`}>{initials(emp)}</div>
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

// ── Main component ────────────────────────────────────────

export default function Employees() {
  return (
    <div className="panel">
      <div className="panel-title">Employees</div>
      <div className="panel-sub">Manage team members, roles, and access.</div>
      <TeamTab />
    </div>
  )
}
