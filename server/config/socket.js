const connectedUsers = new Map(); // stocke les utilisateurs connectés
let usersHistory = []; // historique du nombre d’utilisateurs connectés

function pushUsersHistory(count) {
    usersHistory.push({ time: Date.now(), count });
    if (usersHistory.length > 100) usersHistory.shift(); // garde 100 points max
}

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

            // mise à jour du compteur
            io.emit('usersCount', connectedUsers.size);
            pushUsersHistory(connectedUsers.size);
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

            io.emit('usersCount', connectedUsers.size);
            pushUsersHistory(connectedUsers.size);
        });

        // --- déconnexion ---
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

    // API pour exposer le nombre de connectés + historique
    return {
        getUsersData: () => ({
            connected: connectedUsers.size,
            history: usersHistory
        })
    };
}

module.exports = setupSocket;
