"""
Analyze a GitHub repository via REST API and build a text summary for diagram generation.
Uses repo metadata, file tree, and key file contents (package.json, README, etc.).
"""
import logging
import os
from urllib.parse import urlparse

import httpx

logger = logging.getLogger("architectai.github_repo")

GITHUB_API_BASE = "https://api.github.com"
# Optional: GITHUB_TOKEN for higher rate limit (5000/hour vs 60/hour unauthenticated)
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

# File paths we care about (root or common locations) for understanding the app
KEY_FILES = [
    "README.md",
    "README",
    "package.json",
    "Gemfile",
    "Gemfile.lock",
    "requirements.txt",
    "pyproject.toml",
    "go.mod",
    "Cargo.toml",
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
    "docker-compose.yml",
    "docker-compose.yaml",
    "Dockerfile",
    "Makefile",
]

# Source entry points and key modules for deeper understanding
SOURCE_PATTERNS = [
    "main.py", "app.py", "index.py", "server.py", "api.py",
    "main.ts", "main.js", "index.ts", "index.js", "app.tsx", "app.jsx",
    "src/main.py", "src/app.py", "src/index.ts", "src/index.js",
    "src/App.tsx", "src/App.jsx", "app/main.py", "app/__init__.py",
    "cmd/main.go", "internal/main.go", "main.go",
]

# Monorepo: top-level dirs that typically contain multiple projects
MONOREPO_CONTAINERS = ["apps", "app", "packages", "pkg", "projects", "services", "examples", "tools"]

# Monorepo workspace config files (root)
MONOREPO_CONFIG_FILES = [
    "pnpm-workspace.yaml", "pnpm-workspace.yml",
    "lerna.json", "turbo.json", "nx.json", "workspace.json",
    "rush.json", "bolt.json",
]


def parse_github_url(url: str) -> tuple[str, str, str, str | None] | None:
    """
    Parse a GitHub repo URL into (owner, repo, ref, sub_path).
    ref defaults to main. sub_path is the directory path when a sub-project URL is used.
    Supports:
      - github.com/owner/repo
      - github.com/owner/repo/tree/branch
      - github.com/owner/repo/tree/branch/apps/web  (sub_path=apps/web)
      - github.com/owner/repo/blob/branch/apps/web/file.ts  (sub_path=apps/web)
    Returns None if not a valid GitHub repo URL.
    """
    url = (url or "").strip()
    if not url:
        return None
    # Normalize: remove trailing slash, .git
    url = url.rstrip("/").removesuffix(".git")
    parsed = urlparse(url if "://" in url else "https://" + url)
    host = (parsed.netloc or "").lower()
    if "github.com" not in host:
        return None
    path = (parsed.path or "").strip("/")
    parts = path.split("/")
    if len(parts) < 2:
        return None
    owner, repo = parts[0], parts[1]
    ref = "main"
    sub_path: str | None = None
    if len(parts) >= 4 and parts[2] == "tree":
        ref = parts[3]
        if len(parts) > 4:
            sub_path = "/".join(parts[4:])
    elif len(parts) >= 4 and parts[2] == "blob":
        ref = parts[3]
        if len(parts) > 4:
            sub_path = "/".join(parts[4:-1])  # parent dir of file
    return (owner, repo, ref, sub_path)


def _headers() -> dict[str, str]:
    h = {"Accept": "application/vnd.github.v3+json", "User-Agent": "ArchitectAI-App"}
    if GITHUB_TOKEN:
        h["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    return h


def _get(client: httpx.Client, path: str, **kwargs) -> httpx.Response:
    url = path if path.startswith("http") else f"{GITHUB_API_BASE}{path}"
    return client.get(url, headers=_headers(), timeout=30.0, **kwargs)


def fetch_repo_info(client: httpx.Client, owner: str, repo: str) -> dict | None:
    r = _get(client, f"/repos/{owner}/{repo}")
    if r.status_code != 200:
        logger.warning("repo_info_failed %s %s %s", owner, repo, r.status_code)
        return None
    return r.json()


def fetch_tree(client: httpx.Client, owner: str, repo: str, ref: str) -> list[dict] | None:
    # Get commit for ref to obtain tree sha
    r = _get(client, f"/repos/{owner}/{repo}/commits/{ref}", params={"per_page": 1})
    if r.status_code != 200:
        logger.warning("commits_failed %s %s %s", owner, repo, r.status_code)
        return None
    commit = r.json()
    tree_sha = commit.get("commit", {}).get("tree", {}).get("sha")
    if not tree_sha:
        return None
    r2 = _get(client, f"/repos/{owner}/{repo}/git/trees/{tree_sha}", params={"recursive": "1"})
    if r2.status_code != 200:
        logger.warning("tree_failed %s %s", owner, repo)
        return None
    data = r2.json()
    return data.get("tree") or []


def fetch_file_content(
    client: httpx.Client, owner: str, repo: str, path: str, ref: str
) -> str | None:
    url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/contents/{path}"
    r = client.get(
        url,
        headers={**_headers(), "Accept": "application/vnd.github.raw"},
        params={"ref": ref},
        timeout=30.0,
    )
    if r.status_code != 200:
        return None
    return r.text


# Max projects to list for monorepo (avoids huge prompts; apps/packages prioritized)
MAX_MONOREPO_PROJECTS = 25

# Priority order: apps/packages first, examples last
MONOREPO_PRIORITY = {"apps": 0, "app": 0, "packages": 1, "pkg": 1, "services": 2, "projects": 2, "tools": 3, "examples": 4}


def _detect_monorepo_projects(tree: list[dict]) -> tuple[list[str], int]:
    """
    Detect monorepo structure: apps/*, packages/*, projects/*, etc.
    Returns (project_paths, total_count). Paths capped at MAX_MONOREPO_PROJECTS;
    apps/packages prioritized. total_count is the full count before cap.
    """
    top_dirs: set[str] = set()
    for entry in tree:
        path = (entry.get("path") or "").strip()
        if not path or path.startswith(".") or "/" not in path:
            continue
        top = path.split("/")[0].lower()
        if top in (c.lower() for c in MONOREPO_CONTAINERS):
            top_dirs.add(path.split("/")[0])
    if not top_dirs:
        return [], 0
    all_projects: list[str] = []
    for entry in tree:
        path = (entry.get("path") or "").strip()
        if not path or path.startswith("."):
            continue
        parts = path.split("/")
        if len(parts) < 2:
            continue
        top = parts[0]
        if top not in top_dirs:
            continue
        sub = parts[1]
        if sub.startswith(".") or sub.endswith(".json"):  # skip config files, not project dirs
            continue
        project_path = f"{parts[0]}/{parts[1]}"
        if project_path not in all_projects:
            all_projects.append(project_path)
    # Sort: apps first, then packages, then others; then by name
    def sort_key(p: str) -> tuple[int, str]:
        top = p.split("/")[0].lower()
        return (MONOREPO_PRIORITY.get(top, 5), p)

    sorted_projects = sorted(set(all_projects), key=sort_key)
    total = len(sorted_projects)
    if total > MAX_MONOREPO_PROJECTS:
        # Keep apps + packages fully; truncate examples/others
        kept = [p for p in sorted_projects if p.split("/")[0].lower() in ("apps", "app", "packages", "pkg")]
        others = [p for p in sorted_projects if p not in kept]
        remaining = MAX_MONOREPO_PROJECTS - len(kept)
        if remaining > 0 and others:
            kept.extend(others[:remaining])
        return kept, total
    return sorted_projects, total


def _gather_monorepo_file_priorities(
    projects: list[str],
    path_lookup: dict[str, str],
) -> list[str]:
    """
    For monorepo: prioritize one package.json/Gemfile/etc per project.
    Returns paths to fetch, ensuring each project is represented.
    """
    per_project: dict[str, str] = {}
    key_patterns = ["package.json", "gemfile", "pyproject.toml", "cargo.toml", "go.mod", "pom.xml"]
    for proj in projects:
        proj_lower = proj.lower() + "/"
        for tree_key, orig in path_lookup.items():
            if not tree_key.startswith(proj_lower):
                continue
            rel = tree_key[len(proj_lower) :]
            if "/" in rel:
                continue
            for kp in key_patterns:
                if tree_key.endswith("/" + kp) or tree_key == kp:
                    per_project[proj] = orig
                    break
            if proj in per_project:
                break
    return list(per_project.values())


def _gather_file_tree_summary(tree: list[dict], projects: list[str] | None = None) -> str:
    """Build a structure summary: directories with file counts and key paths."""
    dir_files: dict[str, list[str]] = {}
    root_files: list[str] = []
    for entry in tree:
        path = (entry.get("path") or "").strip()
        if not path or path.startswith("."):
            continue
        parts = path.split("/")
        if len(parts) == 1:
            root_files.append(path)
        else:
            top = parts[0]
            if top not in dir_files:
                dir_files[top] = []
            dir_files[top].append(path)
    lines = []
    if projects:
        lines.append("MONOREPO - Projects: " + ", ".join(projects))
        lines.append("")
    if root_files:
        lines.append("Root files: " + ", ".join(sorted(root_files)[:40]))
    for top in sorted(dir_files.keys())[:20]:
        files = dir_files[top]
        sample = sorted(files)[:15]
        more = f" (+{len(files) - 15} more)" if len(files) > 15 else ""
        lines.append(f"  {top}/: {', '.join(sample)}{more}")
    return "\n".join(lines) if lines else ""


def build_repo_summary(
    owner: str,
    repo: str,
    ref: str,
    repo_info: dict,
    tree: list[dict],
    file_contents: dict[str, str],
    projects: list[str] | None = None,
    total_projects: int | None = None,
    sub_path: str | None = None,
) -> str:
    """Build a detailed text summary for deep repo analysis and diagram generation."""
    lines = []
    name = repo_info.get("name") or repo
    desc = (repo_info.get("description") or "").strip()
    lang = (repo_info.get("language") or "").strip()
    lines.append(f"Repository: {owner}/{repo} (ref: {ref})")
    if sub_path:
        lines.append(f"Sub-project: {sub_path} (analyzing this path only)")
    lines.append(f"Name: {name}")
    if desc:
        lines.append(f"Description: {desc}")
    if lang:
        lines.append(f"Primary language: {lang}")
    if projects:
        lines.append("")
        proj_line = "MONOREPO - Include ALL projects in the diagram: " + ", ".join(projects)
        if total_projects and total_projects > len(projects):
            proj_line += f" (+{total_projects - len(projects)} more)"
        lines.append(proj_line)

    # Full directory structure summary
    tree_summary = _gather_file_tree_summary(tree, projects)
    if tree_summary:
        lines.append("")
        lines.append("Repository structure:")
        lines.append(tree_summary)

    # Key file contents (longer truncation for README, moderate for others)
    for rel_path, content in file_contents.items():
        if not content or not content.strip():
            continue
        lines.append("")
        lines.append(f"--- {rel_path} ---")
        limit = 6000 if "readme" in rel_path.lower() else 4000
        truncated = content.strip()[:limit]
        if len(content.strip()) > limit:
            truncated += "\n... (truncated)"
        lines.append(truncated)

    return "\n".join(lines)


def analyze_repo(repo_url: str) -> str:
    """
    Analyze the given GitHub repo URL and return a text summary for the diagram agent.
    Raises ValueError if URL is invalid or API fails.
    """
    parsed = parse_github_url(repo_url)
    if not parsed:
        raise ValueError("Invalid GitHub repository URL. Use format: https://github.com/owner/repo")

    owner, repo, ref, sub_path = parsed
    if owner.lower() == "owner" and repo.lower() == "repo":
        raise ValueError(
            "That’s the placeholder URL. Paste a real GitHub repo, e.g. https://github.com/vercel/next.js"
        )

    with httpx.Client() as client:
        repo_info = fetch_repo_info(client, owner, repo)
        if not repo_info:
            raise ValueError("Repository not found or not accessible. Check URL and permissions.")

        # Use repo's default branch if ref was generic
        default_branch = repo_info.get("default_branch") or "main"
        if ref == "main" and default_branch != "main":
            ref = default_branch

        tree = fetch_tree(client, owner, repo, ref)
        if tree is None:
            tree = []

        # Filter to sub-project only when sub_path is provided (direct sub-project URL)
        if sub_path:
            sub_prefix = sub_path.rstrip("/") + "/"
            tree = [
                e for e in tree
                if (e.get("path") or "").startswith(sub_prefix) or (e.get("path") or "").rstrip("/") == sub_path.rstrip("/")
            ]
            if not tree:
                raise ValueError(f"Sub-project path '{sub_path}' not found or empty. Check the URL.")

        # Build path lookup: lowercase -> original path
        path_lookup: dict[str, str] = {}
        for e in tree:
            p = (e.get("path") or "").strip()
            if p:
                path_lookup[p.lower()] = p

        # Detect monorepo only when analyzing full repo (no sub_path)
        projects: list[str] = []
        total_projects: int | None = None
        if not sub_path:
            projects, total_projects = _detect_monorepo_projects(tree)
        is_monorepo = len(projects) > 0
        file_limit = 50 if is_monorepo else 30

        # 0. Monorepo: prioritize one config per project + workspace configs
        to_fetch: list[str] = []
        seen_lower: set[str] = set()

        if is_monorepo:
            for cfg in MONOREPO_CONFIG_FILES:
                cfg_lower = cfg.lower()
                for tree_key, orig in path_lookup.items():
                    if tree_key == cfg_lower or tree_key.endswith("/" + cfg_lower):
                        if tree_key not in seen_lower:
                            seen_lower.add(tree_key)
                            to_fetch.append(orig)
                        break
            monorepo_priorities = _gather_monorepo_file_priorities(projects, path_lookup)
            for p in monorepo_priorities:
                pl = p.lower()
                if pl not in seen_lower:
                    seen_lower.add(pl)
                    to_fetch.append(p)

        # 1. Key config/docs files
        for entry in tree:
            path = (entry.get("path") or "").strip()
            if not path:
                continue
            path_lower = path.lower()
            for key in KEY_FILES:
                if path_lower == key.lower() or path_lower.endswith("/" + key.lower()):
                    if path_lower not in seen_lower:
                        seen_lower.add(path_lower)
                        to_fetch.append(path)
                    break

        # 2. Source entry points and key modules for deeper understanding
        for pattern in SOURCE_PATTERNS:
            pl = pattern.lower()
            for tree_key, orig in path_lookup.items():
                if tree_key == pl or tree_key.endswith("/" + pl):
                    if tree_key not in seen_lower:
                        seen_lower.add(tree_key)
                        to_fetch.append(orig)
                    break

        file_contents: dict[str, str] = {}
        for path in to_fetch[:file_limit]:
            if not path:
                continue
            content = fetch_file_content(client, owner, repo, path, ref)
            if content:
                file_contents[path] = content

        summary = build_repo_summary(
            owner, repo, ref, repo_info, tree, file_contents, projects,
            total_projects if is_monorepo else None,
            sub_path,
        )
        return summary
