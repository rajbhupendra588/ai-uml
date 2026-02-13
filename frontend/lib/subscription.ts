import { getApiBaseUrl } from "./api";
import { getAuthHeaders } from "./auth";

// ── Types ────────────────────────────────────────────────────────────

export interface CreateSubscriptionResponse {
    subscription_id: string;
    status: string;
    plan_id: string;
    key_id: string;
    short_url?: string | null;
}

export interface VerifyPaymentResponse {
    status: "success" | "failure";
    message: string;
}

export type PlanType = "pro_monthly" | "pro_annual";

// ── Razorpay Script Loader ───────────────────────────────────────────

export const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

export const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
        if ((window as any).Razorpay) {
            resolve(true);
            return;
        }
        const script = document.createElement("script");
        script.src = RAZORPAY_SCRIPT_URL;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
};

// ── API calls ────────────────────────────────────────────────────────

const API_BASE_URL = getApiBaseUrl();

/**
 * Create a Razorpay subscription via backend.
 * Returns subscription_id + key_id for the Checkout modal.
 */
export async function createSubscription(planType: PlanType): Promise<CreateSubscriptionResponse> {
    const res = await fetch(`${API_BASE_URL}/api/v1/subscription/create`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
        },
        body: JSON.stringify({ plan_type: planType }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to create subscription. Please try again.");
    }

    return res.json();
}

/**
 * Verify the Razorpay payment signature after checkout.
 * This activates the subscription and records the payment.
 */
export async function verifyPayment(paymentData: {
    razorpay_payment_id: string;
    razorpay_subscription_id: string;
    razorpay_signature: string;
}): Promise<VerifyPaymentResponse> {
    const res = await fetch(`${API_BASE_URL}/api/v1/subscription/verify`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
        },
        body: JSON.stringify(paymentData),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Payment verification failed. Please contact support.");
    }

    return res.json();
}

/**
 * Cancel the active subscription.
 */
export async function cancelSubscription(): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/subscription/cancel`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
        },
        body: JSON.stringify({ cancel_at_period_end: true }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to cancel subscription.");
    }
}

/**
 * Get subscription status for current user.
 */
export async function getSubscriptionStatus(): Promise<any> {
    const headers = getAuthHeaders();
    if (!headers.Authorization) {
        throw new Error("Not authenticated");
    }
    const res = await fetch(`${API_BASE_URL}/api/v1/subscription/status`, {
        headers,
    });

    if (!res.ok) {
        throw new Error("Failed to fetch subscription status.");
    }

    return res.json();
}
