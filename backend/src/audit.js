const { query } = require('./db');

// Every financial write is logged for community transparency
async function audit(userId, action, table, recordId, oldValue, newValue) {
  await query(
    `INSERT INTO audit_log (user_id, action, table_name, record_id, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, action, table, recordId,
     oldValue ? JSON.stringify(oldValue) : null,
     newValue ? JSON.stringify(newValue) : null]
  );
}

module.exports = { audit };
