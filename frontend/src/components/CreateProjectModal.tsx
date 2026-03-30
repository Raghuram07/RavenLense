import { useState } from 'react'
import type { Project } from '../types'
import * as api from '../api'

interface Props {
  onCreated: (p: Project) => void
  onClose: () => void
}

export default function CreateProjectModal({ onCreated, onClose }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [client, setClient] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      const p = await api.createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        client: client.trim() || undefined,
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
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">New Project</div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Project name *</label>
            <input
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Sprint 14"
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Client (optional)</label>
            <input
              className="form-input"
              value={client}
              onChange={e => setClient(e.target.value)}
              placeholder="e.g. Acme Corp"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description (optional)</label>
            <input
              className="form-input"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Short description"
            />
          </div>

          {error && <div className="error-msg">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !name.trim()}>
              {loading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
