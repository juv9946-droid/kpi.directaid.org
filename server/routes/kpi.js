/* المسارات — تعريف نقاط الواجهة البرمجية */
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/kpiController');

router.get('/state', ctrl.state);
router.get('/since', ctrl.since);
router.post('/set', ctrl.set);
router.post('/bulk', ctrl.bulk);
router.get('/health', ctrl.health);

module.exports = router;
