require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

app.use(cors({ origin: ['https://axiora.cc', 'http://localhost:3000'] }));
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
      payment_method_types: ['card'],
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

    // Envoyer email de confirmation avec Resend
    await resend.emails.send({
      from: 'Axiora <contact@axiora.cc>',
      to: email,
      subject: '✅ Bienvenue sur Axiora — Confirmez votre compte',
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 520px; margin: 0 auto; background: #0f0f0f; color: #f0f0f0; padding: 40px; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #7F77DD; font-size: 28px; margin: 0;">Axio<span style="color: #f0f0f0;">ra</span></h1>
          </div>
          <h2 style="font-size: 22px; margin-bottom: 12px;">Bienvenue ${prenom} ! 👋</h2>
          <p style="color: #999; line-height: 1.7; margin-bottom: 24px;">
            Merci de vous être inscrit sur Axiora. Votre compte a été créé avec succès.
          </p>
          <p style="color: #999; line-height: 1.7; margin-bottom: 32px;">
            Vérifiez votre email via le lien envoyé par Supabase pour activer votre compte, puis connectez-vous pour accéder à votre espace client.
          </p>
          <div style="text-align: center; margin-bottom: 32px;">
            <a href="https://axiora.cc/connexion" style="background: #534AB7; color: #fff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 500; font-size: 15px;">
              Se connecter →
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #1f1f1f; margin: 24px 0;">
          <p style="color: #555; font-size: 12px; text-align: center;">
            © 2026 Axiora. Tous droits réservés.<br>
            <a href="https://axiora.cc" style="color: #7F77DD;">axiora.cc</a>
          </p>
        </div>
      `
    });

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