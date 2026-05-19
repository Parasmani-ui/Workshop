import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Badge, Button, Modal, Form, Alert } from 'react-bootstrap'
import { useGameStore } from '@/store/gameStore'
import { authApi, setAuthToken } from '@/services/api'
import QuarterBadge from '@/components/common/QuarterBadge'
import { GAME_STATUS_LABELS, GAME_STATUS_VARIANTS } from '@/utils/constants'

const PAGE_TITLES: Record<string, string> = {
  '/facilitator': 'Dashboard',
  '/facilitator/setup': 'New Game',
  '/facilitator/quarter': 'Quarter Control',
  '/facilitator/sector': 'Sector Update',
  '/team': 'My Games',
  '/team/game': 'Game',
  '/team/decisions': 'Submit Decisions',
  '/team/reports': 'My Reports',
}

export default function TopBar() {
  const { currentGame, authUser, myRole, setIdentity, reset } = useGameStore()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const [showJoinModal, setShowJoinModal] = useState(false)
  const [joinGameId, setJoinGameId] = useState('')
  const [joinTeamNo, setJoinTeamNo] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joinSubmitting, setJoinSubmitting] = useState(false)

  const title =
    PAGE_TITLES[pathname] ??
    Object.entries(PAGE_TITLES).find(([k]) => pathname.startsWith(k))?.[1] ??
    'Chanakya'

  const handleLogout = () => {
    setAuthToken(null)
    localStorage.removeItem('chanakya_role')
    localStorage.removeItem('chanakya_gameId')
    localStorage.removeItem('chanakya_teamNo')
    localStorage.removeItem('chanakya_teamName')
    reset()
    setIdentity(null)
    navigate('/login', { replace: true })
  }

  const openJoinModal = () => {
    setJoinGameId('')
    setJoinTeamNo('')
    setJoinError(null)
    setShowJoinModal(true)
  }

  const closeJoinModal = () => {
    if (joinSubmitting) return
    setShowJoinModal(false)
  }

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setJoinError(null)
    const trimmedGameId = joinGameId.trim()
    const displayedTeamNo = parseInt(joinTeamNo, 10)
    if (!trimmedGameId) {
      setJoinError('Game ID is required')
      return
    }
    if (isNaN(displayedTeamNo) || displayedTeamNo < 1 || displayedTeamNo > 20) {
      setJoinError('Team number must be between 1 and 20')
      return
    }
    const parsedTeamNo = displayedTeamNo - 1
    setJoinSubmitting(true)
    try {
      await authApi.joinGame({
        gameId: trimmedGameId,
        teamNo: parsedTeamNo,
      })
      setIdentity('team', parsedTeamNo, trimmedGameId)
      localStorage.setItem('chanakya_gameId', trimmedGameId)
      localStorage.setItem('chanakya_teamNo', String(parsedTeamNo))
      setShowJoinModal(false)
      navigate(`/team/game/${trimmedGameId}`)
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Could not join game')
    } finally {
      setJoinSubmitting(false)
    }
  }

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
      {authUser && (
        <span className="text-muted small ms-2">{authUser.name}</span>
      )}
      {myRole === 'team' && (
        <Button
          variant="warning"
          size="sm"
          onClick={openJoinModal}
          className="ms-2"
          style={{
            background: 'var(--chanakya-secondary)',
            border: 'none',
            color: '#0d1b2a',
            fontWeight: 600,
          }}
        >
          + Join Game
        </Button>
      )}
      <Button
        variant="outline-secondary"
        size="sm"
        onClick={handleLogout}
        className="ms-2"
      >
        Log out
      </Button>

      <Modal show={showJoinModal} onHide={closeJoinModal} centered>
        <Form onSubmit={handleJoinSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>Join a Game</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {joinError && (
              <Alert variant="danger" className="py-2 small">
                {joinError}
              </Alert>
            )}
            <Form.Group className="mb-3">
              <Form.Label>Game ID</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g. MPX-DEMO"
                value={joinGameId}
                onChange={(e) => setJoinGameId(e.target.value)}
                required
                autoFocus
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Team Number (1–20)</Form.Label>
              <Form.Control
                type="number"
                min={1}
                max={20}
                placeholder="1"
                value={joinTeamNo}
                onChange={(e) => setJoinTeamNo(e.target.value)}
                required
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={closeJoinModal}
              disabled={joinSubmitting}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={joinSubmitting}>
              {joinSubmitting ? 'Joining…' : 'Join Game'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  )
}
