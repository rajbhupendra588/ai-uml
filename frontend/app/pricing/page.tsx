"use client";

import { useAuth } from "@/components/AuthProvider";
import {
    loadRazorpayScript,
    createSubscription,
    verifyPayment,
    PlanType,
} from "@/lib/subscription";
import { useRouter } from "next/navigation";
import { useState, useCallback, useRef, useEffect } from "react";
import {
    Loader2,
    Check,
    Sparkles,
    Shield,
    Zap,
    Crown,
    X,
    PartyPopper,
    ArrowLeft,
    ArrowRight,
    Infinity,
    Palette,
    Download,
    Headphones,
    Wand2,
    Image as ImageIcon,
    ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

/* ─────────────────────────── Types ─────────────────────────── */

interface RazorpayOptions {
    key: string;
    subscription_id: string;
    name: string;
    description: string;
    handler: (response: any) => void;
    prefill?: { email?: string; name?: string };
    modal: { ondismiss: () => void };
    theme: { color: string };
}

declare global {
    interface Window {
        Razorpay: new (options: RazorpayOptions) => { open: () => void };
    }
}

type CheckoutState =
    | "idle"
    | "creating"
    | "checkout"
    | "verifying"
    | "success"
    | "error";

/* ─────────────────────────── Styles ─────────────────────────── */

const styles = `
  @keyframes float-orb {
    0%, 100% { transform: translate(0, 0) scale(1); }
    25% { transform: translate(30px, -40px) scale(1.05); }
    50% { transform: translate(-20px, -60px) scale(0.95); }
    75% { transform: translate(40px, -20px) scale(1.02); }
  }

  @keyframes glow-pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  @keyframes border-rotate {
    0% { --angle: 0deg; }
    100% { --angle: 360deg; }
  }

  @keyframes fade-up {
    from { opacity: 0; transform: translateY(24px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  @keyframes scale-in {
    from { opacity: 0; transform: scale(0.92); }
    to { opacity: 1; transform: scale(1); }
  }

  .pricing-hero { animation: fade-up 0.6s ease-out both; }
  .pricing-card-free { animation: fade-up 0.6s ease-out 0.15s both; }
  .pricing-card-pro { animation: fade-up 0.6s ease-out 0.25s both; }
  .pricing-compare { animation: fade-up 0.6s ease-out 0.35s both; }
  .pricing-faq { animation: fade-up 0.6s ease-out 0.45s both; }

  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    pointer-events: none;
    animation: float-orb 12s ease-in-out infinite;
  }

  .pro-card-glow {
    position: relative;
  }
  .pro-card-glow::before {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: 1.25rem;
    padding: 1.5px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6, #c084fc, #6366f1);
    background-size: 300% 300%;
    animation: shimmer 4s linear infinite;
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    z-index: 0;
  }

  .pro-upgrade-btn {
    position: relative;
    overflow: hidden;
  }
  .pro-upgrade-btn::after {
    content: '';
    position: absolute;
    top: 0; left: -100%; width: 100%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
    transition: left 0.5s ease;
  }
  .pro-upgrade-btn:hover::after {
    left: 100%;
  }

  .faq-answer {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease, padding 0.3s ease, opacity 0.3s ease;
    opacity: 0;
  }
  .faq-answer.open {
    max-height: 200px;
    opacity: 1;
  }

  .feature-row {
    transition: background-color 0.2s ease;
  }
  .feature-row:hover {
    background-color: rgba(99, 102, 241, 0.04);
  }
  [data-theme="dark"] .feature-row:hover,
  :root:not([data-theme="light"]) .feature-row:hover {
    background-color: rgba(99, 102, 241, 0.06);
  }
`;

/* ─────────────────────── Confetti ────────────────────────── */

function ConfettiCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const colors = ["#6366f1", "#818cf8", "#a78bfa", "#c084fc", "#f472b6", "#fb923c", "#facc15", "#34d399", "#22d3ee", "#60a5fa"];
        interface P { x: number; y: number; w: number; h: number; color: string; vx: number; vy: number; r: number; rs: number; o: number; }
        const ps: P[] = Array.from({ length: 150 }, () => ({
            x: Math.random() * canvas.width, y: Math.random() * canvas.height - canvas.height,
            w: Math.random() * 10 + 5, h: Math.random() * 6 + 3,
            color: colors[Math.floor(Math.random() * colors.length)],
            vx: (Math.random() - 0.5) * 4, vy: Math.random() * 3 + 2,
            r: Math.random() * 360, rs: (Math.random() - 0.5) * 10, o: 1
        }));
        let id: number, f = 0;
        function animate() {
            if (!ctx || !canvas) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height); f++;
            ps.forEach(p => {
                p.x += p.vx; p.y += p.vy; p.vy += 0.03; p.r += p.rs; if (f > 100) p.o -= 0.01;
                ctx.save(); ctx.globalAlpha = Math.max(0, p.o); ctx.translate(p.x, p.y);
                ctx.rotate(p.r * Math.PI / 180); ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
            });
            if (ps.every(p => p.o <= 0)) { cancelAnimationFrame(id); return; }
            id = requestAnimationFrame(animate);
        }
        id = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(id);
    }, []);
    return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ width: "100vw", height: "100vh", zIndex: 100 }} />;
}

/* ──────────────────── Checkout Overlay ───────────────────── */

function CheckoutOverlay({ state, errorMessage, onClose, onRetry }: {
    state: CheckoutState; errorMessage: string; onClose: () => void; onRetry: () => void;
}) {
    if (state === "idle" || state === "checkout") return null;
    return (
        <>
            {state === "success" && <ConfettiCanvas />}
            <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 90, backgroundColor: "rgba(15,23,42,0.85)", backdropFilter: "blur(8px)" }}>
                <div className="relative mx-4 w-full max-w-md rounded-2xl p-8" style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5), 0 0 40px -8px rgba(99,102,241,0.15)", animation: "scale-in 0.3s ease-out" }}>
                    {state === "creating" && (
                        <div className="text-center">
                            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: "rgba(99,102,241,0.15)" }}>
                                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--primary)" }} />
                            </div>
                            <h3 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>Setting up your payment...</h3>
                            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>Connecting securely to Razorpay.</p>
                        </div>
                    )}
                    {state === "verifying" && (
                        <div className="text-center">
                            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: "rgba(245,158,11,0.15)" }}>
                                <Shield className="h-8 w-8 animate-pulse" style={{ color: "#f59e0b" }} />
                            </div>
                            <h3 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>Verifying your payment...</h3>
                            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>Securely confirming your transaction. Please don&apos;t close this window.</p>
                            <div className="mt-5 flex justify-center gap-1.5">
                                {[0, 1, 2].map(i => <div key={i} className="h-2 w-2 rounded-full animate-bounce" style={{ backgroundColor: "var(--primary)", animationDelay: `${i * 150}ms` }} />)}
                            </div>
                        </div>
                    )}
                    {state === "success" && (
                        <div className="text-center">
                            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: "rgba(34,197,94,0.15)" }}>
                                <PartyPopper className="h-8 w-8" style={{ color: "#22c55e" }} />
                            </div>
                            <h3 className="text-2xl font-bold" style={{ background: "linear-gradient(135deg,#6366f1,#a78bfa,#c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Welcome to Pro! 🎉</h3>
                            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>Your subscription is now active. Enjoy unlimited diagrams!</p>
                            <button onClick={onClose} className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-all hover:opacity-90" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", boxShadow: "0 4px 20px rgba(99,102,241,0.35)" }}>
                                <Sparkles className="h-4 w-4" />Go to Dashboard
                            </button>
                        </div>
                    )}
                    {state === "error" && (
                        <div className="text-center">
                            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: "rgba(239,68,68,0.15)" }}>
                                <X className="h-8 w-8" style={{ color: "#ef4444" }} />
                            </div>
                            <h3 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>Something went wrong</h3>
                            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>{errorMessage || "An unexpected error occurred."}</p>
                            <div className="mt-6 flex gap-3">
                                <button onClick={onClose} className="flex-1 rounded-xl px-4 py-3 text-sm font-medium transition-all hover:opacity-80" style={{ background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}>Cancel</button>
                                <button onClick={onRetry} className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all hover:opacity-90" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>Try Again</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

/* ──────────────────── FAQ Item ────────────────────────── */

function FAQItem({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false);
    return (
        <button
            onClick={() => setOpen(!open)}
            className="w-full text-left rounded-xl p-5 transition-all duration-200"
            style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                boxShadow: open ? "0 4px 20px rgba(0,0,0,0.08)" : "none",
            }}
        >
            <div className="flex items-center justify-between gap-4">
                <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{q}</h3>
                <ChevronDown
                    className="h-4 w-4 flex-shrink-0 transition-transform duration-200"
                    style={{ color: "var(--muted)", transform: open ? "rotate(180deg)" : "rotate(0)" }}
                />
            </div>
            <div className={`faq-answer ${open ? "open" : ""}`}>
                <p className="text-sm leading-relaxed pt-3" style={{ color: "var(--muted)" }}>{a}</p>
            </div>
        </button>
    );
}

/* ──────────────────── Feature Data ───────────────────── */

const freeFeatures = [
    { icon: Zap, text: "5 diagrams per month" },
    { icon: Wand2, text: "10,000 AI tokens" },
    { icon: Check, text: "All diagram types" },
    { icon: Palette, text: "Basic themes" },
    { icon: ImageIcon, text: "Watermarked exports" },
];
const proFeatures = [
    { icon: Infinity, text: "Unlimited diagrams" },
    { icon: Wand2, text: "500K AI tokens" },
    { icon: Check, text: "All diagram types" },
    { icon: Palette, text: "Premium themes & styles" },
    { icon: Download, text: "PNG, SVG, PDF — no watermarks" },
    { icon: Headphones, text: "Priority support" },
    { icon: Sparkles, text: "Advanced customization" },
];

const comparisonRows = [
    { feature: "Monthly Diagrams", free: "5", pro: "Unlimited", highlight: true },
    { feature: "AI Tokens / month", free: "10K", pro: "500K", highlight: true },
    { feature: "Diagram Types", free: "All", pro: "All", highlight: false },
    { feature: "Themes", free: "Basic", pro: "Premium", highlight: false },
    { feature: "Watermark-free Export", free: false, pro: true, highlight: false },
    { feature: "PNG / SVG / PDF Export", free: "PNG only", pro: "All formats", highlight: false },
    { feature: "Priority Support", free: false, pro: true, highlight: false },
    { feature: "Advanced Customization", free: false, pro: true, highlight: false },
];

const faqData = [
    { q: "Can I upgrade or downgrade anytime?", a: "Yes! You can upgrade to Pro anytime. If you downgrade, you'll keep Pro features until the end of your billing period." },
    { q: "What payment methods do you accept?", a: "We accept all major credit/debit cards, UPI, net banking, and digital wallets through Razorpay." },
    { q: "What happens when I hit my limits?", a: "Free users are limited to 5 diagrams and 10K tokens per month. Upgrade to Pro for unlimited access." },
    { q: "Is there a refund policy?", a: "Yes — if you're not satisfied within 7 days, contact us for a full refund. No questions asked." },
];

/* ─────────────────────────── Main ─────────────────────────── */

export default function PricingPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [checkoutState, setCheckoutState] = useState<CheckoutState>("idle");
    const [errorMessage, setErrorMessage] = useState("");
    const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
    const lastPlanRef = useRef<PlanType | null>(null);
    const isPro = user?.plan === "pro";

    const resetState = useCallback(() => { setCheckoutState("idle"); setErrorMessage(""); }, []);

    const handleUpgrade = useCallback(async (planType: PlanType) => {
        if (!user) { toast.error("Please log in to upgrade."); router.push("/login?redirect=/pricing"); return; }
        lastPlanRef.current = planType;
        try {
            setCheckoutState("creating"); setErrorMessage("");
            const isLoaded = await loadRazorpayScript();
            if (!isLoaded) throw new Error("Could not load payment gateway.");
            const data = await createSubscription(planType);
            setCheckoutState("checkout");
            const options: RazorpayOptions = {
                key: data.key_id, subscription_id: data.subscription_id,
                name: "ArchitectAI",
                description: `Pro Plan — ${billingInterval === "annual" ? "Annual" : "Monthly"}`,
                prefill: { email: user.email, name: user.username || undefined },
                handler: async function (response: any) {
                    setCheckoutState("verifying");
                    try {
                        await verifyPayment({ razorpay_payment_id: response.razorpay_payment_id, razorpay_subscription_id: response.razorpay_subscription_id, razorpay_signature: response.razorpay_signature });
                        setCheckoutState("success");
                    } catch (e: any) { setErrorMessage(e.message || "Verification failed."); setCheckoutState("error"); }
                },
                modal: { ondismiss: () => resetState() },
                theme: { color: "#6366f1" },
            };
            new window.Razorpay(options).open();
        } catch (err: any) { setErrorMessage(err.message || "Something went wrong."); setCheckoutState("error"); }
    }, [user, billingInterval, router, resetState]);

    const handleRetry = useCallback(() => { if (lastPlanRef.current) handleUpgrade(lastPlanRef.current); else resetState(); }, [handleUpgrade, resetState]);
    const handleSuccessClose = useCallback(() => { resetState(); router.push("/dashboard"); }, [resetState, router]);

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: styles }} />

            <CheckoutOverlay
                state={checkoutState} errorMessage={errorMessage}
                onClose={checkoutState === "success" ? handleSuccessClose : resetState}
                onRetry={handleRetry}
            />

            <div className="h-[100dvh] w-full overflow-y-auto relative" style={{ background: "var(--background)", color: "var(--foreground)" }}>

                {/* ── Floating Orbs ── */}
                <div className="orb" style={{ width: 500, height: 500, top: "-10%", left: "-8%", background: "rgba(99,102,241,0.08)", animationDuration: "14s" }} />
                <div className="orb" style={{ width: 400, height: 400, top: "5%", right: "-5%", background: "rgba(139,92,246,0.06)", animationDelay: "2s", animationDuration: "16s" }} />
                <div className="orb" style={{ width: 350, height: 350, bottom: "10%", left: "15%", background: "rgba(99,102,241,0.05)", animationDelay: "4s", animationDuration: "18s" }} />

                {/* ── Back ── */}
                <div className="relative max-w-6xl mx-auto px-6 pt-6">
                    <Link href="/" className="inline-flex items-center gap-2 text-sm transition-all hover:gap-3" style={{ color: "var(--muted)" }}>
                        <ArrowLeft className="h-4 w-4" />Back to App
                    </Link>
                </div>

                {/* ── Hero ── */}
                <div className="pricing-hero relative text-center pt-14 pb-2 px-6">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full text-xs font-semibold tracking-wide uppercase" style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.15)" }}>
                        <Sparkles className="h-3.5 w-3.5" />Pricing
                    </div>
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-4" style={{ lineHeight: 1.1 }}>
                        <span style={{ color: "var(--foreground)" }}>Power up with </span>
                        <span style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 40%, #c084fc 70%, #e879f9 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                            Pro
                        </span>
                    </h1>
                    <p className="text-base sm:text-lg max-w-lg mx-auto" style={{ color: "var(--muted)" }}>
                        Unlock unlimited diagrams, premium exports, and 50× more AI tokens.
                    </p>

                    {/* ── Toggle ── */}
                    <div className="flex items-center justify-center gap-4 mt-10">
                        <span className="text-sm font-medium" style={{ color: billingInterval === "monthly" ? "var(--foreground)" : "var(--muted)" }}>Monthly</span>
                        <button
                            onClick={() => setBillingInterval(p => p === "monthly" ? "annual" : "monthly")}
                            className="relative inline-flex h-7 w-12 items-center rounded-full transition-all focus:outline-none"
                            style={{
                                background: billingInterval === "annual" ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "var(--secondary)",
                                boxShadow: billingInterval === "annual" ? "0 0 16px rgba(99,102,241,0.4)" : "inset 0 1px 3px rgba(0,0,0,0.1)",
                            }}
                        >
                            <span className="inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform" style={{ transform: billingInterval === "annual" ? "translateX(22px)" : "translateX(4px)" }} />
                        </button>
                        <span className="text-sm font-medium flex items-center gap-2" style={{ color: billingInterval === "annual" ? "var(--foreground)" : "var(--muted)" }}>
                            Annual

                        </span>
                    </div>
                </div>

                {/* ── Cards ── */}
                <div className="relative max-w-5xl mx-auto px-6 pt-10 pb-6 grid md:grid-cols-2 gap-6 items-start">

                    {/* Free */}
                    <div className="pricing-card-free rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1" style={{
                        background: "var(--card)", border: "1px solid var(--border)",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04)",
                    }}>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "var(--secondary)" }}>
                                <Zap className="h-5 w-5" style={{ color: "var(--muted)" }} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>Free</h2>
                                <p className="text-xs" style={{ color: "var(--muted)" }}>For getting started</p>
                            </div>
                        </div>

                        <div className="flex items-baseline gap-1 mt-5 mb-6">
                            <span className="text-5xl font-extrabold tracking-tight" style={{ color: "var(--foreground)" }}>₹0</span>
                            <span className="text-sm font-medium" style={{ color: "var(--muted)" }}>/ forever</span>
                        </div>

                        <button disabled className="w-full rounded-xl px-5 py-3.5 text-sm font-semibold mb-7 cursor-not-allowed transition-all" style={{ background: "var(--secondary)", color: "var(--muted)", border: "1px solid var(--border)" }}>
                            {isPro ? "Free Plan" : "Current Plan"}
                        </button>

                        <div className="space-y-3.5">
                            {freeFeatures.map((f, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--secondary)" }}>
                                        <f.icon className="h-3.5 w-3.5" style={{ color: "var(--muted)" }} />
                                    </div>
                                    <span className="text-sm" style={{ color: "var(--muted)" }}>{f.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Pro */}
                    <div className="pricing-card-pro pro-card-glow rounded-[1.25rem] p-7 transition-all duration-300 hover:-translate-y-1" style={{
                        background: "var(--card)",
                        boxShadow: "0 4px 24px rgba(99,102,241,0.08), 0 16px 48px rgba(0,0,0,0.12)",
                    }}>
                        {/* Popular badge */}
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                            <div className="rounded-full px-4 py-1 text-xs font-bold text-white flex items-center gap-1.5" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a78bfa)", boxShadow: "0 4px 16px rgba(99,102,241,0.4)" }}>
                                <Crown className="h-3 w-3" />MOST POPULAR
                            </div>
                        </div>

                        <div className="flex items-center gap-3 mb-1 relative z-[1]">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "rgba(99,102,241,0.12)" }}>
                                <Crown className="h-5 w-5" style={{ color: "#818cf8" }} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>Pro</h2>
                                <p className="text-xs" style={{ color: "var(--muted)" }}>For professionals & teams</p>
                            </div>
                        </div>

                        <div className="relative z-[1] mt-5 mb-1">
                            <div className="flex items-baseline gap-1">
                                <span className="text-5xl font-extrabold tracking-tight" style={{ color: "var(--foreground)" }}>
                                    ₹1
                                </span>
                                <span className="text-sm font-medium" style={{ color: "var(--muted)" }}>/ month</span>
                            </div>
                            {billingInterval === "annual" ? (
                                <p className="text-xs mt-1 mb-5" style={{ color: "var(--muted)" }}>
                                    Billed as ₹12/year
                                </p>
                            ) : (
                                <p className="text-xs mt-1 mb-5" style={{ color: "var(--muted)" }}>
                                    Billed monthly
                                </p>
                            )}
                        </div>

                        <button
                            onClick={() => handleUpgrade(billingInterval === "annual" ? "pro_annual" : "pro_monthly")}
                            disabled={isPro || checkoutState !== "idle" || authLoading}
                            className="pro-upgrade-btn relative z-[1] w-full rounded-xl px-5 py-3.5 text-sm font-bold text-white mb-7 transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)", boxShadow: "0 4px 24px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.1)" }}
                        >
                            {isPro ? (<><Check className="h-4 w-4" />Current Plan</>) : (<><Crown className="h-4 w-4" />Upgrade to Pro<ArrowRight className="h-4 w-4" /></>)}
                        </button>

                        <div className="relative z-[1] space-y-3.5">
                            {proFeatures.map((f, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: "rgba(99,102,241,0.1)" }}>
                                        <f.icon className="h-3.5 w-3.5" style={{ color: "#818cf8" }} />
                                    </div>
                                    <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{f.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Trust ── */}
                <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 py-8 text-sm" style={{ color: "var(--muted)" }}>
                    {[
                        { icon: Shield, text: "Secure via Razorpay", color: "#22c55e" },
                        { icon: Check, text: "Cancel anytime", color: "#22c55e" },
                        { icon: Sparkles, text: "7-day money-back", color: "#22c55e" },
                    ].map((t, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <t.icon className="h-4 w-4" style={{ color: t.color }} />
                            <span>{t.text}</span>
                        </div>
                    ))}
                </div>

                {/* ── Compare ── */}
                <div className="pricing-compare max-w-3xl mx-auto px-6 pb-8">
                    <h2 className="text-2xl font-bold text-center mb-2" style={{ color: "var(--foreground)" }}>Compare Plans</h2>
                    <p className="text-sm text-center mb-8" style={{ color: "var(--muted)" }}>See exactly what you get with each plan</p>

                    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                        {/* Header */}
                        <div className="grid grid-cols-3 px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ borderBottom: "1px solid var(--border)", background: "rgba(99,102,241,0.04)" }}>
                            <span style={{ color: "var(--muted)" }}>Feature</span>
                            <span className="text-center" style={{ color: "var(--muted)" }}>Free</span>
                            <span className="text-center" style={{ color: "#818cf8" }}>Pro ✨</span>
                        </div>
                        {comparisonRows.map((row, i) => (
                            <div key={i} className="feature-row grid grid-cols-3 px-5 py-3.5 text-sm" style={{ borderBottom: i < comparisonRows.length - 1 ? "1px solid var(--border)" : "none" }}>
                                <span className="font-medium" style={{ color: "var(--foreground)" }}>{row.feature}</span>
                                <span className="text-center" style={{ color: "var(--muted)" }}>
                                    {row.free === true ? <Check className="h-4 w-4 mx-auto" style={{ color: "#22c55e" }} /> : row.free === false ? <span style={{ opacity: 0.3 }}>—</span> : row.free}
                                </span>
                                <span className="text-center font-medium" style={{ color: row.highlight ? "#818cf8" : "var(--foreground)" }}>
                                    {row.pro === true ? <Check className="h-4 w-4 mx-auto" style={{ color: "#22c55e" }} /> : row.pro === false ? "—" : row.pro}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── FAQ ── */}
                <div className="pricing-faq max-w-3xl mx-auto px-6 pb-20">
                    <h2 className="text-2xl font-bold text-center mb-2" style={{ color: "var(--foreground)" }}>Questions?</h2>
                    <p className="text-sm text-center mb-8" style={{ color: "var(--muted)" }}>Everything you need to know</p>
                    <div className="space-y-3">
                        {faqData.map((item, i) => <FAQItem key={i} {...item} />)}
                    </div>
                </div>
            </div>
        </>
    );
}
