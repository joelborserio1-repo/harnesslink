"use client";

import { useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { formatCents } from "@/lib/money";

/**
 * The custom Stripe gateway: the Payment Element, mounted with a PaymentIntent
 * client secret. On success the webhook credits the wallet server-side; here we
 * just confirm and poll the parent to refresh.
 */
export function StripeTopUp({
  clientSecret,
  publishableKey,
  amountCents,
  onSuccess,
  onCancel,
}: {
  clientSecret: string;
  publishableKey: string;
  amountCents: number;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripePromise = useMemo<Promise<Stripe | null>>(
    () => loadStripe(publishableKey),
    [publishableKey]
  );

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "night",
          variables: {
            colorPrimary: "#D4AF37",
            colorBackground: "#072A20",
            colorText: "#F5F2E9",
            borderRadius: "8px",
          },
        },
      }}
    >
      <CardForm amountCents={amountCents} onSuccess={onSuccess} onCancel={onCancel} />
    </Elements>
  );
}

function CardForm({
  amountCents,
  onSuccess,
  onCancel,
}: {
  amountCents: number;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      setError(error.message ?? "Payment failed");
      setBusy(false);
      return;
    }
    if (paymentIntent?.status === "succeeded") {
      // Webhook credits the wallet; give it a beat, then refresh.
      setTimeout(onSuccess, 1200);
    } else {
      setError(`Payment status: ${paymentIntent?.status}`);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={pay}>
      <p className="mb-4 text-sm text-cream/70">
        Adding{" "}
        <span className="font-heading font-bold text-gold">
          {formatCents(amountCents)}
        </span>{" "}
        to your wallet.
      </p>
      <PaymentElement />
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={onCancel} className="btn-ghost flex-1">
          Back
        </button>
        <button disabled={busy || !stripe} className="btn-gold flex-[2]">
          {busy ? "Processing…" : `Pay ${formatCents(amountCents)}`}
        </button>
      </div>
    </form>
  );
}
