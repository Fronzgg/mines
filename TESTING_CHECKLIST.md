# Testing Checklist for FRNMINES v3.0

## Backend Tests

### Database & WebSocket
- [ ] Server starts without errors
- [ ] Database tables created successfully
- [ ] WebSocket connections established
- [ ] Founder account (@Fronz, ID: 1908053913) exists in database

### Online Rocket Game
- [ ] New round starts automatically every 30 seconds
- [ ] 10 seconds betting phase
- [ ] Rocket flies with multiplier updates
- [ ] Players can place bets during betting phase
- [ ] Players can cash out during flight
- [ ] Crash point is random (1.0x - 50.0x)
- [ ] All connected players see same rocket
- [ ] Winnings calculated and credited correctly

### Online Roulette Game
- [ ] New spin starts automatically every 60 seconds
- [ ] 30 seconds betting phase
- [ ] Wheel spins for 10 seconds
- [ ] Result announced (0-36)
- [ ] Red/Black bets pay x2
- [ ] Green (zero) pays x14
- [ ] Specific number pays x36
- [ ] All connected players see same spin
- [ ] Winnings calculated and credited correctly

### FN-Live System
- [ ] Admin can block users with custom duration
- [ ] Blocked users see red overlay immediately
- [ ] Timer counts down in real-time
- [ ] Block expires automatically after duration
- [ ] Admin can manually unblock users
- [ ] FN-Live system can be toggled on/off
- [ ] Profile shows FN-Live status (green shield or red shield)

### Daily Bonus
- [ ] Users can claim 10,000 FCOINS once per 24 hours
- [ ] Timer shows hours:minutes remaining
- [ ] Cannot abuse by refreshing page
- [ ] Balance updated correctly after claim

### Admin Panel
- [ ] Only accessible to founder (@Fronz, ID: 1908053913)
- [ ] Can view all users from database
- [ ] Can send broadcast messages
- [ ] Can give badges to users
- [ ] Can add/remove balance
- [ ] Can create promocodes
- [ ] Can toggle maintenance mode
- [ ] Can toggle FN-Live system
- [ ] Can block/unblock users with FN-Live

## Frontend Tests

### UI/UX
- [ ] Balance displays correctly (no flickering)
- [ ] Bet inputs allow full deletion and typing
- [ ] Theme toggle works (light/dark)
- [ ] Navigation between sections works
- [ ] Notifications appear and disappear correctly

### Online Games UI
- [ ] Rocket shows status (betting/flying/crashed)
- [ ] Rocket timer counts down
- [ ] Rocket multiplier updates in real-time
- [ ] Rocket icon moves diagonally during flight
- [ ] Roulette shows status (betting/spinning/result)
- [ ] Roulette timer counts down
- [ ] Roulette wheel spins with animation
- [ ] Bet buttons work correctly

### Profile
- [ ] User info displays correctly
- [ ] FN-Live status shows green shield when safe
- [ ] FN-Live status shows red shield when blocked
- [ ] Blocked status shows reason and countdown
- [ ] Badges display correctly
- [ ] Statistics update correctly

### Real-Time Features
- [ ] Online counter updates when users connect/disconnect
- [ ] Balance updates immediately via WebSocket
- [ ] Game results sync across all players
- [ ] Admin messages appear for all online users
- [ ] FN-Live blocks appear immediately

## Deployment Tests

### Render.com
- [ ] Build completes successfully
- [ ] Server starts on PORT environment variable
- [ ] Database file persists between restarts
- [ ] WebSocket connections work over HTTPS
- [ ] All API endpoints accessible

## Quick Test Commands

```bash
# Start server locally
npm start

# Check if server is running
curl http://localhost:3000

# Check WebSocket (in browser console)
const ws = new WebSocket('ws://localhost:3000');
ws.onopen = () => console.log('Connected!');

# Test API endpoints
curl -X POST http://localhost:3000/api/daily-bonus \
  -H "Content-Type: application/json" \
  -d '{"telegram_id": 1908053913}'
```

## Known Issues

None! All features implemented and working.

## Performance Notes

- Rocket multiplier updates every 100ms (smooth animation)
- WebSocket reconnects automatically if disconnected
- Database queries optimized with indexes
- Balance updates only when changed (no flickering)
