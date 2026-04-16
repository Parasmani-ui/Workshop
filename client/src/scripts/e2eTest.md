# Chanakya BizSimulation — E2E Test Checklist

## Setup
- [ ] Server running: `npm run dev` (port 5000)
- [ ] Client running: `npm run dev` (port 5173)
- [ ] DB seeded: `npm run seed`
- [ ] Q1 stale data cleared: `npx ts-node src/scripts/clearQ1.ts`

## Facilitator Flow
- [ ] Open http://localhost:5173
- [ ] Login page renders with two role cards
- [ ] Click "Enter as Facilitator" → navigates to /facilitator
- [ ] Dashboard shows MPX-DEMO game card
- [ ] Game shows status: Active, Q0/Q5
- [ ] Click "Open" → QuarterControlPage loads
- [ ] TeamStatusGrid shows 4 teams, all "Submitted" (seeded Q1 decisions)
- [ ] Leaderboard shows "No results yet"
- [ ] Click "Lock Quarter" → confirm dialog → status changes to Processing
- [ ] TeamStatusGrid shows all teams as "Locked"
- [ ] Process button becomes active (4/4 submitted)
- [ ] Click "Process Quarter" → confirm dialog → spinner appears
- [ ] Wait 3–5 seconds → "Quarter 1 processed!" notification
- [ ] Publish button becomes active
- [ ] Click "Publish Results" → Q increments to Q2
- [ ] Navigate to /facilitator/game/MPX-DEMO/sector/1
- [ ] Sector Update shows comparative table with 4 teams
- [ ] Leaderboard shows 4 ranked teams with share prices

## Team Flow
- [ ] Open new browser tab → http://localhost:5173
- [ ] Click "Enter as Team"
- [ ] Enter gameId: MPX-DEMO, teamNo: 0
- [ ] Team Dashboard shows "Q1 Decisions submitted" (from seed)
- [ ] Click "View Full Report" → MyReportsPage
- [ ] Q1 tab shows P&L with revenue ~688K (from engine run)
- [ ] Share price shown in Key Metrics
- [ ] Click "Submit Decisions" → DecisionEntryPage
- [ ] Tab 1: fill in production/prices
- [ ] Tab 2: fill in marketing
- [ ] Submit → success notification

## Real-Time Test (both tabs open)
- [ ] Facilitator locks Q2 → team sees "Quarter locked" notification
- [ ] Team submits Q2 decision → facilitator sees "Team 0 submitted"
- [ ] Facilitator processes Q2 → both see processing notification
- [ ] Facilitator publishes → both see "Results published, Q3 starting"
