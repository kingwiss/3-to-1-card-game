import Stripe from 'stripe';

// We MUST use process.env to prevent GitHub Secret Scanning from blocking the commit
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || 'price_1T6FxvG32OfZ6Beq7QAa48cs';

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
    const { email, userId, priceId } = req.body;

    if (!email || !userId) {
      return res.status(400).json({ error: 'Email and userId are required' });
    }

    // Use the provided price ID or default to the live price
    const stripePriceId = priceId || STRIPE_PRICE_ID;
    
    if (!stripePriceId) {
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

    // Create Checkout Session
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
      // Dynamic success/cancel URLs based on the request origin
      success_url: `${req.headers.origin}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/?canceled=true`,
      client_reference_id: userId,
    });

    return res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return res.status(500).json({ error: error.message });
  }
}
