import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GeneratorPanel } from "./GeneratorPanel";

describe("GeneratorPanel", () => {
  it("shows a friendly waiting message before generation", () => {
    render(
      <GeneratorPanel
        viewState="no_staged_changes"
        repoStatus={{
          hasStagedChanges: false,
          stagedFileCount: 0,
          diffByteSize: 0,
          repoRoot: "/tmp/repo",
          repoName: "repo",
          errorCode: null,
        }}
        generation={null}
        copyState="idle"
        booting={false}
        inlineError={null}
        onGenerate={vi.fn(async () => {})}
        onCopy={vi.fn(async () => {})}
      />,
    );

    expect(
      screen.getByText(/gitroast only uses the staged diff you prepare/i),
    ).toBeInTheDocument();
  });

  it("uses action-oriented copy and a stronger primary CTA", () => {
    render(
      <GeneratorPanel
        viewState="ready_to_generate"
        repoStatus={{
          hasStagedChanges: true,
          stagedFileCount: 2,
          diffByteSize: 1024,
          repoRoot: "/tmp/repo",
          repoName: "repo",
          errorCode: null,
        }}
        generation={null}
        copyState="idle"
        booting={false}
        inlineError={null}
        onGenerate={vi.fn(async () => {})}
        onCopy={vi.fn(async () => {})}
      />,
    );

    expect(screen.getByRole("button", { name: /generate commit line/i })).toBeEnabled();
    expect(screen.getByText(/everything is ready from your staged diff/i)).toBeInTheDocument();
  });
});
