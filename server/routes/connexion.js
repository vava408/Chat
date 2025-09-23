const express = require('express');
const router = express.Router();

module.exports = (db) => {
  router.post('/', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Tous les champs sont requis.' });
    }

    try {
      const user = await db.get(
        'SELECT * FROM users WHERE username = ? AND password = ?',
        [username, password]
      );
      if (!user) {
        return res.status(401).json({ error: 'Identifiants invalides.' });
      }
      res.status(200).json({
        message: 'Connexion réussie.',
        user: {
          id: user.id,
          username: user.username,
          avatar: user.avatar
        }
      });
    } catch (err) {
      res.status(500).json({ error: 'Erreur serveur.' });
    }
  });

  return router;
};