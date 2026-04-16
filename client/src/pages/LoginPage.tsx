import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Row, Col, Form, Button, Alert } from 'react-bootstrap'
import { useGameStore } from '@/store/gameStore'
import { gameApi, teamApi } from '@/services/api'
import NotificationToast from '@/components/common/NotificationToast'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setIdentity } = useGameStore()

  const [facilitatorName, setFacilitatorName] = useState('')
  const [gameId, setGameId] = useState('')
  const [teamNo, setTeamNo] = useState('')
  const [teamName, setTeamName] = useState('')
  const [teamError, setTeamError] = useState<string | null>(null)
  const [teamSubmitting, setTeamSubmitting] = useState(false)

  const enterAsFacilitator = (e: React.FormEvent) => {
    e.preventDefault()
    if (!facilitatorName.trim()) return
    localStorage.setItem('chanakya_role', 'facilitator')
    localStorage.removeItem('chanakya_gameId')
    localStorage.removeItem('chanakya_teamNo')
    setIdentity('facilitator')
    navigate('/facilitator')
  }

  const enterAsTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    setTeamError(null)
    const trimmedGameId = gameId.trim()
    const trimmedName = teamName.trim()
    const displayedTeamNo = parseInt(teamNo, 10)
    if (!trimmedGameId || isNaN(displayedTeamNo) || displayedTeamNo < 1 || displayedTeamNo > 20) {
      setTeamError('Enter a valid Game ID and team number (1-20)')
      return
    }
    const parsedTeamNo = displayedTeamNo - 1
    if (!trimmedName) {
      setTeamError('Please enter your team name')
      return
    }
    setTeamSubmitting(true)
    try {
      await gameApi.getStatus(trimmedGameId)

      // Register team (ignore 409 — team already exists is fine)
      try {
        await teamApi.create(trimmedGameId, {
          teamNo: parsedTeamNo,
          teamName: trimmedName,
          ceo: trimmedName,
        })
      } catch {
        // 409 = team already exists — that's OK, continue
      }

      localStorage.setItem('chanakya_role', 'team')
      localStorage.setItem('chanakya_gameId', trimmedGameId)
      localStorage.setItem('chanakya_teamNo', parsedTeamNo.toString())
      localStorage.setItem('chanakya_teamName', trimmedName)
      setIdentity('team', parsedTeamNo, trimmedGameId)
      navigate('/team')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Game not found'
      setTeamError(msg === 'Request failed with status code 404' ? 'Game not found' : msg)
    } finally {
      setTeamSubmitting(false)
    }
  }

  return (
    <div className="login-wrapper">
      <div className="text-center">
        <div className="login-brand">⚡ CHANAKYA</div>
        <div className="login-tagline">Business Simulation Platform</div>
      </div>

      <Container style={{ maxWidth: 900 }}>
        <Row className="g-4">
          <Col md={6}>
            <Form onSubmit={enterAsFacilitator} className="role-card">
              <div className="role-icon facilitator">⚙</div>
              <h4 className="mb-1">I'm a Facilitator</h4>
              <p className="text-muted small">Run the simulation</p>
              <Form.Group className="mb-3">
                <Form.Label>Facilitator name</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Your name"
                  value={facilitatorName}
                  onChange={(e) => setFacilitatorName(e.target.value)}
                  required
                />
              </Form.Group>
              <Button
                type="submit"
                variant="primary"
                className="w-100"
                style={{ background: 'var(--chanakya-primary)', border: 'none' }}
              >
                Enter as Facilitator
              </Button>
            </Form>
          </Col>

          <Col md={6}>
            <Form onSubmit={enterAsTeam} className="role-card">
              <div className="role-icon team">★</div>
              <h4 className="mb-1">I'm a Team</h4>
              <p className="text-muted small">Play the simulation</p>
              {teamError && (
                <Alert variant="danger" className="py-2 small">
                  {teamError}
                </Alert>
              )}
              <Form.Group className="mb-3">
                <Form.Label>Game ID</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="e.g. MPX-DEMO"
                  value={gameId}
                  onChange={(e) => setGameId(e.target.value)}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Team Number (1–20)</Form.Label>
                <Form.Control
                  type="number"
                  min={1}
                  max={20}
                  placeholder="1"
                  value={teamNo}
                  onChange={(e) => setTeamNo(e.target.value)}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Team Name</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="e.g. Alpha Corp"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  required
                />
              </Form.Group>
              <Button
                type="submit"
                variant="warning"
                className="w-100"
                disabled={teamSubmitting}
                style={{ background: 'var(--chanakya-secondary)', border: 'none', color: '#0d1b2a' }}
              >
                {teamSubmitting ? 'Validating...' : 'Enter as Team'}
              </Button>
            </Form>
          </Col>
        </Row>
      </Container>
      <NotificationToast />
    </div>
  )
}
