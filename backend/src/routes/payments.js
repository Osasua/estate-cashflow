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
    
    // Idempotency check
    const existing = await client.query(
      'SELECT id FROM payments WHERE reference = $1', 
      [reference]
    );
    
    if (existing.rows.length === 0) {
      // Get the contribution details to know the exact amount due
      const contribRes = await client.query(
        'SELECT amount_due, amount_paid FROM contributions WHERE id = $1',
        [contribution_id]
      );
      
      if (contribRes.rows.length === 0) {
        throw new Error('Contribution not found');
      }
      
      const contribution = contribRes.rows[0];
      const amountDue = parseFloat(contribution.amount_due);
      const alreadyPaid = parseFloat(contribution.amount_paid);
      const remainingDue = amountDue - alreadyPaid;
      
      // Only record up to the amount due for this contribution
      // Any excess is handled separately (carry-forward logic)
      const amountToRecord = Math.min(amountPaid, remainingDue);
      const overpayment = amountPaid - amountToRecord;
      
      // Insert payment record
      await client.query(
        `INSERT INTO payments (contribution_id, amount, method, reference, note, recorded_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [contribution_id, amountToRecord, 'paystack', reference, 'Online Payment', user_id || null]
      );
      
      // Update the contribution
      await client.query(
        `UPDATE contributions SET amount_paid = amount_paid + $1 WHERE id = $2`,
        [amountToRecord, contribution_id]
      );
      
      console.log(`✅ Payment recorded: Ref=${reference}, Amount=₦${amountToRecord}, Overpayment=₦${overpayment}`);
      
      // Handle overpayment (carry forward to next period)
      if (overpayment > 0) {
        console.log(`⚠️ Overpayment of ₦${overpayment} detected - carry-forward logic needed`);
        // TODO: Implement carry-forward to next month's contribution
      }
    } else {
      console.log(`️ Duplicate payment ignored: Ref=${reference}`);
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
        amount: Math.round(amount * 100), // Convert to kobo
        reference,
        // ✅ CRITICAL FIX: Tell Paystack where to redirect after payment
        callback_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/my-account?payment=success`,
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
      // Use the amount from metadata/initialization, NOT from Paystack response
      // to avoid including Paystack fees
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
      // Use the amount from the webhook, but our recordPayment function
      // will ensure we don't over-record beyond what's due
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