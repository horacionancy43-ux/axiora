require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

app.use(cors({ origin: 'https://axiora.cc' }));
app.use(express.json());

// ==================
// ROUTE TEST
// ==================
app.get('/', (req, res) => {
  res.json({ status: 'Axiora API en ligne ✅' });
});

// ==================
// CRÉER UN PAIEMENT STRIPE
// ==================
app.post('/create-payment', async (req, res) => {
  try {
    const { amount, productName, email } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'paypal'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: productName },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      customer_email: email,
      success_url: 'https://axiora.cc/dashboard?payment=success',
      cancel_url: 'https://axiora.cc/boutique?payment=cancelled',
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================
// CRÉER UN ABONNEMENT STRIPE
// ==================
app.post('/create-subscription', async (req, res) => {
  try {
    const { planName, email } = req.body;

    const prices = {
      starter: 499,
      pro: 1299,
      premium: 2499
    };

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: `Axiora ${planName}` },
          unit_amount: prices[planName.toLowerCase()] || 499,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      }],
      mode: 'subscription',
      customer_email: email,
      success_url: 'https://axiora.cc/dashboard?subscription=success',
      cancel_url: 'https://axiora.cc/abonnements?subscription=cancelled',
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================
// INSCRIPTION CLIENT
// ==================
app.post('/register', async (req, res) => {
  try {
    const { email, password, prenom, nom, telephone, pays } = req.body;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { prenom, nom, telephone, pays }
      }
    });

    if (error) throw error;
    res.json({ success: true, user: data.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================
// CONNEXION CLIENT
// ==================
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    res.json({ success: true, session: data.session, user: data.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================
// DÉMARRAGE SERVEUR
// ==================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Serveur Axiora démarré sur le port ${PORT}`);
});