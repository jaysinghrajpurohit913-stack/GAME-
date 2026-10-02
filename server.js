// Warcry server: PeerJS signaling (/peerjs) + quick-match queue (/match).
// Gameplay data never passes through here; it only introduces two players.
const express = require('express');
const cors = require('cors');
const http = require('http');
const { ExpressPeerServer } = require('peer');

const app = express();
app.use(cors());
const server = http.createServer(app);

app.get('/', (req, res) => res.send('Warcry server OK'));
app.use('/peerjs', ExpressPeerServer(server, { path: '/', allow_discovery: false }));

// Quick match: first caller waits (long-poll), second caller is paired with them.
let waiting = null;
app.get('/match', (req, res) => {
  const id = String(req.query.id || '');
  if (!/^[\w-]{4,60}$/.test(id)) return res.status(400).json({ error: 'bad id' });
  if (waiting && waiting.id !== id) {
    const w = waiting;
    waiting = null;
    clearTimeout(w.timer);
    w.res.json({ role: 'host', opponent: id });      // waiter hosts, newcomer connects to them
    return res.json({ role: 'guest', opponent: w.id });
  }
  if (waiting) clearTimeout(waiting.timer);
  const entry = { id, res };
  entry.timer = setTimeout(() => {
    if (waiting === entry) waiting = null;
    res.json({ role: null });                         // nobody came; client can retry
  }, 25000);
  waiting = entry;
  req.on('close', () => { if (waiting === entry && !res.writableEnded) { clearTimeout(entry.timer); waiting = null; } });
});

const port = process.env.PORT || 9000;
server.listen(port, () => console.log('Warcry server listening on ' + port));
