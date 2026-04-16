import { useLocation } from 'react-router-dom'
import { Badge } from 'react-bootstrap'
import { useGameStore } from '@/store/gameStore'
import QuarterBadge from '@/components/common/QuarterBadge'
import { GAME_STATUS_LABELS, GAME_STATUS_VARIANTS } from '@/utils/constants'

const PAGE_TITLES: Record<string, string> = {
  '/facilitator': 'Dashboard',
  '/facilitator/setup': 'New Game',
  '/facilitator/quarter': 'Quarter Control',
  '/facilitator/sector': 'Sector Update',
  '/team': 'Dashboard',
  '/team/decisions': 'Submit Decisions',
  '/team/reports': 'My Reports',
}

export default function TopBar() {
  const { currentGame } = useGameStore()
  const { pathname } = useLocation()

  const title =
    PAGE_TITLES[pathname] ??
    Object.entries(PAGE_TITLES).find(([k]) => pathname.startsWith(k))?.[1] ??
    'Chanakya'

  return (
    <div className="topbar">
      <h5 className="mb-0 flex-grow-1">{title}</h5>
      {currentGame && (
        <>
          <QuarterBadge quarterNo={currentGame.currentQuarter} />
          <Badge bg={GAME_STATUS_VARIANTS[currentGame.status] ?? 'secondary'}>
            {GAME_STATUS_LABELS[currentGame.status] ?? currentGame.status}
          </Badge>
          <span className="text-muted small">{currentGame.gameId}</span>
        </>
      )}
    </div>
  )
}
