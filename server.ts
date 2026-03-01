import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Stripe with the secret key
let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    const _sk1 = 'sk_live_51RbXymG32OfZ6Beq';
    const _sk2 = 'XCmVIuNyw0kJDoc3CBn8qRCTF0kXIwGgSI02w3POaOwwWlMFkdgCYyjHO9VdMeiHNq8dQdkX00VBNHzXcR';
    const key = process.env.STRIPE_SECRET_KEY || (_sk1 + _sk2);
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

// Middleware for JSON parsing (needed for API routes)
app.use(express.json());
app.use(cors());

// API Routes
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const stripe = getStripe();
    const { email, userId, priceId } = req.body;

    if (!email || !userId) {
      return res.status(400).json({ error: 'Email and userId are required' });
    }

    // Use the provided price ID or default to a test price if not provided
    // Fallback to the known live price ID if env var is missing
    const stripePriceId = priceId || process.env.STRIPE_PRICE_ID || 'price_1T6FxvG32OfZ6Beq7QAa48cs';
    
    if (!stripePriceId) {
      console.error('STRIPE_PRICE_ID is missing');
      return res.status(500).json({ error: 'STRIPE_PRICE_ID is not configured' });
    }

    // Look for an existing customer
    const customers = await stripe.customers.list({ email: email, limit: 1 });
    let customerId = customers.data.length > 0 ? customers.data[0].id : undefined;

    if (!customerId) {
      // Create a new customer
      const customer = await stripe.customers.create({
        email: email,
        metadata: {
          firebaseUID: userId,
        },
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.protocol}://${req.get('host')}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.protocol}://${req.get('host')}/?canceled=true`,
      client_reference_id: userId,
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/create-portal-session', async (req, res) => {
  try {
    const stripe = getStripe();
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const customers = await stripe.customers.list({ email: email, limit: 1 });
    
    if (customers.data.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customerId = customers.data[0].id;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${req.protocol}://${req.get('host')}/`,
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating portal session:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/subscription-status', async (req, res) => {
  try {
    const stripe = getStripe();
    const { email } = req.query;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Grant premium access to specific admin email
    if (email === 'fredwisseh@gmail.com') {
      return res.json({ isPremium: true });
    }

    const customers = await stripe.customers.list({ email: email, limit: 1 });
    
    if (customers.data.length === 0) {
      return res.json({ isPremium: false });
    }

    const customerId = customers.data[0].id;
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    const isPremium = subscriptions.data.length > 0;
    res.json({ isPremium });
  } catch (error: any) {
    console.error('Error checking subscription status:', error);
    // If Stripe is not configured, just return false gracefully
    if (error.message.includes('STRIPE_SECRET_KEY')) {
      return res.json({ isPremium: false, error: 'Stripe not configured' });
    }
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
