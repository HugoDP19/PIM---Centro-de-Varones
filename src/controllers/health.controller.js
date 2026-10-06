const { getPool } = require('../config/db');

// GET /api/health  (con ?db=true también verifica SQL Server)
async function check(req, res) {
  const result = { status: 'ok', service: 'SICE', timestamp: new Date().toISOString() };

  if (req.query.db === 'true') {
    try {
      const pool = await getPool();
      await pool.request().query('SELECT 1 AS ok');
      result.database = 'connected';
    } catch (err) {
      result.status = 'error';
      result.database = 'unreachable';
      return res.status(503).json(result);
    }
  }

  res.json(result);
}

module.exports = { check };
