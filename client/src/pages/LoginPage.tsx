import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Form, Button, Alert } from 'react-bootstrap'
import { useGameStore } from '@/store/gameStore'
import { authApi, setAuthToken } from '@/services/api'
import NotificationToast from '@/components/common/NotificationToast'

type Role = 'team' | 'admin'
type Mode = 'login' | 'register'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setIdentity, setAuthUser } = useGameStore()

  const [activeRole, setActiveRole] = useState<Role>('team')

  // Admin (facilitator) — sign-in only
  const [facEmail, setFacEmail] = useState('')
  const [facPassword, setFacPassword] = useState('')
  const [facError, setFacError] = useState<string | null>(null)
  const [facSubmitting, setFacSubmitting] = useState(false)

  // Team form — email + password only
  const [teamMode, setTeamMode] = useState<Mode>('login')
  const [teamUserName, setTeamUserName] = useState('')
  const [teamEmail, setTeamEmail] = useState('')
  const [teamPassword, setTeamPassword] = useState('')
  const [teamError, setTeamError] = useState<string | null>(null)
  const [teamSubmitting, setTeamSubmitting] = useState(false)

  const submitFacilitator = async (e: React.FormEvent) => {
    e.preventDefault()
    setFacError(null)
    const email = facEmail.trim().toLowerCase()
    if (!email || !facPassword) {
      setFacError('Email and password are required')
      return
    }
    setFacSubmitting(true)
    try {
      const res = await authApi.login({ email, password: facPassword })
      const { user, token } = res.data.data
      if (user.role !== 'facilitator') {
        setFacError('This account is not an admin account')
        setFacSubmitting(false)
        return
      }
      setAuthToken(token)
      setAuthUser(user)
      localStorage.setItem('chanakya_role', 'facilitator')
      localStorage.removeItem('chanakya_gameId')
      localStorage.removeItem('chanakya_teamNo')
      setIdentity('facilitator')
      navigate('/facilitator')
    } catch (err) {
      setFacError(err instanceof Error ? err.message : 'Sign-in failed')
    } finally {
      setFacSubmitting(false)
    }
  }

  const submitTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    setTeamError(null)

    const email = teamEmail.trim().toLowerCase()
    if (!email || !teamPassword) {
      setTeamError('Email and password are required')
      return
    }
    if (teamMode === 'register' && !teamUserName.trim()) {
      setTeamError('Your name is required')
      return
    }

    setTeamSubmitting(true)
    try {
      const authRes =
        teamMode === 'login'
          ? await authApi.login({ email, password: teamPassword })
          : await authApi.register({
              email,
              password: teamPassword,
              name: teamUserName.trim(),
              role: 'team',
            })

      const { user, token } = authRes.data.data
      if (user.role !== 'team') {
        setTeamError('This account is registered as an admin, not a team user')
        setTeamSubmitting(false)
        return
      }
      setAuthToken(token)
      setAuthUser(user)

      localStorage.setItem('chanakya_role', 'team')
      localStorage.removeItem('chanakya_gameId')
      localStorage.removeItem('chanakya_teamNo')
      localStorage.removeItem('chanakya_teamName')
      setIdentity('team')
      navigate('/team')
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : 'Sign-in failed')
    } finally {
      setTeamSubmitting(false)
    }
  }

  return (
    <div className="login-wrapper">
      <div className="text-center">
        <div className="login-brand"> PARASMANI</div>
        <div className="login-tagline">Business Simulation Platform</div>
      </div>

      <Container style={{ maxWidth: 520 }}>
        {/* Role toggle */}
        <div
          className="d-flex p-1 mb-3 mx-auto"
          style={{
            background: '#e9ecef',
            borderRadius: 999,
            maxWidth: 280,
          }}
        >
          <button
            type="button"
            onClick={() => setActiveRole('team')}
            className="flex-grow-1 border-0"
            style={{
              padding: '8px 16px',
              borderRadius: 999,
              fontWeight: 600,
              background: activeRole === 'team' ? 'var(--chanakya-secondary)' : 'transparent',
              color: activeRole === 'team' ? '#0d1b2a' : '#495057',
              transition: 'all 0.2s ease',
            }}
          >
            Team
          </button>
          <button
            type="button"
            onClick={() => setActiveRole('admin')}
            className="flex-grow-1 border-0"
            style={{
              padding: '8px 16px',
              borderRadius: 999,
              fontWeight: 600,
              background: activeRole === 'admin' ? 'var(--chanakya-primary)' : 'transparent',
              color: activeRole === 'admin' ? '#fff' : '#495057',
              transition: 'all 0.2s ease',
            }}
          >
            Admin
          </button>
        </div>

        {activeRole === 'team' ? (
          <Form onSubmit={submitTeam} className="role-card">
            <h4 className="mb-1">I'm a Team</h4>
            <p className="text-muted small mb-3">Play the simulation</p>

            <div className="d-flex gap-2 mb-3">
              <Button
                size="sm"
                variant={teamMode === 'login' ? 'warning' : 'outline-warning'}
                onClick={() => setTeamMode('login')}
                type="button"
              >
                Sign in
              </Button>
              <Button
                size="sm"
                variant={teamMode === 'register' ? 'warning' : 'outline-warning'}
                onClick={() => setTeamMode('register')}
                type="button"
              >
                Create account
              </Button>
            </div>

            {teamError && (
              <Alert variant="danger" className="py-2 small">
                {teamError}
              </Alert>
            )}

            {teamMode === 'register' && (
              <Form.Group className="mb-3">
                <Form.Label>Your name</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Your name"
                  value={teamUserName}
                  onChange={(e) => setTeamUserName(e.target.value)}
                  required
                />
              </Form.Group>
            )}

            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                placeholder="u1@u.com"
                value={teamEmail}
                onChange={(e) => setTeamEmail(e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="••••••••"
                value={teamPassword}
                onChange={(e) => setTeamPassword(e.target.value)}
                required
                minLength={6}
              />
            </Form.Group>

            <Button
              type="submit"
              variant="warning"
              className="w-100"
              disabled={teamSubmitting}
              style={{ background: 'var(--chanakya-secondary)', border: 'none', color: '#0d1b2a' }}
            >
              {teamSubmitting
                ? 'Please wait…'
                : teamMode === 'login'
                ? 'Sign in'
                : 'Create Account'}
            </Button>
          </Form>
        ) : (
          <Form onSubmit={submitFacilitator} className="role-card">
            <h4 className="mb-1">I'm an Admin</h4>
            <p className="text-muted small mb-3">Run the simulation</p>

            {facError && (
              <Alert variant="danger" className="py-2 small">
                {facError}
              </Alert>
            )}

            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                placeholder="admin1@admin.com"
                value={facEmail}
                onChange={(e) => setFacEmail(e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="••••••••"
                value={facPassword}
                onChange={(e) => setFacPassword(e.target.value)}
                required
              />
            </Form.Group>

            <Button
              type="submit"
              variant="primary"
              className="w-100"
              disabled={facSubmitting}
              style={{ background: 'var(--chanakya-primary)', border: 'none' }}
            >
              {facSubmitting ? 'Please wait…' : 'Sign in as Admin'}
            </Button>
          </Form>
        )}
      </Container>
      <NotificationToast />
    </div>
  )
}
