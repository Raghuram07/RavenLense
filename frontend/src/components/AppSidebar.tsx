import type { Mode, Role, ROLE_META } from '../App'

type RoleMeta = typeof ROLE_META[Role]

interface Props {
  role: Role
  mode: Mode
  onModeChange: (m: Mode) => void
  roleMeta: RoleMeta
}

export default function AppSidebar({ mode, onModeChange, roleMeta }: Props) {
  return (
    <div className="app-sidebar">

      {/* Overview */}
      <div className="sb-sec">
        <span className="sb-lbl">Overview</span>
        <div
          className={`nav-item${mode === 'dashboard' ? ' active' : ''}`}
          onClick={() => onModeChange('dashboard')}
        >
          <svg viewBox="0 0 16 16" fill="currentColor">
            <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5"/>
            <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.5"/>
            <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5"/>
            <rect x="9" y="9" width="5.5" height="5.5" rx="1.5"/>
          </svg>
          Home
        </div>
        <div className="nav-item">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="8" cy="8" r="5.5"/>
            <polyline points="8,5 8,8 10,10"/>
          </svg>
          Recent meetings
          <span className="nav-badge">12</span>
        </div>
        <div className="nav-item">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <line x1="3" y1="4" x2="13" y2="4"/>
            <line x1="3" y1="8" x2="13" y2="8"/>
            <line x1="3" y1="12" x2="9" y2="12"/>
          </svg>
          Action items
          <span className="nav-badge">5</span>
        </div>
        <div className="nav-item">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 1L1.5 4.5V9C1.5 12.5 4.5 14.8 8 15.5C11.5 14.8 14.5 12.5 14.5 9V4.5Z"/>
          </svg>
          Decisions log
        </div>
      </div>

      <div className="sb-sep" />

      {/* Sources */}
      <div className="sb-sec">
        <span className="sb-lbl">Sources</span>
        <div className="nav-item">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x="2" y="3" width="12" height="9" rx="2"/>
            <path d="M5 3V2h6v1"/>
          </svg>
          Teams meetings
        </div>
        <div className="nav-item">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <circle cx="8" cy="8" r="5.5"/>
            <circle cx="8" cy="8" r="2"/>
            <line x1="10" y1="6" x2="13" y2="3"/>
          </svg>
          Recall.ai bots
        </div>
        <div className="nav-item">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M4 1.5h5.5L13 5v9.5H4V1.5Z" strokeLinejoin="round"/>
          </svg>
          Uploads
        </div>
      </div>

      {/* Admin section — only for admin */}
      {roleMeta.showAdminSection && (
        <>
          <div className="sb-sep" />
          <div className="sb-sec">
            <span className="sb-lbl">Admin</span>
            <div
              className={`nav-item${mode === 'employees' ? ' active' : ''}`}
              onClick={() => onModeChange('employees')}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <circle cx="5.5" cy="5" r="2.5"/>
                <path d="M1 13c0-2.5 2-4.5 4.5-4.5S10 10.5 10 13"/>
                <circle cx="12" cy="8" r="2"/>
              </svg>
              Employees
            </div>
            <div
              className={`nav-item${mode === 'projects' ? ' active' : ''}`}
              onClick={() => onModeChange('projects')}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 3a1 1 0 011-1h4l2 2h6a1 1 0 011 1v8a1 1 0 01-1 1H2a1 1 0 01-1-1V3z"/>
              </svg>
              Projects
            </div>
            <div className="nav-item">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <rect x="1.5" y="6" width="4" height="4" rx="1"/>
                <rect x="10.5" y="1.5" width="4" height="4" rx="1"/>
                <rect x="10.5" y="10.5" width="4" height="4" rx="1"/>
                <line x1="5.5" y1="8" x2="10.5" y2="3.5"/>
                <line x1="5.5" y1="8" x2="10.5" y2="12.5"/>
              </svg>
              Integrations
            </div>
            <div className="nav-item">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <circle cx="8" cy="8" r="2"/>
                <path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.5 3.5l1 1M11.5 11.5l1 1M12.5 3.5l-1 1M4.5 11.5l-1 1"/>
              </svg>
              Settings
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      <div className="sb-footer">
        <div className="user-row">
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
