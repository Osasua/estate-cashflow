const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../auth');

const router = express.Router();
router.use(authenticate);

// Get dashboard data specifically for the logged-in resident
router.get('/dashboard', async (req, res) => {
  try {
    // 1. Find the member_id linked to this user
    const userRes = await query('SELECT member_id FROM users WHERE id = $1', [req.user.id]);
    const memberId = userRes.rows[0]?.member_id;

    if (!memberId) {
      return res.json({ 
        household: null, 
        monthlyDue: 0, monthlyPaid: 0, monthlyOutstanding: 0,
        oneTimeDue: 0, oneTimePaid: 0, oneTimeOutstanding: 0,
        contributions: [], recentPayments: [] 
      });
    }

    // 2. Get all contributions for this specific member (including type)
    const contribs = await query(
      `SELECT c.*, m.household_name, m.house_number, m.monthly_due
         FROM contributions c JOIN members m ON m.id = c.member_id
        WHERE c.member_id = $1
        ORDER BY c.period_year DESC, c.period_month DESC`, 
      [memberId]
    );

    // 3. Get recent payments for this member
    const payments = await query(
      `SELECT p.amount, p.method, p.paid_at, c.period_year, c.period_month, c.type
         FROM payments p JOIN contributions c ON p.contribution_id = c.id
        WHERE c.member_id = $1
        ORDER BY p.paid_at DESC LIMIT 10`, 
      [memberId]
    );

    // Separate Monthly from One-Time contributions
    // (We treat null/undefined type as 'Monthly' for backwards compatibility)
    const monthlyContribs = contribs.rows.filter(c => c.type === 'Monthly' || !c.type);
    const oneTimeContribs = contribs.rows.filter(c => c.type !== 'Monthly' && c.type);

    const monthlyDue = monthlyContribs.reduce((sum, r) => sum + Number(r.amount_due), 0);
    const monthlyPaid = monthlyContribs.reduce((sum, r) => sum + Number(r.amount_paid), 0);
    
    const oneTimeDue = oneTimeContribs.reduce((sum, r) => sum + Number(r.amount_due), 0);
    const oneTimePaid = oneTimeContribs.reduce((sum, r) => sum + Number(r.amount_paid), 0);

    res.json({
      household: contribs.rows[0] ? { 
        name: contribs.rows[0].household_name, 
        number: contribs.rows[0].house_number,
        monthly_due: contribs.rows[0].monthly_due
      } : null,
      monthlyDue,
      monthlyPaid,
      monthlyOutstanding: monthlyDue - monthlyPaid,
      oneTimeDue,
      oneTimePaid,
      oneTimeOutstanding: oneTimeDue - oneTimePaid,
      contributions: contribs.rows,
      recentPayments: payments.rows
    });
  } catch (error) {
    console.error('Resident dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

module.exports = router;