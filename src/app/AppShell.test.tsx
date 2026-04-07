import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import * as tauri from "../lib/tauri";

vi.mock("../lib/tauri", () => ({
  initContext: vi.fn(),
  getRepoStatus: vi.fn(),
  getServiceStatus: vi.fn(),
  chooseRepoRoot: vi.fn(),
  generateCommitMessage: vi.fn(),
  openExternal: vi.fn(),
}));

describe("App shell", () => {
  beforeEach(() => {
    window.__GITROAST_CWD__ = "/tmp/repo";

    vi.mocked(tauri.initContext).mockResolvedValue({
      launchPath: "/tmp/repo",
      gitAvailable: true,
      isRepo: true,
      repoRoot: "/tmp/repo",
      repoName: "repo",
      errorCode: null,
    });

    vi.mocked(tauri.getRepoStatus).mockResolvedValue({
      repoRoot: "/tmp/repo",
      repoName: "repo",
      hasStagedChanges: true,
      stagedFileCount: 2,
      diffByteSize: 1024,
      errorCode: null,
    });

    vi.mocked(tauri.getServiceStatus).mockResolvedValue({
      ok: true,
      serviceName: "svc",
      modelName: "gpt",
      baseUrl: "https://example.com",
      errorCode: null,
    });
  });

  it("removes source-code CTAs and keeps trust-focused copy", async () => {
    render(<App />);

    await screen.findByText(/staged diff ready/i);

    expect(screen.queryByText(/github/i)).not.toBeInTheDocument();
    expect(screen.getByText(/works locally on your selected repository/i)).toBeInTheDocument();
    expect(screen.getAllByText(/no local api key required/i).length).toBeGreaterThan(0);
  });
});
