// Warcry server: PeerJS signaling (/peerjs) + quick-match queue (/match).
// Gameplay data never passes through here; it only introduces two players.
const express = require('express');
const cors = require('cors');
const http = require('http');
const { ExpressPeerServer } = require('peer');
const { WebSocketServer } = require('ws');

const app = express();
app.use(cors());
const server = http.createServer(app);

app.get('/', (req, res) => res.send('Warcry server OK'));
app.use('/peerjs', ExpressPeerServer(server, { path: '/', allow_discovery: false }));

// ---- Relay fallback: when two players cannot connect directly (strict NAT), forward their small
// game messages through this server instead. Same room name on both sides pairs them. ----
const peerUpgrades = server.listeners('upgrade').slice();
server.removeAllListeners('upgrade');
const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
const rooms = new Map();
wss.on('connection', (ws, room) => {
  const list = (rooms.get(room) || []).filter(w => w.readyState === 1);
  if (list.length >= 2) { ws.close(); return; }
  list.push(ws); rooms.set(room, list);
  if (list.length === 2) list.forEach(w => w.send('{"t":"ready"}'));
  ws.on('message', d => (rooms.get(room) || []).forEach(w => { if (w !== ws && w.readyState === 1) w.send(d.toString()); }));
  ws.on('close', () => {
    const rest = (rooms.get(room) || []).filter(w => w !== ws);
    if (rest.length) { rooms.set(room, rest); rest.forEach(w => w.readyState === 1 && w.send('{"t":"left"}')); } else rooms.delete(room);
  });
});
server.on('upgrade', (req, socket, head) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/relay') {
    const room = u.searchParams.get('room') || '';
    if (!/^[\w-]{4,60}$/.test(room)) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, room));
  } else peerUpgrades.forEach(l => l.call(server, req, socket, head));
});
setInterval(() => wss.clients.forEach(w => w.readyState === 1 && w.ping()), 25000); // keep connections alive

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