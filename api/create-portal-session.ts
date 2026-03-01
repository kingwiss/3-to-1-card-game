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
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const customers = await stripe.customers.list({ email: email, limit: 1 });
    
    if (customers.data.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customerId = customers.data[0].id;

    // Create Portal Session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${req.headers.origin}/`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating portal session:', error);
    return res.status(500).json({ error: error.message });
  }
}
