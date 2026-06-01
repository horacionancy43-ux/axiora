require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({ origin: ['https://axiora.cc', 'http://localhost:3000'] }));
app.use(express.json());

let stripe, supabase, resend;

try {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
} catch (e) { console.error('⚠️ Stripe init error:', e.message); }

try {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
} catch (e) { console.error('⚠️ Supabase init error:', e.message); }

try {
  const { Resend } = require('resend');
  resend = new Resend(process.env.RESEND_API_KEY);
} catch (e) { console.error('⚠️ Resend init error:', e.message); }

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
      line_items: [{ price_data: { currency: 'eur', product_data: { name: productName }, unit_amount: Math.round(amount * 100) }, quantity: 1 }],
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
    const prices = { starter: 499, pro: 1299, premium: 2499 };
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price_data: { currency: 'eur', product_data: { name: `Axiora ${planName}` }, unit_amount: prices[planName.toLowerCase()] || 499, recurring: { interval: 'month' } }, quantity: 1 }],
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
      email, password,
      options: { data: { prenom, nom, telephone, pays } }
    });
    if (error) throw error;
    try {
      await resend.emails.send({
        from: 'Axiora <contact@axiora.cc>',
        to: email,
        subject: '✅ Bienvenue sur Axiora',
        html: `<div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;background:#0f0f0f;color:#f0f0f0;padding:40px;border-radius:16px;">
          <h1 style="color:#7F77DD;">Axio<span style="color:#f0f0f0;">ra</span></h1>
          <h2>Bienvenue ${prenom} ! 👋</h2>
          <p style="color:#999;">Votre compte a été créé avec succès.</p>
          <a href="https://axiora.cc/connexion" style="background:#534AB7;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;display:inline-block;margin-top:20px;">Se connecter →</a>
          <p style="color:#555;font-size:12px;margin-top:24px;">© 2026 Axiora</p>
        </div>`
      });
    } catch (emailErr) {
      console.error('⚠️ Email send error:', emailErr.message);
    }
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    res.json({ success: true, session: data.session, user: data.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================
// MIDDLEWARE AUTH
// ==================
async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorisé' });
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: 'Token invalide' });
    req.user = data.user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Erreur auth' });
  }
}

// ==================
// GET COMMANDES
// ==================
app.get('/commandes', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('commandes').select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================
// GET PROJETS
// ==================
app.get('/projets', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('projets').select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================
// GET FICHIERS
// ==================
app.get('/fichiers', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('fichiers').select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================
// ADMIN — TOUTES LES COMMANDES
// ==================
app.get('/admin/commandes', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('commandes').select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================
// ADMIN — TOUS LES CLIENTS
// ==================
app.get('/admin/clients', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profils').select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================
// STAFF LOGIN
// ==================
app.post('/staff/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('email', email)
      .eq('mot_de_passe', password)
      .eq('actif', true)
      .single();
    if (error || !data) return res.status(401).json({ error: 'Identifiants incorrects' });
    res.json({ success: true, staff: data });
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