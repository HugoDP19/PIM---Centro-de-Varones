const { getPool } = require('../config/db');

// GET /api/health no consulta la base. ?db=true es una comprobación opcional de MySQL.
async function check(req, res) {
  const result = { status: 'ok', service: 'SICE', timestamp: new Date().toISOString() };

  if (req.query.db === 'true') {
    try {
      const pool = getPool();
      await pool.query('SELECT 1 AS ok');
      result.database = 'connected';
    } catch {
      result.status = 'error';
      result.database = 'unreachable';
      return res.status(503).json(result);
    }
  }

  res.json(result);
}

module.exports = { check };
