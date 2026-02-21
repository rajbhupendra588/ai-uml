"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    User,
    BarChart3,
    FileCode2,
    Settings,
    CreditCard,
    ChevronRight,
    TrendingUp,
    Calendar,
    Clock,
    Zap,
    Crown,
    LogOut,
    ArrowLeft,
    Edit3,
    Trash2,
    Lock,
    Mail,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Coins,
    ExternalLink,
} from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
import { cn } from "@/lib/utils";
import {
    fetchDashboardOverview,
    updateProfile,
    updatePassword,
    deleteAccount,
    PLAN_INFO,
    type DashboardOverview,
} from "@/lib/dashboard";
import { type PlanType, getPayments, type PaymentTransaction, getSubscriptionStatus, cancelSubscription } from "@/lib/subscription";
import { clearToken, getToken, getAuthHeaders } from "@/lib/auth";
import { getDiagramUrl } from "@/lib/api";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Tab = "overview" | "diagrams" | "settings" | "billing";

export default function DashboardPage() {
    return (
        <Suspense
            fallback={
                <div className="flex h-screen items-center justify-center bg-[var(--background)]">
                    <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
                </div>
            }
        >
            <DashboardContent />
        </Suspense>
    );
}

function DashboardContent() {
    const searchParams = useSearchParams();
    const tabFromUrl = searchParams.get("tab") as Tab | null;
    const [activeTab, setActiveTab] = useState<Tab>(tabFromUrl || "overview");
    const [data, setData] = useState<DashboardOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Update tab when URL changes
    useEffect(() => {
        if (
            tabFromUrl &&
            ["overview", "diagrams", "settings", "billing"].includes(tabFromUrl)
        ) {
            setActiveTab(tabFromUrl);
        }
    }, [tabFromUrl]);

    useEffect(() => {
        const token = getToken();
        if (!token) {
            window.location.href = "/";
            return;
        }

        fetchDashboardOverview()
            .then((d) => {
                if (!d) {
                    setError("Please log in to view your dashboard");
                    return;
                }
                setData(d);
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[var(--background)]">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[var(--background)] text-[var(--foreground)]">
                <AlertCircle className="h-12 w-12 text-red-400" />
                <p className="text-lg">{error || "Failed to load dashboard"}</p>
                <Link
                    href="/editor"
                    className="flex items-center gap-2 text-[var(--primary)] hover:opacity-80"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Home
                </Link>
            </div>
        );
    }

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: "overview", label: "Overview", icon: <BarChart3 className="h-4 w-4" /> },
        { id: "diagrams", label: "My Diagrams", icon: <FileCode2 className="h-4 w-4" /> },
        { id: "settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
        { id: "billing", label: "Billing", icon: <CreditCard className="h-4 w-4" /> },
    ];

    return (
        <div className="fixed inset-0 flex bg-[var(--background)] overflow-hidden" style={{ height: "100dvh" }}>
            {/* Sidebar */}
            <aside className="flex w-[240px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--card)] overflow-hidden">
                {/* Logo */}
                <div className="flex h-14 items-center border-b border-[var(--border)] px-4 shrink-0">
                    <AppLogo href="/" />
                </div>

                {/* User Info */}
                <div className="border-b border-[var(--border)] p-3 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[var(--primary)] to-purple-600 text-white text-sm font-semibold">
                            {data.user.username?.[0]?.toUpperCase() ||
                                data.user.email[0].toUpperCase()}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="truncate text-sm font-medium text-[var(--foreground)]">
                                {data.user.username || data.user.email.split("@")[0]}
                            </p>
                            <p className="truncate text-xs text-[var(--muted)]">
                                {data.user.email}
                            </p>
                        </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                        <span
                            className={cn(
                                "rounded-full px-2 py-0.5 text-xs font-medium",
                                data.user.plan === "pro"
                                    ? "bg-[var(--primary)]/20 text-[var(--primary)]"
                                    : data.user.plan === "team"
                                        ? "bg-violet-500/20 text-violet-400"
                                        : "bg-[var(--secondary)] text-[var(--muted)]"
                            )}
                        >
                            {PLAN_INFO[data.user.plan]?.name || "Free"}
                        </span>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                                activeTab === tab.id
                                    ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                                    : "text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
                            )}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </nav>

                {/* Bottom Actions */}
                <div className="border-t border-[var(--border)] p-3 space-y-1 shrink-0">
                    <Link
                        href="/editor"
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] transition-all"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to App
                    </Link>
                    <button
                        onClick={() => {
                            clearToken();
                            window.location.href = "/";
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all"
                    >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content - scrollable area; use div to avoid global main styles */}
            <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden" role="main">
                <div
                    className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6"
                    style={{ WebkitOverflowScrolling: "touch" }}
                >
                    <div className="max-w-6xl mx-auto w-full pb-12">
                        {activeTab === "overview" && <OverviewTab data={data} />}
                        {activeTab === "diagrams" && (
                            <DiagramsTab diagrams={data.recent_diagrams} />
                        )}
                        {activeTab === "settings" && (
                            <SettingsTab user={data.user} onUpdate={setData} />
                        )}
                        {activeTab === "billing" && (
                            <BillingTab user={data.user} stats={data.stats} onUpdate={setData} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- Format number helper ---
function formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
}

// --- Overview Tab ---
function OverviewTab({ data }: { data: DashboardOverview }) {
    const { stats, user, recent_diagrams } = data;
    const isProOrAnnual = user.plan === "pro" || user.plan === "pro_annual";

    const statCards = [
        {
            label: "Diagrams This Month",
            value: stats.diagrams_this_month,
            subtext: isProOrAnnual ? "Unlimited" : `of ${stats.plan_limit} limit`,
            icon: <Calendar className="h-5 w-5" />,
            color: "primary",
        },
        {
            label: "Total Diagrams",
            value: stats.diagrams_total,
            icon: <FileCode2 className="h-5 w-5" />,
            color: "violet",
        },
        {
            label: "Tokens Used",
            value: formatNumber(stats.tokens_used_this_month || 0),
            subtext: `of ${formatNumber(stats.token_limit || 50000)} limit`,
            icon: <Coins className="h-5 w-5" />,
            color: "amber",
        },
        {
            label: "Member Since",
            value: user.created_at
                ? new Date(user.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                })
                : "N/A",
            icon: <Clock className="h-5 w-5" />,
            color: "emerald",
        },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-[var(--foreground)]">Dashboard</h1>
                <p className="mt-1 text-[var(--muted)]">
                    Welcome back, {user.username || user.email.split("@")[0]}!
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {statCards.map((card, i) => (
                    <div
                        key={i}
                        className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-[var(--muted)]">
                                {card.label}
                            </span>
                            <div
                                className={cn(
                                    "flex h-8 w-8 items-center justify-center rounded-lg",
                                    card.color === "primary" &&
                                    "bg-[var(--primary)]/20 text-[var(--primary)]",
                                    card.color === "violet" && "bg-violet-500/20 text-violet-400",
                                    card.color === "emerald" && "bg-emerald-500/20 text-emerald-400",
                                    card.color === "amber" && "bg-amber-500/20 text-amber-400"
                                )}
                            >
                                {card.icon}
                            </div>
                        </div>
                        <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">
                            {card.value}
                        </p>
                        {card.subtext && (
                            <p className="text-xs text-[var(--muted)]">{card.subtext}</p>
                        )}
                    </div>
                ))}
            </div>

            {/* Usage Progress Bars */}
            <div className="grid gap-4 lg:grid-cols-2">
                {/* Diagram Usage */}
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-[var(--foreground)]">
                            Monthly Diagram Usage
                        </h3>
                        <span className="text-xs text-[var(--muted)]">
                            {stats.diagrams_this_month} / {isProOrAnnual ? "Unlimited" : stats.plan_limit}
                        </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--secondary)]">
                        <div
                            className={cn(
                                "h-full rounded-full transition-all duration-500",
                                stats.plan_used_percent > 80
                                    ? "bg-gradient-to-r from-red-500 to-orange-500"
                                    : "bg-gradient-to-r from-[var(--primary)] to-purple-500"
                            )}
                            style={{ width: `${Math.min(100, stats.plan_used_percent)}%` }}
                        />
                    </div>
                    {stats.plan_used_percent > 80 && (
                        <p className="mt-2 text-xs text-amber-400">
                            ⚠️ Approaching monthly limit
                        </p>
                    )}
                </div>

                {/* Token Usage */}
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-[var(--foreground)]">
                            Monthly Token Usage
                        </h3>
                        <span className="text-xs text-[var(--muted)]">
                            {formatNumber(stats.tokens_used_this_month || 0)} /{" "}
                            {formatNumber(stats.token_limit || 50000)}
                        </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--secondary)]">
                        <div
                            className={cn(
                                "h-full rounded-full transition-all duration-500",
                                (stats.token_used_percent || 0) > 80
                                    ? "bg-gradient-to-r from-red-500 to-orange-500"
                                    : "bg-gradient-to-r from-amber-500 to-orange-400"
                            )}
                            style={{ width: `${Math.min(100, stats.token_used_percent || 0)}%` }}
                        />
                    </div>
                    <p className="mt-2 text-xs text-[var(--muted)]">
                        Total tokens used: {formatNumber(stats.tokens_used_total || 0)}
                    </p>
                </div>
            </div>

            {/* Diagram Types Breakdown */}
            {Object.keys(stats.diagrams_by_type || {}).length > 0 && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
                    <h3 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
                        Diagrams by Type
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {Object.entries(stats.diagrams_by_type).map(([type, count]) => (
                            <div
                                key={type}
                                className="flex items-center justify-between rounded-lg bg-[var(--secondary)] p-3"
                            >
                                <span className="text-sm font-medium capitalize text-[var(--foreground)]">
                                    {type.replace("_", " ")}
                                </span>
                                <span className="text-sm font-bold text-[var(--primary)]">
                                    {count}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent Diagrams */}
            {recent_diagrams.length > 0 && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-[var(--foreground)]">
                            Recent Diagrams
                        </h3>
                        <button
                            onClick={() => { }}
                            className="text-xs text-[var(--primary)] hover:opacity-80 flex items-center gap-1"
                        >
                            View All <ChevronRight className="h-3 w-3" />
                        </button>
                    </div>
                    <div className="space-y-2">
                        {recent_diagrams.slice(0, 5).map((diagram) => (
                            <Link
                                key={diagram.id}
                                href={`/editor?diagram=${diagram.id}`}
                                className="flex items-center justify-between rounded-lg bg-[var(--secondary)] p-3 hover:bg-[var(--accent)] transition-colors cursor-pointer group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)]/20">
                                        <FileCode2 className="h-4 w-4 text-[var(--primary)]" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">
                                            {diagram.title}
                                        </p>
                                        <p className="text-xs text-[var(--muted)]">
                                            {diagram.diagram_type || "Unknown"} •{" "}
                                            {diagram.updated_at
                                                ? new Date(diagram.updated_at).toLocaleDateString()
                                                : "N/A"}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 text-[var(--muted)] group-hover:text-[var(--primary)] transition-colors">
                                    <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity">Open</span>
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Diagrams Tab ---
function DiagramsTab({
    diagrams: initialDiagrams,
}: {
    diagrams: DashboardOverview["recent_diagrams"];
}) {
    const router = useRouter();
    const [diagrams, setDiagrams] = useState(initialDiagrams);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const handleOpen = (id: number) => {
        router.push(`/editor?diagram=${id}`);
    };

    const handleDelete = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (!confirm("Delete this diagram? This cannot be undone.")) return;
        setDeletingId(id);
        try {
            const res = await fetch(getDiagramUrl(id), {
                method: "DELETE",
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error("Delete failed");
            setDiagrams((prev) => prev.filter((d) => d.id !== id));
            toast.success("Diagram deleted");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Delete failed");
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-[var(--foreground)]">My Diagrams</h1>
                <Link
                    href="/editor"
                    className="flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-colors"
                >
                    <Zap className="h-4 w-4" />
                    Create New
                </Link>
            </div>

            {diagrams.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-12 text-center">
                    <FileCode2 className="h-12 w-12 text-[var(--muted)] mb-4" />
                    <p className="text-lg font-medium text-[var(--foreground)]">
                        No diagrams yet
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                        Create your first diagram to see it here
                    </p>
                    <Link
                        href="/editor"
                        className="mt-6 flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-colors"
                    >
                        Get Started
                    </Link>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {diagrams.map((diagram) => (
                        <div
                            key={diagram.id}
                            onClick={() => handleOpen(diagram.id)}
                            className={cn(
                                "group rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 hover:border-[var(--primary)]/30 hover:shadow-lg transition-all cursor-pointer",
                                deletingId === diagram.id && "opacity-40 scale-95 pointer-events-none"
                            )}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary)]/20">
                                    <FileCode2 className="h-5 w-5 text-[var(--primary)]" />
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={(e) => handleDelete(e, diagram.id)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-500/20"
                                        title="Delete diagram"
                                    >
                                        <Trash2 className="h-4 w-4 text-[var(--muted)] hover:text-red-400" />
                                    </button>
                                </div>
                            </div>
                            <h3 className="mt-3 text-sm font-medium text-[var(--foreground)] truncate group-hover:text-[var(--primary)] transition-colors">
                                {diagram.title}
                            </h3>
                            <p className="mt-1 text-xs text-[var(--muted)] capitalize">
                                {diagram.diagram_type || "Unknown type"}
                            </p>
                            <div className="mt-3 flex items-center justify-between">
                                <p className="text-xs text-[var(--muted)]">
                                    Updated{" "}
                                    {diagram.updated_at
                                        ? new Date(diagram.updated_at).toLocaleDateString()
                                        : "N/A"}
                                </p>
                                <span className="flex items-center gap-1 text-xs text-[var(--primary)] opacity-0 group-hover:opacity-100 transition-opacity">
                                    Open <ExternalLink className="h-3 w-3" />
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// --- Settings Tab ---
function SettingsTab({
    user,
    onUpdate,
}: {
    user: DashboardOverview["user"];
    onUpdate: (d: DashboardOverview) => void;
}) {
    const [username, setUsername] = useState(user.username || "");
    const [saving, setSaving] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [changingPassword, setChangingPassword] = useState(false);

    const handleSaveProfile = async () => {
        if (!username.trim()) return;
        setSaving(true);
        try {
            await updateProfile({ username: username.trim() });
            toast.success("Profile updated!");
            const newData = await fetchDashboardOverview();
            if (newData) onUpdate(newData);
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Failed to update profile");
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }
        if (newPassword.length < 8) {
            toast.error("Password must be at least 8 characters");
            return;
        }
        setChangingPassword(true);
        try {
            await updatePassword(currentPassword, newPassword);
            toast.success("Password changed!");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Failed to change password");
        } finally {
            setChangingPassword(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (
            !confirm(
                "Are you sure you want to delete your account? This action cannot be undone."
            )
        )
            return;
        try {
            await deleteAccount();
            clearToken();
            window.location.href = "/";
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Failed to delete account");
        }
    };

    return (
        <div className="max-w-2xl space-y-6">
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Settings</h1>

            {/* Profile Section */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-5">
                <h2 className="text-base font-semibold text-[var(--foreground)] flex items-center gap-2">
                    <User className="h-4 w-4 text-[var(--primary)]" />
                    Profile
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-[var(--muted)] mb-1.5">
                            Email
                        </label>
                        <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2.5">
                            <Mail className="h-4 w-4 text-[var(--muted)]" />
                            <span className="text-sm text-[var(--muted)]">{user.email}</span>
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[var(--muted)] mb-1.5">
                            Username
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter username"
                                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                            />
                            <button
                                onClick={handleSaveProfile}
                                disabled={saving || !username.trim()}
                                className="flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {saving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Edit3 className="h-4 w-4" />
                                )}
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Password Section */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-5">
                <h2 className="text-base font-semibold text-[var(--foreground)] flex items-center gap-2">
                    <Lock className="h-4 w-4 text-[var(--primary)]" />
                    Change Password
                </h2>

                <div className="space-y-3">
                    <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Current password"
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                    />
                    <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New password"
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                    />
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                    />
                    <button
                        onClick={handleChangePassword}
                        disabled={changingPassword || !currentPassword || !newPassword}
                        className="flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {changingPassword ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Lock className="h-4 w-4" />
                        )}
                        Update Password
                    </button>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 space-y-4">
                <h2 className="text-base font-semibold text-red-400 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Danger Zone
                </h2>
                <p className="text-sm text-[var(--muted)]">
                    Once you delete your account, there is no going back. All your diagrams
                    and data will be permanently removed.
                </p>
                <button
                    onClick={handleDeleteAccount}
                    className="flex items-center gap-2 rounded-lg bg-red-500/20 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/30 transition-colors"
                >
                    <Trash2 className="h-4 w-4" />
                    Delete Account
                </button>
            </div>
        </div>
    );
}

// --- Billing Tab ---
function BillingTab({
    user,
    stats,
    onUpdate,
}: {
    user: DashboardOverview["user"];
    stats: DashboardOverview["stats"];
    onUpdate?: (d: DashboardOverview) => void;
}) {
    const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null);
    const [payments, setPayments] = useState<PaymentTransaction[]>([]);
    const [loadingPayments, setLoadingPayments] = useState(true);
    const [subscriptionStatus, setSubscriptionStatus] = useState<any>(null);
    const [cancelling, setCancelling] = useState(false);

    const currentPlan = PLAN_INFO[user.plan] || PLAN_INFO.free;
    const plans = Object.entries(PLAN_INFO);

    useEffect(() => {
        getPayments()
            .then(setPayments)
            .catch(console.error)
            .finally(() => setLoadingPayments(false));

        getSubscriptionStatus()
            .then(setSubscriptionStatus)
            .catch(console.error);
    }, []);

    const handleUpgrade = async (planKey: string) => {
        if (planKey === "free") return;
        // Redirect to pricing page for the full checkout experience
        window.location.href = "/pricing";
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-[var(--foreground)]">
                Billing & Plans
            </h1>

            {/* Current Plan */}
            <div className="rounded-xl border border-[var(--primary)]/30 bg-gradient-to-br from-[var(--primary)]/10 to-purple-500/10 p-5">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm text-[var(--primary)]">Current Plan</p>
                        <h2 className="mt-1 text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
                            {currentPlan.name}
                            {user.plan !== "free" && (
                                <Crown className="h-5 w-5 text-amber-400" />
                            )}
                        </h2>
                        <p className="mt-1 text-lg text-[var(--primary)]">
                            {currentPlan.price}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-[var(--muted)]">Usage this month</p>
                        <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
                            {stats.diagrams_this_month}{" "}
                            <span className="text-base text-[var(--muted)]">
                                / {(user.plan === "pro" || user.plan === "pro_annual") ? "Unlimited" : stats.plan_limit}
                            </span>
                        </p>
                    </div>
                </div>

                {/* Cancel Subscription section */}
                {subscriptionStatus?.has_subscription && user.plan !== "free" && (
                    <div className="mt-6 pt-6 border-t border-[var(--primary)]/20 flex flex-col items-start gap-3">
                        {subscriptionStatus.cancel_at_period_end ? (
                            <div className="bg-amber-500/10 text-amber-500 text-sm px-4 py-3 rounded-lg flex items-start gap-3 border border-amber-500/20 w-full">
                                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium">Cancellation Scheduled</p>
                                    <p className="opacity-90 mt-0.5">Your subscription will be cancelled at the end of the current billing period.</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <button
                                    onClick={async () => {
                                        if (!confirm("Are you sure you want to cancel your subscription? You'll keep Pro features until the end of your billing period.")) return;
                                        setCancelling(true);
                                        try {
                                            await cancelSubscription();
                                            const updatedSub = await getSubscriptionStatus();
                                            setSubscriptionStatus(updatedSub);
                                            toast.success("Subscription scheduled for cancellation.");
                                        } catch (err) {
                                            toast.error(err instanceof Error ? err.message : "Failed to cancel subscription");
                                        } finally {
                                            setCancelling(false);
                                        }
                                    }}
                                    disabled={cancelling}
                                    className="rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/20 disabled:opacity-50 transition-colors flex items-center gap-2"
                                >
                                    {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                    Cancel Subscription
                                </button>
                                <p className="text-xs text-[var(--muted)]">
                                    You can cancel anytime. You will keep your Pro features until the end of your billing period.
                                </p>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Plan Comparison */}
            <div className="grid gap-4 lg:grid-cols-3">
                {plans.map(([key, plan]) => (
                    <div
                        key={key}
                        className={cn(
                            "rounded-xl border p-5 transition-all",
                            user.plan === key
                                ? "border-[var(--primary)] bg-[var(--primary)]/10 ring-2 ring-[var(--primary)]/30"
                                : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--muted)]"
                        )}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-base font-semibold text-[var(--foreground)]">
                                {plan.name}
                            </h3>
                            {user.plan === key && (
                                <span className="rounded-full bg-[var(--primary)]/20 px-2 py-0.5 text-xs font-medium text-[var(--primary)]">
                                    Current
                                </span>
                            )}
                        </div>
                        <p className="text-xl font-bold text-[var(--foreground)]">
                            {plan.price}
                        </p>
                        <ul className="mt-4 space-y-2">
                            {plan.features.map((feature, i) => (
                                <li
                                    key={i}
                                    className="flex items-center gap-2 text-sm text-[var(--muted)]"
                                >
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                    {feature}
                                </li>
                            ))}
                        </ul>
                        {user.plan !== key && (
                            <button
                                type="button"
                                onClick={() => handleUpgrade(key)}
                                disabled={upgradingPlan !== null}
                                className={cn(
                                    "mt-5 w-full rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2",
                                    key === "pro" || key === "pro_annual"
                                        ? "bg-[var(--primary)] text-white hover:opacity-90"
                                        : key === "team"
                                            ? "bg-violet-500 text-white hover:bg-violet-600"
                                            : "bg-[var(--secondary)] text-[var(--muted)] hover:bg-[var(--accent)]"
                                )}
                            >
                                {upgradingPlan === key ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Redirecting…
                                    </>
                                ) : key === "free" ? (
                                    "Downgrade"
                                ) : (
                                    "Upgrade"
                                )}
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* Billing History */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
                <h3 className="text-base font-semibold text-[var(--foreground)] mb-4">
                    Billing History
                </h3>
                {loadingPayments ? (
                    <div className="flex items-center justify-center py-6 text-[var(--muted)]">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : payments.length === 0 ? (
                    <div className="flex items-center justify-center py-6 text-[var(--muted)]">
                        <p className="text-sm">No billing history yet</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-md border border-[var(--border)]">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-[var(--secondary)] border-b border-[var(--border)]">
                                <tr>
                                    <th className="px-4 py-3 font-medium text-[var(--muted)]">Date</th>
                                    <th className="px-4 py-3 font-medium text-[var(--muted)]">Amount</th>
                                    <th className="px-4 py-3 font-medium text-[var(--muted)]">Status</th>
                                    <th className="px-4 py-3 font-medium text-[var(--muted)]">Method</th>
                                    <th className="px-4 py-3 font-medium text-[var(--muted)]">Transaction ID</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                                {payments.map(p => (
                                    <tr key={p.id} className="hover:bg-[var(--secondary)]/50 transition-colors">
                                        <td className="px-4 py-3 whitespace-nowrap text-[var(--foreground)]">
                                            {new Date(p.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-[var(--foreground)]">
                                            {p.amount} {p.currency}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className={cn(
                                                "px-2 py-0.5 rounded-full text-xs font-medium capitalize",
                                                p.status === "captured" ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500"
                                            )}>
                                                {p.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-[var(--foreground)] capitalize">
                                            {p.method || "-"}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-xs font-mono text-[var(--muted)]">
                                            {p.razorpay_payment_id}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
