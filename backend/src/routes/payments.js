const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const { query, pool } = require('../db');
const { authenticate } = require('../auth');

const router = express.Router();
router.use(authenticate);

// Helper to update DB
const recordPayment = async (contribution_id, amountPaid, reference, user_id) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT id FROM payments WHERE reference = $1', [reference]);
    if (existing.rows.length === 0) {
      await client.query(
        `INSERT INTO payments (contribution_id, amount, method, reference, note, recorded_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [contribution_id, amountPaid, 'paystack', reference, 'Online Payment', user_id]
      );
      await client.query(
        `UPDATE contributions SET amount_paid = amount_paid + $1 WHERE id = $2`,
        [amountPaid, contribution_id]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

// 1. Initialize Payment
router.post('/initialize', express.json(), async (req, res) => {
  const { contribution_id, amount, email } = req.body;
  if (!contribution_id || !amount || !email) return res.status(400).json({ error: 'Missing fields' });
  
  const reference = `ESTATE-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  try {
    const paystackResponse = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      { email, amount: amount * 100, reference, metadata: { contribution_id, user_id: req.user.id } },
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' } }
    );
    res.json({ authorization_url: paystackResponse.data.data.authorization_url, reference });
  } catch (error) {
    res.status(500).json({ error: 'Failed to initialize' });
  }
});

// 2. Verify Payment (For Localhost/Frontend Success)
router.post('/verify', express.json(), async (req, res) => {
  console.log('--- VERIFY ROUTE HIT ---');
  console.log('Body received:', req.body);
  
  const { reference } = req.body;
  if (!reference) {
    console.log('Error: No reference provided');
    return res.status(400).json({ error: 'Reference required' });
  }

  try {
    console.log('1. Calling Paystack API to verify:', reference);
    const paystackResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );

    console.log('2. Paystack Response Status:', paystackResponse.data.status);
    const transaction = paystackResponse.data.data;

    if (transaction.status === 'success') {
      console.log('3. Payment is SUCCESS. Metadata:', transaction.metadata);
      const { contribution_id, user_id } = transaction.metadata;
      const amountPaid = transaction.amount / 100;
      
      console.log(`4. Updating DB: Contribution ${contribution_id}, Amount ${amountPaid}`);
      
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // Check if already recorded
        const existing = await client.query('SELECT id FROM payments WHERE reference = $1', [reference]);
        if (existing.rows.length === 0) {
          await client.query(
            `INSERT INTO payments (contribution_id, amount, method, reference, note, recorded_by)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [contribution_id, amountPaid, 'paystack', reference, 'Online Payment', user_id]
          );
          await client.query(
            `UPDATE contributions SET amount_paid = amount_paid + $1 WHERE id = $2`,
            [amountPaid, contribution_id]
          );
          console.log('5. DB Updated Successfully!');
        } else {
          console.log('5. Payment already recorded (Duplicate check passed)');
        }
        await client.query('COMMIT');
        res.json({ success: true });
      } catch (e) {
        await client.query('ROLLBACK');
        console.error('6. DB Error:', e);
        res.status(500).json({ error: 'Database error' });
      } finally {
        client.release();
      }
    } else {
      console.log('Error: Paystack said status is not success:', transaction.status);
      res.status(400).json({ error: 'Payment not successful' });
    }
  } catch (error) {
    console.error('7. Verification Error:', error.message);
    // Check if it's an auth error
    if (error.response && error.response.status === 401) {
        console.error('Check your PAYSTACK_SECRET_KEY in .env file!');
    }
    res.status(500).json({ error: 'Verification failed' });
  }
});

// 3. Webhook (For Production)
router.post('/webhook/paystack', express.raw({ type: 'application/json' }), async (req, res) => {
  const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(JSON.stringify(req.body)).digest('hex');
  if (hash !== req.headers['x-paystack-signature']) return res.status(401).send('Invalid signature');
  
  const event = req.body;
  if (event.event === 'charge.success') {
    const { contribution_id, user_id } = event.data.metadata;
    const amountPaid = event.data.amount / 100;
    const reference = event.data.reference;
    try {
      await recordPayment(contribution_id, amountPaid, reference, user_id);
    } catch (e) { console.error(e); }
  }
  res.status(200).send('Webhook received');
});

module.exports = router;