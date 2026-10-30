const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const { query, pool } = require('../db');

const router = express.Router();

// Helper to safely record payment with idempotency and smart allocation
const recordPayment = async (contribution_id, amountPaid, reference, user_id) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const existing = await client.query('SELECT id FROM payments WHERE reference = $1', [reference]);
    
    if (existing.rows.length === 0) {
      const contribRes = await client.query('SELECT amount_due, amount_paid FROM contributions WHERE id = $1', [contribution_id]);
      if (contribRes.rows.length === 0) throw new Error('Contribution not found');
      
      const contribution = contribRes.rows[0];
      const amountDue = parseFloat(contribution.amount_due);
      const alreadyPaid = parseFloat(contribution.amount_paid);
      const remainingDue = amountDue - alreadyPaid;
      
      const amountToRecord = Math.min(amountPaid, remainingDue);
      
      await client.query(
        `INSERT INTO payments (contribution_id, amount, method, reference, note, recorded_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [contribution_id, amountToRecord, 'paystack', reference, 'Online Payment', user_id || null]
      );
      
      await client.query(`UPDATE contributions SET amount_paid = amount_paid + $1 WHERE id = $2`, [amountToRecord, contribution_id]);
      console.log(`✅ Payment recorded: Ref=${reference}, Amount=₦${amountToRecord}`);
    } else {
      console.log(`⚠️ Duplicate payment ignored: Ref=${reference}`);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

router.use((req, res, next) => {
  if (req.path === '/webhook/paystack') return next();
  const { authenticate } = require('../auth');
  authenticate(req, res, next);
});

// 1. Initialize Payment
router.post('/initialize', express.json(), async (req, res) => {
  const { contribution_id, amount, email } = req.body;
  if (!contribution_id || !amount || !email) return res.status(400).json({ error: 'Missing required fields' });
  
  const reference = `ESTATE-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  
  try {
    const paystackResponse = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      { 
        email, 
        amount: Math.round(amount * 100), 
        reference,
        // ✅ UPDATED: Point to the new dedicated success page
        callback_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-success?reference=${reference}`,
        metadata: { contribution_id, user_id: req.user?.id || null } 
      },
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' }, timeout: 10000 }
    );
    
    if (!paystackResponse.data.status) throw new Error(paystackResponse.data.message || 'Paystack API error');
    res.json({ authorization_url: paystackResponse.data.data.authorization_url, reference });
  } catch (error) {
    console.error('Paystack init failed:', error.response?.data || error.message);
    res.status(500).json({ error: 'Payment initialization failed' });
  }
});

// 2. Verify Payment (Updated to return receipt data)
router.post('/verify', express.json(), async (req, res) => {
  const { reference } = req.body;
  if (!reference) return res.status(400).json({ error: 'Reference required' });

  try {
    const paystackResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }, timeout: 10000 }
    );

    const transaction = paystackResponse.data.data;

    if (transaction.status === 'success') {
      const { contribution_id, user_id } = transaction.metadata || {};
      const amountPaid = transaction.amount / 100;
      
      if (!contribution_id) return res.status(400).json({ error: 'Missing contribution_id' });
      
      await recordPayment(contribution_id, amountPaid, reference, user_id);
      
      // ✅ UPDATED: Fetch the contribution details to send back for the receipt
      const contribRes = await query(
        `SELECT c.period_year, c.period_month, c.type, m.household_name 
         FROM contributions c JOIN members m ON c.member_id = m.id 
         WHERE c.id = $1`, 
        [contribution_id]
      );
      const contrib = contribRes.rows[0];
      const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      
      res.json({ 
        success: true, 
        receipt: {
          reference: transaction.reference,
          amount: amountPaid,
          date: transaction.paid_at,
          period: contrib ? `${MONTHS[contrib.period_month - 1]} ${contrib.period_year}` : 'Unknown Period',
          type: contrib?.type || 'Monthly',
          household: contrib?.household_name || 'Resident'
        }
      });
    } else {
      res.status(400).json({ error: 'Payment not successful', status: transaction.status });
    }
  } catch (error) {
    console.error('Verification failed:', error.message);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// 3. Webhook
router.post('/webhook/paystack', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(req.body).digest('hex');
    if (hash !== req.headers['x-paystack-signature']) return res.status(401).send('Invalid signature');
    
    const event = JSON.parse(req.body.toString());
    if (event.event === 'charge.success') {
      const { contribution_id, user_id } = event.data.metadata || {};
      const amountPaid = event.data.amount / 100;
      if (contribution_id) await recordPayment(contribution_id, amountPaid, event.data.reference, user_id);
    }
    res.status(200).send('Webhook received');
  } catch (err) {
    res.status(500).send('Webhook error');
  }
});

module.exports = router;