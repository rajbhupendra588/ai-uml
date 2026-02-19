/**
 * Dashboard API utilities.
 */
import { getApiBaseUrl } from "./api";
import { getAuthHeaders } from "./auth";

export interface DashboardStats {
    diagrams_this_month: number;
    diagrams_total: number;
    diagrams_by_type: Record<string, number>;
    usage_history: Array<{ date: string; count: number }>;
    plan: string;
    plan_limit: number;
    plan_used_percent: number;
    // Token usage
    tokens_used_this_month: number;
    tokens_used_total: number;
    token_limit: number;
    token_used_percent: number;
}

export interface DashboardUser {
    id: number;
    email: string;
    username: string | null;
    avatar_url: string | null;
    plan: string;
    created_at: string | null;
}

export interface RecentDiagram {
    id: number;
    title: string;
    diagram_type: string | null;
    mermaid_code: string | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface DashboardOverview {
    user: DashboardUser;
    stats: DashboardStats;
    recent_diagrams: RecentDiagram[];
}

export function getDashboardOverviewUrl(): string {
    return `${getApiBaseUrl()}/api/v1/dashboard/overview`;
}

export function getDashboardProfileUrl(): string {
    return `${getApiBaseUrl()}/api/v1/dashboard/profile`;
}

export function getDashboardStatsUrl(): string {
    return `${getApiBaseUrl()}/api/v1/dashboard/stats`;
}

export async function fetchDashboardOverview(): Promise<DashboardOverview | null> {
    const headers = getAuthHeaders();
    if (!headers.Authorization) return null;

    const res = await fetch(getDashboardOverviewUrl(), { headers });
    if (!res.ok) return null;
    return res.json();
}

export async function updateProfile(data: {
    username?: string;
    avatar_url?: string;
}): Promise<DashboardUser> {
    const res = await fetch(getDashboardProfileUrl(), {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
        },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to update profile");
    }
    return res.json();
}

export async function updatePassword(
    currentPassword: string,
    newPassword: string
): Promise<void> {
    const res = await fetch(`${getApiBaseUrl()}/api/v1/dashboard/password`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
        },
        body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
        }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to update password");
    }
}

export async function deleteAccount(): Promise<void> {
    const res = await fetch(`${getApiBaseUrl()}/api/v1/dashboard/account`, {
        method: "DELETE",
        headers: getAuthHeaders(),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to delete account");
    }
}

export const PLAN_INFO: Record<
    string,
    { name: string; price: string; features: string[]; color: string }
> = {
    free: {
        name: "Free",
        price: "₹0/month",
        features: [
            "10 diagrams/month",
            "10K tokens/month",
            "All diagram types",
            "Basic themes",
            "Watermarked exports",
            "Community support",
        ],
        color: "slate",
    },
    pro: {
        name: "Pro Monthly",
        price: "₹250/month",
        features: [
            "Unlimited diagrams",
            "500K tokens/month",
            "All diagram types",
            "Premium themes & styles",
            "No watermarks",
            "Priority support",
            "Export to PNG, SVG, PDF",
            "Advanced customization",
        ],
        color: "indigo",
    },
    pro_annual: {
        name: "Pro Annual",
        price: "₹2,000/year",
        features: [
            "Everything in Pro Monthly",
            "Unlimited diagrams",
            "500K tokens/month",
            "All diagram types",
            "Premium themes & styles",
            "No watermarks",
            "Priority support",
            "Export to PNG, SVG, PDF",
            "Advanced customization",
        ],
        color: "indigo",
    },
};

/** Short label for plan badge in header (Free / Pro / Team). */
export function getPlanBadgeLabel(plan?: string | null): string {
    if (!plan) return "Free";
    const p = plan.toLowerCase();
    if (p === "free") return "Free";
    if (p === "pro" || p === "pro_annual") return "Pro";
    if (p === "team") return "Team";
    return PLAN_INFO[plan]?.name ?? "Free";
}
