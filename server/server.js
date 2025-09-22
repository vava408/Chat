const express = require('express');
const { createServer } = require('node:http');
const { Server } = require('socket.io');
const { join } = require('node:path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function main() {
	const db = await open({
		filename: 'Chat.db',
		driver: sqlite3.Database
	});

	await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_offset TEXT UNIQUE,
      content TEXT
    );
  `);

	const app = express();
	const server = createServer(app);
	const io = new Server(server, {
		connectionStateRecovery: {}
	});

	// routes
	const indexRoute = require('./routes/index.js');
	app.use('/', indexRoute);

	// fichiers statiques
	app.use(express.static(join(__dirname, '../public')));

	// sockets
	const setupSocket = require('./config/socket');
	setupSocket(io , db);

	server.listen(3001, () => {
		console.log('Server running at http://localhost:3001');
	});
}

main();