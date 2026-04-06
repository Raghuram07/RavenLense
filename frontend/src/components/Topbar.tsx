import type { Mode, Role, ROLE_META } from '../App'

type RoleMeta = typeof ROLE_META[Role]

interface Props {
  dark: boolean
  onToggleDark: () => void
  role: Role
  onRoleChange: (r: Role) => void
  mode: Mode
  onModeChange: (m: Mode) => void
  roleMeta: RoleMeta
}

const MODES: { id: Mode; label: string; icon: JSX.Element }[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor">
        <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5"/>
        <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.5"/>
        <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5"/>
        <rect x="9" y="9" width="5.5" height="5.5" rx="1.5"/>
      </svg>
    ),
  },
  {
    id: 'chat',
    label: 'Chat',
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor">
        <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H9.5l-3 2.5V11H3a1 1 0 01-1-1V3z"/>
      </svg>
    ),
  },
  {
    id: 'knowledge',
    label: 'Knowledge',
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor">
        <path d="M4 2h5.5l3.5 3.5V14H4V2z"/>
        <path d="M9 2v4h4" fill="none" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    ),
  },
  {
    id: 'performance',
    label: 'Performance',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="2,12 5.5,7.5 8.5,10 11,6 14,8"/>
      </svg>
    ),
  },
  {
    id: 'employees',
    label: 'Employees',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <circle cx="5.5" cy="5" r="2.5"/>
        <path d="M1 13c0-2.5 2-4.5 4.5-4.5S10 10.5 10 13"/>
        <circle cx="12" cy="8" r="2"/>
      </svg>
    ),
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 3a1 1 0 011-1h4l2 2h6a1 1 0 011 1v8a1 1 0 01-1 1H2a1 1 0 01-1-1V3z"/>
      </svg>
    ),
  },
]

export default function Topbar({ dark, onToggleDark, role, onRoleChange, mode, onModeChange, roleMeta }: Props) {
  const visibleModes = MODES.filter(m => roleMeta.showModes.includes(m.id))

  return (
    <div className="topbar">
      {/* Logo */}
      <div className="logo">
        <div className="logo-mark">
          <svg viewBox="0 0 15 15" fill="none">
            <circle cx="7.5" cy="5" r="2.8" fill="white"/>
            <path d="M2 13.5C2 10.46 4.46 8 7.5 8C10.54 8 13 10.46 13 13.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
          </svg>
        </div>
        RavenLens
      </div>

      {/* Mode switcher */}
      <div className="topbar-center">
        <div className="modeswitcher">
          {visibleModes.map(m => (
            <button
              key={m.id}
              className={`mode-btn${mode === m.id ? ' active' : ''}`}
              onClick={() => onModeChange(m.id)}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Right side */}
      <div className="topbar-right">
        <div className="role-switcher">
          <span>Preview as:</span>
          <select
            className="role-select"
            value={role}
            onChange={e => onRoleChange(e.target.value as Role)}
          >
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="employee">Employee</option>
          </select>
        </div>

        {/* Dark mode toggle */}
        <div className={`tog${dark ? ' on' : ''}`} onClick={onToggleDark}>
          <div className="tog-track">
            <div className="tog-thumb">{dark ? '☾' : '☀'}</div>
          </div>
        </div>

        {/* User chip */}
        <div className="user-chip">
          <div className="chip-av">{roleMeta.initials}</div>
          <span className="chip-name">{roleMeta.name}</span>
          <span className={`role-badge-chip ${roleMeta.badgeClass}`}>{roleMeta.roleLabel}</span>
        </div>
      </div>
    </div>
  )
}
