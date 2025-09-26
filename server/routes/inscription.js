const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Création dossier avatar si inexistant
const uploadPath = path.join(__dirname, '../avatar');
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

// Config Multer
const storage = multer.diskStorage({
	destination: (req, file, cb) => cb(null, uploadPath),
	filename: (req, file, cb) => {
		const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
		cb(null, uniqueSuffix + path.extname(file.originalname));
	}
});
const upload = multer({ storage });

module.exports = (db) => {
	router.post('/', upload.single('avatar'), async (req, res) => {
		const { username, password } = req.body;
		const avatar = req.file ? `/avatar/${req.file.filename}` : null;

		if (!username || !password || !avatar) {
			return res.status(400).json({ success: false, message: 'Tous les champs sont requis.' });
		}

		try {
			await db.run(
				'INSERT INTO users (username, password, avatar) VALUES (?, ?, ?)',
				[username, password, avatar]
			);

			// JSON pour le client
			return res.json({ success: true, username, avatar });

		} catch (err) {
			if (err.code === 'SQLITE_CONSTRAINT') {
				return res.status(409).json({ success: false, message: 'Nom d\'utilisateur déjà pris.' });
			} else {
				return res.status(500).json({ success: false, message: 'Erreur serveur.' });
			}
		}
	});

	return router;
};

