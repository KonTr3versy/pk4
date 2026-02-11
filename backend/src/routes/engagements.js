const express = require('express');

const coreRouter = require('./engagements/core');
const techniquesRouter = require('./engagements/techniques');
const collaborationRouter = require('./engagements/collaboration');

const router = express.Router();

router.use(coreRouter);
router.use(techniquesRouter);
router.use(collaborationRouter);

module.exports = router;
