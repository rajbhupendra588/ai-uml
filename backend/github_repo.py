"""
Analyze a GitHub repository via REST API and build a text summary for diagram generation.
Uses repo metadata, file tree, and key file contents (package.json, README, etc.).
"""
import base64
import logging
import os
from urllib.parse import urlparse

import httpx

from config import GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET

logger = logging.getLogger("architectai.github_repo")

GITHUB_API_BASE = "https://api.github.com"
# Optional: GITHUB_TOKEN for higher rate limit and private repos
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

# File paths we care about (root or common locations) for understanding the app
KEY_FILES = [
    "README.md",
    "README",
    "package.json",
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


def parse_github_url(url: str) -> tuple[str, str, str] | None:
    """
    Parse a GitHub repo URL into (owner, repo, ref).
    ref defaults to main; supports github.com/owner/repo, /tree/branch, .git.
    Returns None if not a valid GitHub repo URL.
    """
    url = (url or "").strip()
    if not url:
        return None
    # Normalize: remove trailing slash, .git
    url = url.rstrip("/").removesuffix(".git")
    # github.com/owner/repo or github.com/owner/repo/tree/branch
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
    if len(parts) >= 4 and parts[2] == "tree":
        ref = parts[3]
    return (owner, repo, ref)


def _headers() -> dict[str, str]:
    h = {"Accept": "application/vnd.github.v3+json", "User-Agent": "ArchitectAI-App"}
    if GITHUB_TOKEN:
        h["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    elif GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET:
        # Use OAuth app credentials for higher rate limit (5000/hour vs 60/hour)
        auth = base64.b64encode(f"{GITHUB_CLIENT_ID}:{GITHUB_CLIENT_SECRET}".encode()).decode()
        h["Authorization"] = f"Basic {auth}"
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


def build_repo_summary(owner: str, repo: str, ref: str, repo_info: dict, tree: list[dict], file_contents: dict[str, str]) -> str:
    """Build a single text summary suitable as the prompt for diagram generation."""
    lines = []
    name = repo_info.get("name") or repo
    desc = (repo_info.get("description") or "").strip()
    lang = (repo_info.get("language") or "").strip()
    lines.append(f"Repository: {owner}/{repo} (ref: {ref})")
    lines.append(f"Name: {name}")
    if desc:
        lines.append(f"Description: {desc}")
    if lang:
        lines.append(f"Primary language: {lang}")

    # Top-level dirs and key files from tree
    top_dirs = set()
    top_files = []
    for entry in tree:
        path = (entry.get("path") or "").strip()
        if not path or "/" not in path and path.startswith("."):
            continue
        parts = path.split("/")
        if len(parts) == 1:
            top_files.append(path)
        else:
            top_dirs.add(parts[0])
    if top_dirs:
        lines.append("")
        lines.append("Top-level directories: " + ", ".join(sorted(top_dirs)[:25]))
    if top_files:
        lines.append("Top-level files: " + ", ".join(sorted(top_files)[:30]))

    # Key file contents (truncated)
    for rel_path, content in file_contents.items():
        if not content or not content.strip():
            continue
        lines.append("")
        lines.append(f"--- {rel_path} ---")
        # First N chars to avoid huge prompts
        truncated = content.strip()[:3000]
        if len(content.strip()) > 3000:
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

    owner, repo, ref = parsed
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

        # Find which key files exist (root or nested); prefer root-level
        to_fetch: list[str] = []
        seen_lower: set[str] = set()
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

        file_contents: dict[str, str] = {}
        for path in to_fetch[:15]:  # limit number of files
            content = fetch_file_content(client, owner, repo, path, ref)
            if content:
                file_contents[path] = content

        summary = build_repo_summary(owner, repo, ref, repo_info, tree, file_contents)
        return summary
