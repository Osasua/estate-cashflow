const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const { query, pool } = require('../db');

const router = express.Router();

// Helper to safely record payment with idempotency
const recordPayment = async (contribution_id, amountPaid, reference, user_id) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Idempotency check
    const existing = await client.query(
      'SELECT id FROM payments WHERE reference = $1', 
      [reference]
    );
    
    if (existing.rows.length === 0) {
      await client.query(
        `INSERT INTO payments (contribution_id, amount, method, reference, note, recorded_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [contribution_id, amountPaid, 'paystack', reference, 'Online Payment', user_id || null]
      );
      
      await client.query(
        `UPDATE contributions SET amount_paid = amount_paid + $1 WHERE id = $2`,
        [amountPaid, contribution_id]
      );
      
      console.log(`✅ Payment recorded: Ref=${reference}, Amount=₦${amountPaid}`);
    } else {
      console.log(`⚠️ Duplicate payment ignored: Ref=${reference}`);
    }
    
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ DB Error in recordPayment:', e.message);
    throw e;
  } finally {
    client.release();
  }
};

// Apply authentication selectively - NOT to webhook
router.use((req, res, next) => {
  if (req.path === '/webhook/paystack') return next();
  // Import authenticate dynamically to avoid circular deps if needed
  const { authenticate } = require('../auth');
  authenticate(req, res, next);
});

// 1. Initialize Payment
router.post('/initialize', express.json(), async (req, res) => {
  const { contribution_id, amount, email } = req.body;
  
  if (!contribution_id || !amount || !email) {
    return res.status(400).json({ error: 'Missing required fields: contribution_id, amount, email' });
  }
  
  const reference = `ESTATE-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  
  try {
    const paystackResponse = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      { 
        email, 
        amount: Math.round(amount * 100), 
        reference, 
        metadata: { 
          contribution_id, 
          user_id: req.user?.id || null 
        } 
      },
      { 
        headers: { 
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 
          'Content-Type': 'application/json' 
        },
        timeout: 10000
      }
    );
    
    if (!paystackResponse.data.status) {
      throw new Error(paystackResponse.data.message || 'Paystack API error');
    }
    
    res.json({ 
      authorization_url: paystackResponse.data.data.authorization_url, 
      reference 
    });
    
  } catch (error) {
    console.error('Paystack init failed:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Payment initialization failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 2. Verify Payment (Frontend fallback)
router.post('/verify', express.json(), async (req, res) => {
  const { reference } = req.body;
  
  if (!reference) {
    return res.status(400).json({ error: 'Reference required' });
  }

  try {
    const paystackResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { 
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
        timeout: 10000
      }
    );

    const transaction = paystackResponse.data.data;

    if (transaction.status === 'success') {
      const { contribution_id, user_id } = transaction.metadata || {};
      const amountPaid = transaction.amount / 100;
      
      if (!contribution_id) {
        return res.status(400).json({ error: 'Missing contribution_id in metadata' });
      }
      
      await recordPayment(contribution_id, amountPaid, reference, user_id);
      res.json({ success: true });
      
    } else {
      res.status(400).json({ error: 'Payment not successful', status: transaction.status });
    }
    
  } catch (error) {
    console.error('Verification failed:', error.response?.data || error.message);
    if (error.response?.status === 401) {
      console.error('❌ Check PAYSTACK_SECRET_KEY in environment variables!');
    }
    res.status(500).json({ error: 'Verification failed' });
  }
});

// 3. Webhook (Production reliability)
router.post('/webhook/paystack', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // ✅ CRITICAL FIX: Use raw buffer for signature verification
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(req.body) // req.body is Buffer from express.raw()
      .digest('hex');
    
    if (hash !== req.headers['x-paystack-signature']) {
      console.warn('⚠️ Invalid Paystack webhook signature');
      return res.status(401).send('Invalid signature');
    }
    
    // Parse the raw buffer to JSON
    const event = JSON.parse(req.body.toString());
    console.log(`[WEBHOOK] Event: ${event.event}, Ref: ${event.data.reference}`);
    
    if (event.event === 'charge.success') {
      const { contribution_id, user_id } = event.data.metadata || {};
      const amountPaid = event.data.amount / 100;
      const reference = event.data.reference;
      
      if (!contribution_id) {
        console.error('❌ Webhook: Missing contribution_id in metadata');
        return res.status(400).send('Missing metadata');
      }
      
      await recordPayment(contribution_id, amountPaid, reference, user_id);
    }
    
    res.status(200).send('Webhook received');
    
  } catch (err) {
    console.error('❌ Webhook processing error:', err.message);
    res.status(500).send('Webhook error');
  }
});

module.exports = router;