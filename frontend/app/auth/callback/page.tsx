"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginWithGithubCode, setToken } from "@/lib/auth";
import { Loader2 } from "lucide-react";

function AuthCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const code = searchParams.get("code");
        if (!code) {
            setError("No code provided from GitHub");
            return;
        }

        const exchangeCode = async () => {
            try {
                const { token } = await loginWithGithubCode(code);
                setToken(token);
                // Redirect to home and refresh to update auth state
                router.push("/");
                window.location.href = "/";
            } catch (err) {
                setError(err instanceof Error ? err.message : "Authentication failed");
            }
        };

        exchangeCode();
    }, [searchParams, router]);

    if (error) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
                <h1 className="mb-4 text-2xl font-bold text-red-500">Authentication Error</h1>
                <p className="mb-6 text-[var(--muted)]">{error}</p>
                <button
                    onClick={() => router.push("/")}
                    className="rounded-md bg-[var(--primary)] px-4 py-2 font-medium text-white hover:opacity-90"
                >
                    Return to home
                </button>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4">
            <Loader2 className="mb-4 h-12 w-12 animate-spin text-[var(--primary)]" />
            <h1 className="text-xl font-semibold">Completing GitHub login...</h1>
            <p className="text-[var(--muted)]">Please wait while we finalize your session.</p>
        </div>
    );
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
            <AuthCallbackContent />
        </Suspense>
    );
}
