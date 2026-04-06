import { useState } from 'react'
import type { Mode, Role, ROLE_META } from '../App'

type RoleMeta = typeof ROLE_META[Role]

interface Props {
  role: Role
  mode: Mode
  onModeChange: (m: Mode) => void
  roleMeta: RoleMeta
}

export default function AppSidebar({ mode, onModeChange, roleMeta }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={`app-sidebar${collapsed ? ' collapsed' : ''}`}>

      {/* Collapse toggle */}
      <div className="sb-toggle">
        <button
          className="sb-toggle-btn"
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            {collapsed
              ? <path d="M6 3l5 5-5 5"/>
              : <path d="M10 3L5 8l5 5"/>
            }
          </svg>
        </button>
      </div>

      {/* Overview */}
      <div className="sb-sec">
        <span className="sb-lbl">Overview</span>

        <div
          className={`nav-item${mode === 'dashboard' ? ' active' : ''}`}
          onClick={() => onModeChange('dashboard')}
          title={collapsed ? 'Dashboard' : undefined}
        >
          <svg viewBox="0 0 16 16" fill="currentColor">
            <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5"/>
            <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.5"/>
            <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5"/>
            <rect x="9" y="9" width="5.5" height="5.5" rx="1.5"/>
          </svg>
          <span className="nav-label">Dashboard</span>
        </div>

        {roleMeta.showModes.includes('projects') && (
          <div
            className={`nav-item${mode === 'projects' ? ' active' : ''}`}
            onClick={() => onModeChange('projects')}
            title={collapsed ? 'Projects' : undefined}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 3a1 1 0 011-1h4l2 2h6a1 1 0 011 1v8a1 1 0 01-1 1H2a1 1 0 01-1-1V3z"/>
            </svg>
            <span className="nav-label">Projects</span>
          </div>
        )}

        {roleMeta.showModes.includes('performance') && (
          <div
            className={`nav-item${mode === 'performance' ? ' active' : ''}`}
            onClick={() => onModeChange('performance')}
            title={collapsed ? 'Performance' : undefined}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="2,12 5.5,7.5 8.5,10 11,6 14,8"/>
            </svg>
            <span className="nav-label">Performance</span>
          </div>
        )}
      </div>

      {/* Admin section */}
      {roleMeta.showAdminSection && (
        <>
          <div className="sb-sep" />
          <div className="sb-sec">
            <span className="sb-lbl">Admin</span>

            <div
              className={`nav-item${mode === 'employees' ? ' active' : ''}`}
              onClick={() => onModeChange('employees')}
              title={collapsed ? 'Employees' : undefined}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <circle cx="5.5" cy="5" r="2.5"/>
                <path d="M1 13c0-2.5 2-4.5 4.5-4.5S10 10.5 10 13"/>
                <circle cx="12" cy="8" r="2"/>
              </svg>
              <span className="nav-label">Employees</span>
            </div>

            <div
              className={`nav-item${mode === 'clients' ? ' active' : ''}`}
              onClick={() => onModeChange('clients')}
              title={collapsed ? 'Clients' : undefined}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1.5" y="4" width="13" height="9" rx="1.5"/>
                <path d="M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1"/>
              </svg>
              <span className="nav-label">Clients</span>
            </div>

            <div
              className="nav-item"
              title={collapsed ? 'Settings' : undefined}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <circle cx="8" cy="8" r="2"/>
                <path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.5 3.5l1 1M11.5 11.5l1 1M12.5 3.5l-1 1M4.5 11.5l-1 1"/>
              </svg>
              <span className="nav-label">Settings</span>
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      <div className="sb-footer">
        <div className="user-row" title={collapsed ? `${roleMeta.name} · ${roleMeta.roleLabel}` : undefined}>
          <div className="uav">{roleMeta.initials}</div>
          <div className="uinfo">
            <div className="uname">{roleMeta.name}</div>
            <div className="urole">{roleMeta.sbRoleLabel}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
