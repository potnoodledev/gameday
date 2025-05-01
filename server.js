const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

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

  socket.on('disconnect', () => {
    if (currentName) {
      onlineStatus[currentName] = false;
      io.emit('onlineStatus', onlineStatus);
    }
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

  // Broadcast player moves to all clients
  socket.on('move', (data) => {
    io.emit('move', data);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 