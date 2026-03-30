import { useState } from 'react'
import type { Project } from '../types'
import CreateProjectModal from './CreateProjectModal'

interface Props {
  projects: Project[]
  selectedId: string | null
  onSelect: (p: Project) => void
  onDelete: (id: string) => void
  onCreated: (p: Project) => void
}

export default function Sidebar({ projects, selectedId, onSelect, onDelete, onCreated }: Props) {
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">RavenLens <span>AI MOM</span></div>
        <button className="btn btn-primary btn-full" onClick={() => setShowCreate(true)}>
          + New Project
        </button>
      </div>

      <div className="sidebar-projects">
        {projects.length === 0 ? (
          <div className="sidebar-empty">No projects yet.<br />Create one to get started.</div>
        ) : (
          projects.map(p => (
            <div
              key={p.id}
              className={`project-item ${p.id === selectedId ? 'active' : ''}`}
              onClick={() => onSelect(p)}
            >
              <div>
                <div className="project-name">{p.name}</div>
                <div className="project-meta">
                  {p.client ? `${p.client} · ` : ''}{p.meeting_count} meeting{p.meeting_count !== 1 ? 's' : ''}
                </div>
              </div>
              <button
                className="project-delete"
                title="Delete project"
                onClick={e => { e.stopPropagation(); onDelete(p.id) }}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      {showCreate && (
        <CreateProjectModal
          onCreated={p => { onCreated(p); setShowCreate(false) }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}
