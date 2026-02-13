"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, Calendar, AlertCircle } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getSubscriptionStatus, cancelSubscription } from "@/lib/subscription";

interface SubscriptionStatus {
    has_subscription: boolean;
    subscription_id?: string;
    status?: string;
    plan_id?: string;
    current_period_start?: string;
    current_period_end?: string;
    cancel_at_period_end?: boolean;
    plan: string;
}

export default function BillingPage() {
    const { user, loading: authLoading } = useAuth();
    const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (authLoading !== false) return;
        const token = typeof window !== "undefined" ? localStorage.getItem("architectai_token") : null;
        if (!token) {
            setError("Please log in to view billing.");
            setLoading(false);
            return;
        }
        fetchSubscriptionStatus();
    }, [authLoading]);

    const fetchSubscriptionStatus = async () => {
        try {
            setLoading(true);
            const data = await getSubscriptionStatus();
            setSubscription(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    const handleCancelSubscription = async () => {
        if (!confirm("Are you sure you want to cancel your subscription? You'll keep Pro features until the end of your billing period.")) {
            return;
        }

        try {
            await cancelSubscription();
            await fetchSubscriptionStatus();
            alert("Subscription cancelled successfully. You'll retain Pro access until the end of your billing period.");
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to cancel subscription");
        }
    };

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-16 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto px-4 py-16">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-16 max-w-4xl">
            <h1 className="text-3xl font-bold mb-8">Billing & Subscription</h1>

            {/* Current Plan */}
            <Card className="mb-8">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Current Plan</CardTitle>
                            <CardDescription>Manage your subscription and billing</CardDescription>
                        </div>
                        <Badge variant={subscription?.plan === "pro" ? "default" : "secondary"} className="text-lg px-4 py-2">
                            {subscription?.plan === "pro" ? "Pro" : "Free"}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    {subscription?.has_subscription ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Calendar className="w-5 h-5 text-muted-foreground" />
                                <div>
                                    <p className="font-medium">Billing Period</p>
                                    <p className="text-sm text-muted-foreground">
                                        {new Date(subscription.current_period_start!).toLocaleDateString()} - {new Date(subscription.current_period_end!).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <CreditCard className="w-5 h-5 text-muted-foreground" />
                                <div>
                                    <p className="font-medium">Status</p>
                                    <p className="text-sm text-muted-foreground capitalize">{subscription.status}</p>
                                </div>
                            </div>

                            {subscription.cancel_at_period_end && (
                                <Alert>
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        Your subscription will be cancelled at the end of the current billing period.
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="pt-4">
                                <Button variant="destructive" onClick={handleCancelSubscription} disabled={subscription.cancel_at_period_end}>
                                    {subscription.cancel_at_period_end ? "Cancellation Scheduled" : "Cancel Subscription"}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <p className="text-muted-foreground mb-4">
                                You're currently on the Free plan. Upgrade to Pro for unlimited diagrams and advanced features.
                            </p>
                            <Button onClick={() => (window.location.href = "/pricing")}>
                                Upgrade to Pro
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Usage Stats */}
            <Card>
                <CardHeader>
                    <CardTitle>Usage This Month</CardTitle>
                    <CardDescription>Track your usage and limits</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between mb-2">
                                <span className="font-medium">Diagrams</span>
                                <span className="text-muted-foreground">
                                    {user?.diagrams_this_month || 0} / {subscription?.plan === "pro" ? "Unlimited" : "5"}
                                </span>
                            </div>
                            {subscription?.plan !== "pro" && (
                                <div className="w-full bg-secondary rounded-full h-2">
                                    <div
                                        className="bg-primary h-2 rounded-full transition-all"
                                        style={{ width: `${Math.min(((user?.diagrams_this_month || 0) / 5) * 100, 100)}%` }}
                                    />
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <span className="font-medium">AI Tokens</span>
                                <span className="text-muted-foreground">
                                    {(user?.tokens_used_this_month || 0).toLocaleString()} / {subscription?.plan === "pro" ? "500,000" : "10,000"}
                                </span>
                            </div>
                            <div className="w-full bg-secondary rounded-full h-2">
                                <div
                                    className="bg-primary h-2 rounded-full transition-all"
                                    style={{
                                        width: `${Math.min(
                                            ((user?.tokens_used_this_month || 0) / (subscription?.plan === "pro" ? 500000 : 10000)) * 100,
                                            100
                                        )}%`,
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
