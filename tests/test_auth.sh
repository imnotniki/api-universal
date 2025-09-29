curl -H "osrstoolsauthenticate: a604f945a03fa987b61643f1b2244713e0baabf0" http://localhost:23000/tribot/getUpdates\?limit\=5


curl -X POST \
     -H "Content-Type: application/json" \
     -H "osrstoolsauthenticate: a604f945a03fa987b61643f1b2244713e0baabf0" \
     -d '{"bot_id":"bot_001","status":"running","message":"Bot started successfully"}' \
     http://localhost:23000/tribot/postUpdate