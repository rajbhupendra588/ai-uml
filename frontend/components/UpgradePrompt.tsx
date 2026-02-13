"use client";

import { AlertTriangle, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface UpgradePromptProps {
    variant?: "limit-reached" | "tokens-low" | "feature-locked";
    currentUsage?: number;
    limit?: number;
    feature?: string;
}

export function UpgradePrompt({
    variant = "limit-reached",
    currentUsage = 0,
    limit = 5,
    feature
}: UpgradePromptProps) {
    const getContent = () => {
        switch (variant) {
            case "limit-reached":
                return {
                    icon: <AlertTriangle className="h-4 w-4" />,
                    title: "Monthly Limit Reached",
                    description: `You've used ${currentUsage} of ${limit} diagrams this month. Upgrade to Pro for unlimited diagrams.`,
                    variant: "destructive" as const,
                };

            case "tokens-low":
                return {
                    icon: <AlertTriangle className="h-4 w-4" />,
                    title: "AI Tokens Running Low",
                    description: `You've used ${currentUsage.toLocaleString()} of ${limit.toLocaleString()} tokens. Upgrade to Pro for 500K tokens/month.`,
                    variant: "default" as const,
                };

            case "feature-locked":
                return {
                    icon: <Sparkles className="h-4 w-4" />,
                    title: "Pro Feature",
                    description: `${feature || "This feature"} is available on the Pro plan. Upgrade to unlock all premium features.`,
                    variant: "default" as const,
                };

            default:
                return {
                    icon: <Sparkles className="h-4 w-4" />,
                    title: "Upgrade to Pro",
                    description: "Get unlimited diagrams and advanced features.",
                    variant: "default" as const,
                };
        }
    };

    const content = getContent();

    return (
        <Alert variant={content.variant} className="my-4">
            {content.icon}
            <AlertTitle>{content.title}</AlertTitle>
            <AlertDescription className="flex items-center justify-between mt-2">
                <span>{content.description}</span>
                <Link href="/pricing">
                    <Button size="sm" className="ml-4">
                        Upgrade to Pro
                    </Button>
                </Link>
            </AlertDescription>
        </Alert>
    );
}
