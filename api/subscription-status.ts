import Stripe from 'stripe';

// We MUST use process.env to prevent GitHub Secret Scanning from blocking the commit
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error('Missing STRIPE_SECRET_KEY environment variable');
}

const stripe = new Stripe(STRIPE_SECRET_KEY || '', {
  // apiVersion omitted to use default
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { email } = req.query;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Grant premium access to specific admin email
    if (email === 'fredwisseh@gmail.com') {
      return res.status(200).json({ isPremium: true });
    }

    const customers = await stripe.customers.list({ email: email, limit: 1 });
    
    if (customers.data.length === 0) {
      return res.status(200).json({ isPremium: false });
    }

    const customerId = customers.data[0].id;
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    const isPremium = subscriptions.data.length > 0;
    return res.status(200).json({ isPremium });
  } catch (error: any) {
    console.error('Error checking subscription status:', error);
    return res.status(500).json({ error: error.message });
  }
}
