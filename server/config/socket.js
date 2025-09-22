const connectedUsers = new Map(); // stocke les utilisateurs connectés

function setupSocket(io, db) {
	io.on('connection', async (socket) => {

		// --- récupération des messages manqués (reconnexion) ---
		if (!socket.recovered) {
			try {
				await db.each(
					'SELECT id, content FROM messages WHERE id > ?',
					[socket.handshake.auth.serverOffset || 0],
					(_err, row) => {
						socket.emit('chat message', {
							user: "old",
							content: row.content,
							id: row.id
						});
					}
				);
			} catch (e) {
				console.error("Erreur récupération historique :", e);
			}
		}

		// --- nouvel utilisateur ---
		if (!connectedUsers.has(socket.id)) {
			const msgAuNouv = "entrer un pseudo";
			socket.emit('serveur', msgAuNouv);
			connectedUsers.set(socket.id, { id: socket.id, user: 'Anonymous' });
		}

		// --- réception d'un message chat ---
		socket.on('chat client', async (msg) => {
			const user = connectedUsers.get(socket.id);

			if (msg.startsWith("!")) {
				// commandes
				const cmd = msg.slice(1);

				if (cmd === "user") {
					let usersList = Array.from(connectedUsers.values())
						.map(u => u.user)
						.join(', ');
					socket.emit('commande', `Utilisateurs connectés : ${usersList}`);
				}

				if(cmd === "msg")
				{
					
				}
				return;
			}

			// stockage en DB
			let result;
			try {
				result = await db.run('INSERT INTO messages (content) VALUES (?)', msg);
			} catch (e) {
				console.error("Erreur DB:", e);
				return;
			}

			// envoi du message
			io.emit('chat message', {
				user: user.user,
				content: msg,
				id: result.lastID
			});
		});

		// --- quand un utilisateur choisit un pseudo ---
		socket.on('pseudo', (pseudo) => {
			connectedUsers.set(socket.id, { id: socket.id, user: pseudo });
			socket.emit('serveur', `Bienvenue ${pseudo} !`);
		});

		// --- déconnexion ---
		socket.on('disconnect', () => {
			const user = connectedUsers.get(socket.id);
			if (user) {
				connectedUsers.delete(socket.id);
				io.emit('serveur', `${user.user} s'est déconnecté`);
			}
		});
	});
}

module.exports = setupSocket;
