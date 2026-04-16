import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'

import LoginPage from '@/pages/LoginPage'
import FacilitatorDashboard from '@/pages/facilitator/FacilitatorDashboard'
import GameSetupPage from '@/pages/facilitator/GameSetupPage'
import QuarterControlPage from '@/pages/facilitator/QuarterControlPage'
import SectorUpdatePage from '@/pages/facilitator/SectorUpdatePage'
import TeamDashboard from '@/pages/team/TeamDashboard'
import DecisionEntryPage from '@/pages/team/DecisionEntryPage'
import MyReportsPage from '@/pages/team/MyReportsPage'
import AppShell from '@/components/layout/AppShell'

export default function App() {
  const { myRole } = useGameStore()

  useEffect(() => {
    const savedRole = localStorage.getItem('chanakya_role')
    const savedGameId = localStorage.getItem('chanakya_gameId')
    const savedTeamNo = localStorage.getItem('chanakya_teamNo')
    if (savedRole === 'facilitator') {
      useGameStore.getState().setIdentity('facilitator')
    } else if (savedRole === 'team' && savedGameId) {
      useGameStore.getState().setIdentity(
        'team',
        savedTeamNo ? parseInt(savedTeamNo, 10) : undefined,
        savedGameId
      )
    }
  }, [])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Facilitator routes */}
      <Route path="/facilitator" element={<AppShell role="facilitator" />}>
        <Route index element={<FacilitatorDashboard />} />
        <Route path="setup" element={<GameSetupPage />} />
        <Route path="game/:gameId" element={<QuarterControlPage />} />
        <Route path="game/:gameId/sector/:quarterNo" element={<SectorUpdatePage />} />
      </Route>

      {/* Team routes */}
      <Route path="/team" element={<AppShell role="team" />}>
        <Route index element={<TeamDashboard />} />
        <Route path="game/:gameId/decisions" element={<DecisionEntryPage />} />
        <Route path="game/:gameId/reports" element={<MyReportsPage />} />
      </Route>

      {/* Root redirect */}
      <Route
        path="/"
        element={
          myRole === 'facilitator' ? (
            <Navigate to="/facilitator" replace />
          ) : myRole === 'team' ? (
            <Navigate to="/team" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  )
}
