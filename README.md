# Warcry server (quick match + signaling + relay)

What it does: introduces two players (PeerJS signaling at /peerjs) and pairs strangers (GET /match).
Gameplay and pose data still go directly between players. Tested locally: pairing, bad-id check and the PeerJS endpoint respond correctly.

## Run locally
    cd server
    npm install
    npm start          # listens on http://localhost:9000

In warcry-arena.html set:  const NET={server:'http://localhost:9000',turn:null};

## Deploy (free tiers work for testing)
1. Push the `server` folder to a GitHub repo.
2. On Render.com (or Railway/Fly.io): New Web Service -> that repo -> Build: `npm install` -> Start: `npm start`.
3. Copy the https URL it gives you, e.g. https://warcry-abc.onrender.com
4. In warcry-arena.html set NET.server to that URL.
Free Render services sleep when idle: the first request after a break can take about 30 seconds.

## Relay fallback (new): works on any network, free
If two players cannot connect directly (very common between different home or mobile networks), the game
waits 9 seconds and then automatically sends their small game messages through this server instead.
No TURN account or payment needed. It adds some lag (depends on how far the server is from you).
To test it yourself: add ?relay=1 to the game URL on both computers to skip the direct attempt.
IMPORTANT: after updating server.js and package.json, push them to GitHub so Render redeploys.
The old server has no relay, so the fallback only works after you redeploy.

## TURN relay (optional, usually not needed now) (needed for some home/mobile networks)
STUN alone fails for roughly 1 in 5 player pairs. Get free TURN credentials from a provider
(e.g. Metered Open Relay, Cloudflare Calls TURN) and set:
    turn:{urls:'turn:YOUR_HOST:3478',username:'YOUR_USER',credential:'YOUR_PASS'}
Note: credentials in a public page can be copied by others, so use a provider's short-lived/limited credentials.

## Put the game online
The game is one HTML file. Host it on any HTTPS static host (Netlify Drop, GitHub Pages, Cloudflare Pages).
HTTPS is required for webcam access on a public address.