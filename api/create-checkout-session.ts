import Stripe from 'stripe';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) {
    console.error('Missing STRIPE_SECRET_KEY environment variable in Vercel');
    return res.status(500).json({ error: 'Stripe Secret Key is not configured in Vercel Environment Variables.' });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY);

  try {
    const { email, userId, priceId } = req.body;

    if (!email || !userId) {
      return res.status(400).json({ error: 'Email and userId are required' });
    }

    // Use the provided price ID or default to the live price from Vercel env
    const stripePriceId = priceId || process.env.STRIPE_PRICE_ID;
    
    if (!stripePriceId) {
      console.error('Missing STRIPE_PRICE_ID environment variable in Vercel');
      return res.status(500).json({ error: 'Stripe Price ID is not configured in Vercel Environment Variables.' });
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
    // mode: 'subscription' ensures they are charged monthly automatically
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
