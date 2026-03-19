import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';

dotenv.config();

const app = express();
const PORT = 3000;
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Track online users
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  const updateOnlineUsers = () => {
    const count = io.sockets.sockets.size;
    io.emit('onlineUsers', count);
  };

  // Broadcast the updated count to all clients
  updateOnlineUsers();

  socket.on('requestOnlineUsers', () => {
    socket.emit('onlineUsers', io.sockets.sockets.size);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // Broadcast the updated count to all clients after a short delay to ensure removal
    setTimeout(() => {
      updateOnlineUsers();
    }, 100);
  });
});

// Initialize Stripe with the secret key
let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
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

let cachedStripePriceId: string | null = null;

// API Routes
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const stripe = getStripe();
    const { email, userId, priceId, returnUrl } = req.body;

    if (!email || !userId) {
      return res.status(400).json({ error: 'Email and userId are required' });
    }

    const baseUrl = returnUrl || `${req.protocol}://${req.get('host')}`;

    // Use the provided price ID or default to the env var
    let stripePriceId = priceId || process.env.STRIPE_PRICE_ID || cachedStripePriceId;
    
    if (!stripePriceId) {
      console.log('STRIPE_PRICE_ID is missing, creating a default product and price...');
      try {
        const product = await stripe.products.create({
          name: 'Premium Subscription',
          description: 'Unlock all game modes, special cards, and themes.',
        });
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: 499, // $4.99
          currency: 'usd',
          recurring: { interval: 'month' },
        });
        stripePriceId = price.id;
        cachedStripePriceId = price.id;
      } catch (err: any) {
        console.error('Failed to create Stripe product/price:', err);
        return res.status(500).json({ error: 'Failed to configure Stripe pricing automatically. Please set STRIPE_PRICE_ID.' });
      }
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
      success_url: `${baseUrl}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?canceled=true`,
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
    const { email, returnUrl } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const baseUrl = returnUrl || `${req.protocol}://${req.get('host')}`;

    const customers = await stripe.customers.list({ email: email, limit: 1 });
    
    if (customers.data.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customerId = customers.data[0].id;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/`,
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

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
