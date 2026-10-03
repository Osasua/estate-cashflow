require('dotenv').config();
const { startCronJobs } = require('./cron');
const path = require('path');
const express = require('express');
const cors = require('cors');

const app = express();

   app.use(cors({ 
     origin: process.env.FRONTEND_URL || 'http://localhost:5173',
     credentials: true 
   }));
// Paystack webhook needs the raw request body — mount BEFORE express.json()
app.use('/api/payments', require('./routes/payments'));
app.use(express.json({ limit: '2mb' }));
   app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
   
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/members', require('./routes/members'));
app.use('/api/contributions', require('./routes/contributions'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reports', require('./routes/reports'));
   app.use('/api/resident', require('./routes/resident'));
      app.use('/api/users', require('./routes/users'));
         app.use('/api/audit', require('./routes/audit'));
            app.use('/api/password', require('./routes/password'));
               app.use('/api/profile', require('./routes/profile'));
                  app.use('/api/admin/broadcast', require('./routes/broadcast'));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Ferrano Court Portal API on http://localhost:${port}`));
startCronJobs();
