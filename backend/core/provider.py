from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from .github_client import GitHubIssueProvider
from .gitlab_client import GitLabIssueClient

PROVIDER_NAMES = {"gitlab", "github"}


@runtime_checkable
class IssueProvider(Protocol):
    provider_name: str

    def fetch_project_issues(
        self, project_ref: str, state: str = "all"
    ) -> list[dict[str, Any]]: ...

    def fetch_issues_with_params(
        self, project_ref: str, params: dict[str, Any]
    ) -> list[dict[str, Any]]: ...

    def fetch_issue(self, project_ref: str, issue_iid: int) -> dict[str, Any]: ...

    def fetch_issue_discussions(
        self, project_ref: str, issue_iid: int
    ) -> list[dict[str, Any]]: ...

    def fetch_issue_related_merge_requests(
        self, project_ref: str, issue_iid: int
    ) -> list[dict[str, Any]]: ...

    def fetch_issue_links(
        self, project_ref: str, issue_iid: int
    ) -> list[dict[str, Any]]: ...

    def test_connection(self, project_ref: str) -> dict[str, Any]: ...

    def capabilities(self) -> dict[str, Any]: ...


def normalize_provider_name(value: Any) -> str:
    provider = str(value or "gitlab").strip().lower()
    if provider not in PROVIDER_NAMES:
        raise ValueError(f"Unsupported issue provider: {provider}")
    return provider


def get_connection(
    config: dict[str, Any], provider: str | None = None
) -> dict[str, Any]:
    name = normalize_provider_name(provider or config.get("active_provider"))
    connections = config.get("connections") or {}
    connection = connections.get(name) or {}
    return {
        "provider": name,
        "base_url": str(connection.get("base_url") or "").strip().rstrip("/"),
        "token": str(connection.get("token") or "").strip(),
        "project_ref": str(connection.get("project_ref") or "").strip(),
        "project_ref_history": connection.get("project_ref_history") or [],
        "verify_ssl": bool(connection.get("verify_ssl", name == "github")),
    }


def source_identity(config: dict[str, Any]) -> str:
    if config.get("import_file"):
        return f"import:{config.get('import_file')}"
    connection = get_connection(config)
    return (
        f"{connection['provider']}:{connection['base_url']}:{connection['project_ref']}"
    )


def create_provider(
    config: dict[str, Any],
    *,
    provider: str | None = None,
    base_url: str | None = None,
) -> IssueProvider:
    connection = get_connection(config, provider)
    resolved_base_url = (base_url or connection["base_url"]).rstrip("/")

    if connection["provider"] == "github":
        return GitHubIssueProvider(
            resolved_base_url or "https://github.com",
            connection["token"],
            verify_ssl=connection["verify_ssl"],
        )

    if not resolved_base_url or not connection["token"]:
        raise ValueError("GitLab Base URL and token are required.")
    return GitLabIssueClient(
        resolved_base_url,
        connection["token"],
        verify_ssl=connection["verify_ssl"],
    )


def active_provider_context(config: dict[str, Any]) -> tuple[IssueProvider, str]:
    connection = get_connection(config)
    if not connection["project_ref"]:
        raise ValueError(
            f"{connection['provider'].title()} repository/project reference is required."
        )
    return create_provider(config), connection["project_ref"]


def provider_capabilities(config: dict[str, Any]) -> dict[str, Any]:
    provider, project_ref = active_provider_context(config)
    return {
        **provider.capabilities(),
        "provider": provider.provider_name,
        "source_ref": project_ref,
    }
