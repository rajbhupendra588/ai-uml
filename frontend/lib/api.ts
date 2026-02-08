/**
 * API base URL — use env in production, fallback for local dev.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

export function getGenerateUrl(): string {
  return `${getApiBaseUrl()}/api/v1/generate`;
}

export function getGenerateFromRepoUrl(): string {
  return `${getApiBaseUrl()}/api/v1/generate-from-repo`;
}

export function getPlanUrl(): string {
  return `${getApiBaseUrl()}/api/v1/plan`;
}

export function getGenerateFromPlanUrl(): string {
  return `${getApiBaseUrl()}/api/v1/generate-from-plan`;
}

export function getExportUrl(): string {
  return `${getApiBaseUrl()}/api/v1/export`;
}

export function getHealthUrl(): string {
  return `${getApiBaseUrl()}/health`;
}

export function getDiagramTypesUrl(): string {
  return `${getApiBaseUrl()}/api/v1/diagram-types`;
}

export function getModelsUrl(): string {
  return `${getApiBaseUrl()}/api/v1/models`;
}

export function getAuthConfigUrl(): string {
  return `${getApiBaseUrl()}/api/v1/auth/config`;
}

export function getAuthMeUrl(): string {
  return `${getApiBaseUrl()}/api/v1/auth/me`;
}

export function getAuthGithubUrl(): string {
  return `${getApiBaseUrl()}/api/v1/auth/github`;
}

export function getAuthLogoutUrl(): string {
  return `${getApiBaseUrl()}/api/v1/auth/logout`;
}

export function getGithubReposUrl(): string {
  return `${getApiBaseUrl()}/api/v1/github/repos`;
}

export function getGithubUserReposUrl(username: string): string {
  return `${getApiBaseUrl()}/api/v1/github/users/${encodeURIComponent(username)}/repos`;
}

export interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  private: boolean;
}

export interface ModelOption {
  id: string;
  name: string;
}

export const DEFAULT_MODELS: ModelOption[] = [
  { id: "arcee-ai/trinity-large-preview:free", name: "Trinity (default)" },
  { id: "meta-llama/llama-3.1-405b-instruct:free", name: "Llama 3.1 405B" },
  { id: "tngtech/deepseek-r1t-chimera:free", name: "DeepSeek R1 Chimera" },
  { id: "deepseek/deepseek-r1-0528:free", name: "DeepSeek R1 0528" },
  { id: "nvidia/nemotron-3-nano-30b-a3b:free", name: "NVIDIA Nemotron 3 Nano" },
  { id: "openai/gpt-oss-120b:free", name: "GPT-OSS 120B" },
];

export type DiagramType =
  | "architecture"
  | "hld"
  | "lld"
  | "mindtree"
  | "class"
  | "sequence"
  | "usecase"
  | "activity"
  | "state"
  | "component"
  | "deployment";

/** All diagram types accepted by the API. Use when sending diagram_type to avoid 422. */
export const VALID_DIAGRAM_TYPES: readonly DiagramType[] = [
  "architecture",
  "hld",
  "lld",
  "mindtree",
  "class",
  "sequence",
  "usecase",
  "activity",
  "state",
  "component",
  "deployment",
] as const;

export function toValidDiagramType(value: string): DiagramType {
  return (VALID_DIAGRAM_TYPES as readonly string[]).includes(value)
    ? (value as DiagramType)
    : "architecture";
}

export const DIAGRAM_TYPE_LABELS: Record<DiagramType, string> = {
  architecture: "Architecture",
  hld: "HLD (High-Level Design)",
  lld: "LLD (Low-Level Design)",
  mindtree: "Mind Tree / Mind Map",
  class: "Class",
  sequence: "Sequence",
  usecase: "Use Case",
  activity: "Activity",
  state: "State",
  component: "Component",
  deployment: "Deployment",
};
