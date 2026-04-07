import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RepoSummary } from "./RepoSummary";

describe("RepoSummary", () => {
  it("surfaces a repo-ready state without exposing raw implementation copy", () => {
    render(
      <RepoSummary
        repoContext={{
          launchPath: "/tmp/repo",
          gitAvailable: true,
          isRepo: true,
          repoRoot: "/tmp/repo",
          repoName: "repo",
          errorCode: null,
        }}
        repoStatus={{
          repoRoot: "/tmp/repo",
          repoName: "repo",
          hasStagedChanges: true,
          stagedFileCount: 2,
          diffByteSize: 1024,
          errorCode: null,
        }}
        booting={false}
        viewState="ready_to_generate"
        refreshingRepo={false}
        launchPath="/tmp/repo"
        onChooseRepo={vi.fn(async () => {})}
        onRefresh={vi.fn(async () => {})}
      />,
    );

    expect(screen.getByText(/repo ready/i)).toBeInTheDocument();
    expect(screen.queryByText(/launch path/i)).not.toBeInTheDocument();
  });

  it("shows a short readiness summary instead of a raw context dump", () => {
    render(
      <RepoSummary
        repoContext={{
          launchPath: "/tmp/repo",
          gitAvailable: true,
          isRepo: true,
          repoRoot: "/tmp/repo",
          repoName: "repo",
          errorCode: null,
        }}
        repoStatus={{
          repoRoot: "/tmp/repo",
          repoName: "repo",
          hasStagedChanges: true,
          stagedFileCount: 2,
          diffByteSize: 2048,
          errorCode: null,
        }}
        booting={false}
        viewState="ready_to_generate"
        refreshingRepo={false}
        launchPath="/tmp/repo"
        onChooseRepo={vi.fn(async () => {})}
        onRefresh={vi.fn(async () => {})}
      />,
    );

    expect(screen.getByText(/selected repo/i)).toBeInTheDocument();
    expect(screen.getByText("2 staged files")).toBeInTheDocument();
    expect(screen.queryByText(/git available/i)).not.toBeInTheDocument();
  });
});
