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

export default function Sidebar({ role }: Props) {
  const { currentGame, myGameId, myTeamNo } = useGameStore()

  const teamLinks = (() => {
    const activeGameId = myGameId
    const base = [{ to: '/team', label: 'My Games', end: true as const }]
    if (activeGameId) {
      base.push(
        { to: `/team/game/${activeGameId}`, label: 'Game Dashboard', end: true as const },
        { to: `/team/game/${activeGameId}/decisions`, label: 'Submit Decisions', end: true as const },
        { to: `/team/game/${activeGameId}/reports`, label: 'My Reports', end: true as const }
      )
    }
    return base
  })()

  const links = role === 'facilitator' ? facilitatorLinks : teamLinks

  return (
    <aside className="sidebar">
      <div className="brand"> LEADERLY </div>
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
          <div className="small mt-2">Team #{myTeamNo + 1}</div>
        )}
      </div>
    </aside>
  )
}
