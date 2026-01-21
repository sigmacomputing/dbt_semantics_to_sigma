const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const express = require('express');
const router = express.Router();

const { router: convertModel, convertSemantics } = require('./converter/convert_semantics');

router.use('/convertModel', convertModel);
router.use('/convertSemantics', convertSemantics);

module.exports = router;