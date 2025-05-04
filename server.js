const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static files (index.html, games/, etc.)
app.use(express.static(path.join(__dirname)));

// Serve /github-helper as a static route
app.use('/github-helper', express.static(path.join(__dirname, 'github-helper', 'public')));

// In-memory leaderboards: { [gameName]: [{ name, score }] }
const leaderboards = {};
// Track online status: { [name]: true/false }
let onlineStatus = {};

// --- Cell Tag Game State ---
const cellTagState = {
  cells: {}, // { [socket.id]: { x, y, radius, color, name } }
  foods: []
};
const MAP_SIZE = 3000;
const START_RADIUS = 40;
const FOOD_RADIUS = 12;
const FOOD_COUNT = 80;
const COLORS = [
  '#38bdf8','#fbbf24','#f472b6','#34d399','#f87171','#a78bfa','#facc15','#60a5fa','#fb7185','#f472b6','#4ade80','#f59e42','#f472b6','#fcd34d','#818cf8','#f472b6','#fbbf24','#f472b6','#34d399','#f87171'
];
function spawnFood() {
  while (cellTagState.foods.length < FOOD_COUNT) {
    cellTagState.foods.push({
      x: Math.random() * MAP_SIZE,
      y: Math.random() * MAP_SIZE
    });
  }
}
spawnFood();
function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.text({ type: 'text/*', limit: '1mb' }));

io.on('connection', (socket) => {
  let currentGame = null;
  let currentName = null;

  socket.on('scoreUpdate', ({ name, score, game }) => {
    currentGame = game;
    currentName = name;
    onlineStatus[name] = true;
    if (!leaderboards[game]) leaderboards[game] = [];
    // Update or insert player score
    const idx = leaderboards[game].findIndex(e => e.name === name);
    if (idx >= 0) {
      leaderboards[game][idx].score = score;
    } else {
      leaderboards[game].push({ name, score });
    }
    // Sort descending by score
    leaderboards[game].sort((a, b) => b.score - a.score);
    // Broadcast updated leaderboard and online status
    io.emit('leaderboard', leaderboards[game]);
    io.emit('onlineStatus', onlineStatus);
  });

  socket.on('joinGame', (game) => {
    currentGame = game;
    if (!leaderboards[game]) leaderboards[game] = [];
    socket.emit('leaderboard', leaderboards[game]);
    socket.emit('onlineStatus', onlineStatus);
  });

  socket.on('playerJoined', ({ name, game }) => {
    currentGame = game;
    currentName = name;
    onlineStatus[name] = true;
    if (!leaderboards[game]) leaderboards[game] = [];
    // Add player if not present
    if (!leaderboards[game].some(e => e.name === name)) {
      leaderboards[game].push({ name, score: 0 });
      leaderboards[game].sort((a, b) => b.score - a.score);
    }
    io.emit('leaderboard', leaderboards[game]);
    io.emit('onlineStatus', onlineStatus);
  });

  socket.on('join', ({ name }) => {
    // Only for Cell Tag
    cellTagState.cells[socket.id] = {
      x: MAP_SIZE/2 + (Math.random()-0.5)*MAP_SIZE/2,
      y: MAP_SIZE/2 + (Math.random()-0.5)*MAP_SIZE/2,
      radius: START_RADIUS,
      color: randomColor(),
      name: name || 'Player'
    };
    socket.emit('state', { cells: cellTagState.cells, foods: cellTagState.foods });
    io.emit('state', { cells: cellTagState.cells, foods: cellTagState.foods });
  });

  socket.on('move', ({ dx, dy }) => {
    const cell = cellTagState.cells[socket.id];
    if (!cell) return;
    // Move cell
    const speed = Math.max(4, 16 - (cell.radius - START_RADIUS) * 0.08);
    cell.x += dx * speed;
    cell.y += dy * speed;
    cell.x = Math.max(cell.radius, Math.min(MAP_SIZE - cell.radius, cell.x));
    cell.y = Math.max(cell.radius, Math.min(MAP_SIZE - cell.radius, cell.y));
    // Eat food
    for (let i = cellTagState.foods.length - 1; i >= 0; i--) {
      const f = cellTagState.foods[i];
      const dist = Math.hypot(cell.x - f.x, cell.y - f.y);
      if (dist < cell.radius + FOOD_RADIUS) {
        cellTagState.foods.splice(i, 1);
        cell.radius = Math.min(160, cell.radius + 3);
      }
    }
    spawnFood();
    // Eat other players
    for (const [id, other] of Object.entries(cellTagState.cells)) {
      if (id !== socket.id && other.radius < cell.radius - 8) {
        const dist = Math.hypot(cell.x - other.x, cell.y - other.y);
        if (dist < cell.radius) {
          // Eat the other cell
          cell.radius = Math.min(160, cell.radius + other.radius * 0.7);
          other.radius = START_RADIUS;
          other.x = Math.random() * MAP_SIZE;
          other.y = Math.random() * MAP_SIZE;
        }
      }
    }
    io.emit('state', { cells: cellTagState.cells, foods: cellTagState.foods });
  });

  socket.on('disconnect', () => {
    if (currentName) {
      onlineStatus[currentName] = false;
      io.emit('onlineStatus', onlineStatus);
    }
    delete cellTagState.cells[socket.id];
    io.emit('state', { cells: cellTagState.cells, foods: cellTagState.foods });
    // Optionally: remove player from leaderboard on disconnect
  });

  // Handle name change: transfer score and online status
  socket.on('nameChange', ({ oldName, newName, game }) => {
    if (!leaderboards[game]) leaderboards[game] = [];
    // Find old entry
    const oldIdx = leaderboards[game].findIndex(e => e.name === oldName);
    let score = 0;
    if (oldIdx >= 0) {
      score = leaderboards[game][oldIdx].score;
      leaderboards[game].splice(oldIdx, 1);
    }
    // Remove old online status
    delete onlineStatus[oldName];
    // Add new entry if not present
    let newIdx = leaderboards[game].findIndex(e => e.name === newName);
    if (newIdx >= 0) {
      // If new name already exists, keep the higher score
      leaderboards[game][newIdx].score = Math.max(leaderboards[game][newIdx].score, score);
    } else {
      leaderboards[game].push({ name: newName, score });
    }
    onlineStatus[newName] = true;
    leaderboards[game].sort((a, b) => b.score - a.score);
    io.emit('leaderboard', leaderboards[game]);
    io.emit('onlineStatus', onlineStatus);
    currentName = newName;
  });
});

app.get('/games/livegame', (req, res) => {
  fs.readFile(path.join(__dirname, 'games', 'livegame.html'), 'utf8', (err, data) => {
    if (err) return res.status(404).send('Game not found');
    res.set('Content-Type', 'text/html');
    res.send(data);
  });
});

app.post('/games/livegame', (req, res) => {
  fs.writeFile(path.join(__dirname, 'games', 'livegame.html'), req.body, 'utf8', (err) => {
    if (err) return res.status(500).send('Failed to save');
    res.send('Saved');
  });
});

app.post('/api/llm-game', async (req, res) => {
  const messages = req.body.messages;
  if (!Array.isArray(messages)) return res.status(400).json({ error: 'Missing messages' });
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        // model: 'gpt-4.1-nano-2025-04-14',
        model: 'gpt-4.1',
        messages,
        max_completion_tokens: 4096
      })
    });
    const data = await response.json();
    let html = '';
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      html = data.choices[0].message.content.trim();
      if (html.startsWith('```html')) html = html.replace(/^```html\s*/, '').replace(/```$/, '');
    }
    res.json({ html });
  } catch (err) {
    res.status(500).json({ error: err.message || err });
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 