// TODO: Stripe integration — Phase 5+
// Install: npm install stripe
// Env vars: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

import type { Plan } from '@/types'

export const STRIPE_PRICE_IDS: Record<Plan, string | null> = {
  starter: null, // free tier
  growth: process.env.STRIPE_PRICE_GROWTH ?? 'price_TODO_growth',
  scale: process.env.STRIPE_PRICE_SCALE ?? 'price_TODO_scale',
  enterprise: null, // contact sales
}

// TODO: replace stub with real Stripe client once package is installed
// import Stripe from 'stripe'
// export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function createCheckoutSession(
  brandId: string,
  plan: Plan,
  customerId?: string,
): Promise<{ url: string }> {
  void brandId; void plan; void customerId
  // TODO: implement real Stripe checkout
  return { url: '/settings?billing=upgrade' }
}

export async function createBillingPortalSession(
  customerId: string,
): Promise<{ url: string }> {
  void customerId
  // TODO: implement real Stripe billing portal
  return { url: '/settings?billing=manage' }
}

export async function handleWebhookEvent(payload: string, sig: string): Promise<void> {
  void payload; void sig
  // TODO: handle Stripe webhook events:
  // - checkout.session.completed → update subscription_status, plan
  // - invoice.payment_failed → update subscription_status to past_due
  // - customer.subscription.deleted → update subscription_status to canceled
}
