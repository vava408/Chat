const express = require('express');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// Configurer multer pour l'upload d'avatar
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/assets/images'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

module.exports = (db) => {
  router.post('/', upload.single('avatar'), async (req, res) => {
    const { username, password } = req.body;
    const avatar = req.file ? `/assets/images/${req.file.filename}` : null;

    if (!username || !password || !avatar) {
      return res.status(400).json({ error: 'Tous les champs sont requis.' });
    }

    try {
      await db.run(
        'INSERT INTO users (username, password, avatar) VALUES (?, ?, ?)',
        [username, password, avatar]
      );
      res.status(201).json({ message: 'Inscription réussie.' });
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT') {
        res.status(409).json({ error: 'Nom d\'utilisateur déjà pris.' });
      } else {
        res.status(500).json({ error: 'Erreur serveur.' });
      }
    }
  });

  return router;
};