const express = require('express');
const { createServer } = require('node:http');
const { Server } = require('socket.io');
const { join } = require('node:path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function main() {
	const db = await open({
		filename: join(__dirname, 'Chat.db'),
		driver: sqlite3.Database
	});

	// Création des tables si elles n'existent pas
	await db.exec(`
		CREATE TABLE IF NOT EXISTS messages (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			client_offset TEXT UNIQUE,
			content TEXT
		);
	`);

	await db.exec(`
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT UNIQUE,
			password TEXT,
			avatar TEXT
		);
	`);

	const app = express();
	const server = createServer(app);
	const io = new Server(server, { connectionStateRecovery: {} });

	// --- routes principales ---
	const indexRoute = require('./routes/index.js');
	app.use('/', indexRoute);

	// --- router PM2 ---
	const { router: pm2Router, bandwidthMiddleware } = require('./routes/api');
	app.use(bandwidthMiddleware);
	app.use('/api', pm2Router);

	// --- router inscription ---
	const registerRoute = require('./routes/inscription.js')(db);
	app.use('/register', registerRoute);

	// --- fichiers statiques ---
	app.use(express.static(join(__dirname, '../public'))); // public files
	app.use('/avatar', express.static(join(__dirname, 'avatar'))); // avatars

	// --- sockets ---
	const setupSocket = require('./config/socket');
	const socketModule = setupSocket(io, db);

	// --- API pour récupérer nombre de connectés + historique ---
	app.get('/api/users', (req, res) => {
		res.json(socketModule.getUsersData());
	});

	// --- démarrage serveur ---
	const PORT = 3001;
	server.listen(PORT, () => {
		console.log(`✅ Server running at http://localhost:${PORT}`);
	});
}
	
main();
