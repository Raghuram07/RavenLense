import { useState, useEffect } from 'react'
import type { Client, ClientCreate, ClientContact } from '../../types'
import * as api from '../../api'

// ── Add Client modal ──────────────────────────────────────

interface AddClientModalProps {
  onCreated: (c: Client) => void
  onClose:   () => void
}

function AddClientModal({ onCreated, onClose }: AddClientModalProps) {
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [phone,    setPhone]    = useState('')
  const [contacts, setContacts] = useState([{ name: '', email: '', role: '' }])
  const [error,    setError]    = useState('')
  const [saving,   setSaving]   = useState(false)

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
      <div className="modal" style={{ width: 560 }} onClick={e => e.stopPropagation()}>
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

          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginTop: 4 }}>Contacts</div>
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
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Adding…' : 'Add client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Edit Client modal ─────────────────────────────────────

interface EditClientModalProps {
  client:  Client
  onSaved: (c: Client) => void
  onClose: () => void
}

function EditClientModal({ client, onSaved, onClose }: EditClientModalProps) {
  const [name,  setName]  = useState(client.name)
  const [email, setEmail] = useState(client.email ?? '')
  const [phone, setPhone] = useState(client.phone ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Client name is required.'); return }
    setSaving(true)
    setError('')
    try {
      const updated = await api.updateClient(client.id, {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      })
      onSaved(updated)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update client.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Edit client</div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Organisation name *</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} autoFocus />
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
          {error && <div className="error-msg">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Edit Contact modal ────────────────────────────────────

interface EditContactModalProps {
  clientId: string
  contact:  ClientContact
  onSaved:  (c: ClientContact) => void
  onClose:  () => void
}

function EditContactModal({ clientId, contact, onSaved, onClose }: EditContactModalProps) {
  const [name,  setName]  = useState(contact.name)
  const [email, setEmail] = useState(contact.email ?? '')
  const [role,  setRole]  = useState(contact.role ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required.'); return }
    setSaving(true)
    setError('')
    try {
      const updated = await api.updateClientContact(clientId, contact.id, {
        name: name.trim(),
        email: email.trim() || undefined,
        role: role.trim() || undefined,
      })
      onSaved(updated)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update contact.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Edit contact</div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Role</label>
              <input className="form-input" value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Stakeholder" />
            </div>
          </div>
          {error && <div className="error-msg">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Add Contact inline modal ──────────────────────────────

interface AddContactModalProps {
  clientId: string
  onAdded:  (c: ClientContact) => void
  onClose:  () => void
}

function AddContactModal({ clientId, onAdded, onClose }: AddContactModalProps) {
  const [name,  setName]  = useState('')
  const [email, setEmail] = useState('')
  const [role,  setRole]  = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required.'); return }
    setSaving(true)
    setError('')
    try {
      const contact = await api.addClientContact(clientId, {
        name: name.trim(),
        email: email.trim() || undefined,
        role: role.trim() || undefined,
      })
      onAdded(contact)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add contact.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Add contact</div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Role</label>
              <input className="form-input" value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Stakeholder" />
            </div>
          </div>
          {error && <div className="error-msg">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Adding…' : 'Add contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Clients panel ────────────────────────────────────

export default function Clients() {
  const [clients, setClients]       = useState<Client[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [search, setSearch]         = useState('')
  const [showAdd, setShowAdd]       = useState(false)
  const [expanded, setExpanded]     = useState<Set<string>>(new Set())
  const [editingClient, setEditingClient]   = useState<Client | null>(null)
  const [editingContact, setEditingContact] = useState<{ clientId: string; contact: ClientContact } | null>(null)
  const [addingContactTo, setAddingContactTo] = useState<string | null>(null)

  useEffect(() => {
    api.fetchClients()
      .then(setClients)
      .catch(err => setError(err.message ?? 'Failed to load clients.'))
      .finally(() => setLoading(false))
  }, [])

  const toggle = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const filtered = clients.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleDeleteClient = async (c: Client) => {
    if (!confirm(`Remove client "${c.name}" and all their contacts?`)) return
    try {
      await api.deleteClient(c.id)
      setClients(prev => prev.filter(x => x.id !== c.id))
    } catch { /* ignore */ }
  }

  const handleDeleteContact = async (clientId: string, contactId: string) => {
    if (!confirm('Remove this contact?')) return
    try {
      await api.deleteClientContact(clientId, contactId)
      setClients(prev => prev.map(c =>
        c.id === clientId ? { ...c, contacts: c.contacts.filter(x => x.id !== contactId) } : c
      ))
    } catch { /* ignore */ }
  }

  return (
    <div className="panel">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div className="panel-title">Clients</div>
          <div className="panel-sub" style={{ marginBottom: 0 }}>
            Manage client organisations and their contacts.
          </div>
        </div>
        <button className="btn pri" onClick={() => setShowAdd(true)}>+ Add client</button>
      </div>

      {/* Search */}
      <div className="toolbar" style={{ marginBottom: 16 }}>
        <div className="search-box">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="6.5" cy="6.5" r="4"/>
            <path d="M10 10L13.5 13.5" strokeLinecap="round"/>
          </svg>
          <input placeholder="Search clients…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {loading && <div style={{ fontSize: 13, color: 'var(--text3)', padding: '24px 0', textAlign: 'center' }}>Loading…</div>}
      {!loading && error && <div style={{ fontSize: 13, color: 'var(--red)', padding: '12px 0' }}>{error}</div>}

      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text3)', padding: '24px 0', textAlign: 'center' }}>
              {clients.length === 0 ? 'No clients yet. Click "+ Add client" to create one.' : 'No clients match your search.'}
            </div>
          )}

          {filtered.map(c => (
            <div key={c.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
              {/* Client row */}
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface)', cursor: 'pointer' }}
                onClick={() => toggle(c.id)}>
                <span style={{ fontSize: 11, color: 'var(--text3)', transform: expanded.has(c.id) ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.15s' }}>▶</span>
                <div className="emp-av" style={{ width: 32, height: 32, fontSize: 12, flexShrink: 0 }}>
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{c.name}</div>
                  {(c.email || c.phone) && (
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{[c.email, c.phone].filter(Boolean).join(' · ')}</div>
                  )}
                </div>
                <span style={{ fontSize: 12, color: 'var(--text3)', flexShrink: 0 }}>
                  {c.contacts.length} contact{c.contacts.length !== 1 ? 's' : ''}
                </span>
                <button
                  className="btn sm"
                  onClick={e => { e.stopPropagation(); setEditingClient(c) }}
                  title="Edit client">
                  Edit
                </button>
                <button
                  className="icon-btn"
                  title="Delete client"
                  onClick={e => { e.stopPropagation(); handleDeleteClient(c) }}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 3l10 10M13 3L3 13"/>
                  </svg>
                </button>
              </div>

              {/* Contacts */}
              {expanded.has(c.id) && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  {c.contacts.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: 'var(--text3)', padding: '10px 48px' }}>No contacts yet.</div>
                  ) : c.contacts.map(contact => (
                    <div key={contact.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px 8px 48px', borderBottom: '1px solid var(--border)' }}>
                      <div className="emp-av" style={{ width: 28, height: 28, fontSize: 11, flexShrink: 0 }}>
                        {contact.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13 }}>{contact.name}</div>
                        {contact.email && <div style={{ fontSize: 12, color: 'var(--text3)' }}>{contact.email}</div>}
                      </div>
                      {contact.role && (
                        <span style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 99, background: 'var(--accent-bg)', color: 'var(--accent)', flexShrink: 0 }}>
                          {contact.role}
                        </span>
                      )}
                      <button
                        className="btn sm"
                        onClick={() => setEditingContact({ clientId: c.id, contact })}
                        title="Edit contact">
                        Edit
                      </button>
                      <button
                        className="icon-btn"
                        title="Remove contact"
                        onClick={() => handleDeleteContact(c.id, contact.id)}>
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M3 3l10 10M13 3L3 13"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                  {/* Add contact row */}
                  <div style={{ padding: '8px 14px 8px 48px' }}>
                    <button
                      className="btn sm"
                      onClick={() => setAddingContactTo(c.id)}>
                      + Add contact
                    </button>
                  </div>
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

      {editingClient && (
        <EditClientModal
          client={editingClient}
          onSaved={updated => {
            setClients(prev => prev.map(c => c.id === updated.id ? { ...updated, contacts: c.contacts } : c))
            setEditingClient(null)
          }}
          onClose={() => setEditingClient(null)}
        />
      )}

      {editingContact && (
        <EditContactModal
          clientId={editingContact.clientId}
          contact={editingContact.contact}
          onSaved={updated => {
            setClients(prev => prev.map(c =>
              c.id === editingContact.clientId
                ? { ...c, contacts: c.contacts.map(x => x.id === updated.id ? updated : x) }
                : c
            ))
            setEditingContact(null)
          }}
          onClose={() => setEditingContact(null)}
        />
      )}

      {addingContactTo && (
        <AddContactModal
          clientId={addingContactTo}
          onAdded={contact => {
            setClients(prev => prev.map(c =>
              c.id === addingContactTo ? { ...c, contacts: [...c.contacts, contact] } : c
            ))
            setAddingContactTo(null)
          }}
          onClose={() => setAddingContactTo(null)}
        />
      )}
    </div>
  )
}
