const { Router } = require('express');
const { join } = require('node:path');
const router = Router();

router.get('/', (req, res) => {
	res.sendFile(join(__dirname, '../../public/index.html'));
});

module.exports = router;
