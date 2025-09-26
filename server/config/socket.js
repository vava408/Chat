const connectedUsers = new Map();
let usersHistory = [];

function pushUsersHistory(count) {
	usersHistory.push({ time: Date.now(), count });
	if (usersHistory.length > 100) usersHistory.shift();
}

function setupSocket(io) {
	io.on('connection', (socket) => {
		const username = socket.handshake.auth.username || 'Anonymous';
		const avatar = socket.handshake.auth.avatar || null;
		connectedUsers.set(socket.id, { id: socket.id, user: username, avatar });

		console.log(`Nouvel utilisateur connecté : ${username}`);
		io.emit('usersCount', connectedUsers.size);
		pushUsersHistory(connectedUsers.size);

		socket.on('chat client', (msg) => {
			const user = connectedUsers.get(socket.id);
			io.emit('chat message', { user: user.user, avatar: user.avatar, content: msg });
		});

		socket.on('disconnect', () => {
			const user = connectedUsers.get(socket.id);
			if (user) {
				connectedUsers.delete(socket.id);
				io.emit('serveur', `${user.user} s'est déconnecté`);
				io.emit('usersCount', connectedUsers.size);
				pushUsersHistory(connectedUsers.size);
			}
		});
	});

	return {
		getUsersData: () => ({
			connected: connectedUsers.size,
			history: usersHistory
		})
	};
}

module.exports = setupSocket;
