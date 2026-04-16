import { NavLink } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'

interface Props {
  role: 'facilitator' | 'team'
}

const facilitatorLinks = [
  { to: '/facilitator', label: 'Dashboard', end: true },
  { to: '/facilitator/setup', label: 'New Game' },
  { to: '/facilitator/quarter', label: 'Quarter Control' },
  { to: '/facilitator/sector', label: 'Sector Update' },
]

const teamLinks = [
  { to: '/team', label: 'Dashboard', end: true },
  { to: '/team/decisions', label: 'Submit Decisions' },
  { to: '/team/reports', label: 'My Reports' },
]

export default function Sidebar({ role }: Props) {
  const { currentGame, myTeamNo } = useGameStore()
  const links = role === 'facilitator' ? facilitatorLinks : teamLinks

  return (
    <aside className="sidebar">
      <div className="brand">⚡ CHANAKYA</div>
      <nav className="flex-grow-1 py-2">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className="nav-link">
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        {currentGame ? (
          <>
            <div className="text-white-50 small text-uppercase">Current Game</div>
            <div className="text-white">{currentGame.gameId}</div>
            <div className="small">Q{currentGame.currentQuarter} · {currentGame.status}</div>
          </>
        ) : (
          <div className="small">No game loaded</div>
        )}
        {role === 'team' && myTeamNo !== null && (
          <div className="small mt-2">Team #{myTeamNo}</div>
        )}
      </div>
    </aside>
  )
}
