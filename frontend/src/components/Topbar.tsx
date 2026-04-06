import type { ReactNode } from 'react'
import type { Role, ROLE_META } from '../App'

type RoleMeta = typeof ROLE_META[Role]

interface Props {
  dark: boolean
  onToggleDark: () => void
  role: Role
  onRoleChange: (r: Role) => void
  roleMeta: RoleMeta
  centerSlot?: ReactNode
}

export default function Topbar({ dark, onToggleDark, role, onRoleChange, roleMeta, centerSlot }: Props) {
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

      {/* Center slot (e.g. project tabs) */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        {centerSlot}
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
