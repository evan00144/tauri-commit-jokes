# Closed-Source UX Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reposition GitRoast as a closed-source desktop product and make the main generate-and-copy workflow substantially easier to understand on first launch.

**Architecture:** Keep the existing Tauri command surface and React app state model, but refactor the frontend copy hierarchy and panel responsibilities. The app shell should sell outcome and trust, while repository readiness, service availability, and generation states should be rendered with simpler language and fewer implementation details.

**Tech Stack:** React 19, TypeScript, Vite, Tauri 2, plain CSS, Vitest, Testing Library

---

### Task 1: Add lightweight frontend test coverage before changing the UX

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/features/generator/GeneratorPanel.test.tsx`
- Create: `src/features/repo-status/RepoSummary.test.tsx`

**Step 1: Write the failing test harness**

```json
{
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.7.0",
    "@testing-library/react": "^16.3.0",
    "jsdom": "^26.1.0",
    "vitest": "^3.2.4"
  }
}
```

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
```

```ts
// src/test/setup.ts
import "@testing-library/jest-dom/vitest";
```

**Step 2: Add failing UX behavior tests**

```tsx
// src/features/generator/GeneratorPanel.test.tsx
it("shows a friendly waiting message before generation", () => {
  render(
    <GeneratorPanel
      viewState="no_staged_changes"
      repoStatus={{ hasStagedChanges: false, stagedFileCount: 0, diffByteSize: 0, repoRoot: "", repoName: "", errorCode: null }}
      generation={null}
      activeModel="hidden"
      copyState="idle"
      booting={false}
      inlineError={null}
      onGenerate={vi.fn(async () => {})}
      onCopy={vi.fn(async () => {})}
    />,
  );

  expect(screen.getByText(/stage files first/i)).toBeInTheDocument();
});
```

```tsx
// src/features/repo-status/RepoSummary.test.tsx
it("surfaces a repo-ready state without exposing raw implementation copy", () => {
  render(
    <RepoSummary
      repoContext={{ launchPath: "/tmp/repo", gitAvailable: true, isRepo: true, repoRoot: "/tmp/repo", repoName: "repo", errorCode: null }}
      repoStatus={{ repoRoot: "/tmp/repo", repoName: "repo", hasStagedChanges: true, stagedFileCount: 2, diffByteSize: 1024, errorCode: null }}
      booting={false}
      viewState="ready_to_generate"
      refreshingRepo={false}
      launchPath="/tmp/repo"
      onChooseRepo={vi.fn(async () => {})}
      onRefresh={vi.fn(async () => {})}
    />,
  );

  expect(screen.getByText(/repo ready/i)).toBeInTheDocument();
});
```

**Step 3: Run test to verify it fails**

Run: `pnpm test`

Expected: FAIL because the new test files and Vitest config do not exist yet.

**Step 4: Write the minimal implementation for the harness**

- Install the dev dependencies.
- Add the `test` script.
- Create `vitest.config.ts` and `src/test/setup.ts`.
- Create the two component tests with the exact props required by the current interfaces.

**Step 5: Run test to verify it passes**

Run: `pnpm test`

Expected: PASS for the new component tests.

**Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts src/test/setup.ts src/features/generator/GeneratorPanel.test.tsx src/features/repo-status/RepoSummary.test.tsx
git commit -m "test: add frontend coverage for ux refresh"
```

### Task 2: Reposition the hero for a closed-source product

**Files:**
- Modify: `src/app/App.tsx:242-438`
- Modify: `src/App.css:1-420`
- Test: `src/app/AppShell.test.tsx`

**Step 1: Write the failing app-shell test**

```tsx
it("removes source-code CTAs and keeps trust-focused copy", async () => {
  render(<App />);

  expect(screen.queryByText(/github/i)).not.toBeInTheDocument();
  expect(screen.getByText(/works locally on your repo/i)).toBeInTheDocument();
  expect(screen.getByText(/no local api key required/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- AppShell`

Expected: FAIL because the current hero still references GitHub/source copy and does not use the new trust-first messaging.

**Step 3: Write minimal implementation**

Replace the current hero with:

```tsx
const trustBullets = [
  "Works locally on your selected repository",
  "Sends staged diff text only when you click Generate",
  "No local API key required",
];
```

```tsx
<h1>Generate a commit line from your staged changes.</h1>
<p>
  GitRoast checks your repo locally, sends only the staged diff when you ask for a
  suggestion, and gives you one commit line ready to copy.
</p>
```

```tsx
<div className="hero-trust-list">
  {trustBullets.map((item) => (
    <span key={item} className="trust-chip">{item}</span>
  ))}
</div>
```

- Remove `activeModel` from the hero and overview card.
- Remove all GitHub/source CTA copy from the hero section.
- Keep the support CTA, but make it visually secondary to the main workflow.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- AppShell`

Expected: PASS with no GitHub/source hero content remaining.

**Step 5: Commit**

```bash
git add src/app/App.tsx src/App.css src/app/AppShell.test.tsx
git commit -m "feat: reposition hero for closed source trust messaging"
```

### Task 3: Simplify repository context into a readiness panel

**Files:**
- Modify: `src/features/repo-status/RepoSummary.tsx:1-132`
- Modify: `src/App.css:520-860`
- Test: `src/features/repo-status/RepoSummary.test.tsx`

**Step 1: Write the failing readiness test**

```tsx
it("shows a short readiness checklist instead of a raw context dump", () => {
  render(/* ready_to_generate props */);

  expect(screen.getByText(/selected repo/i)).toBeInTheDocument();
  expect(screen.getByText(/2 staged files/i)).toBeInTheDocument();
  expect(screen.queryByText(/launch path/i)).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- RepoSummary`

Expected: FAIL because the current panel still exposes `Launch path`, `Root`, and `Git available`.

**Step 3: Write minimal implementation**

Refactor the panel into a shorter readiness summary:

```tsx
<Panel
  title="Selected Repo"
  subtitle="Choose the repo, stage the right changes, then generate one commit line."
  aside={<StatusPill tone={tone}>{contextLabel(viewState)}</StatusPill>}
>
  <div className="readiness-list">
    <div className="readiness-row">
      <span className="readiness-label">Repository</span>
      <strong>{repoName}</strong>
    </div>
    <div className="readiness-row">
      <span className="readiness-label">Staged changes</span>
      <strong>{repoStatus?.stagedFileCount ?? 0} files</strong>
    </div>
    <div className="readiness-row">
      <span className="readiness-label">Diff size</span>
      <strong>{formatKilobytes(repoStatus?.diffByteSize)}</strong>
    </div>
  </div>
```

- Keep `Choose repo` and `Refresh`.
- Hide raw launch path and repo root from the default UI.
- Preserve blocking/error state labels.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- RepoSummary`

Expected: PASS with the simplified readiness panel.

**Step 5: Commit**

```bash
git add src/features/repo-status/RepoSummary.tsx src/App.css src/features/repo-status/RepoSummary.test.tsx
git commit -m "feat: simplify repository readiness panel"
```

### Task 4: Replace service internals with a privacy and reliability panel

**Files:**
- Modify: `src/features/onboarding/ApiKeyForm.tsx:1-81`
- Modify: `src/app/App.tsx:242-438`
- Modify: `src/App.css:520-860`
- Test: `src/features/onboarding/ServicePanel.test.tsx`

**Step 1: Write the failing service-panel test**

```tsx
it("does not expose base url or model details in the default service panel", () => {
  render(
    <ServicePanel
      serviceStatus={{ ok: true, serviceName: "svc", modelName: "gpt", baseUrl: "https://x", errorCode: null }}
      refreshingService={false}
      inlineError={null}
      onRefresh={vi.fn(async () => {})}
    />,
  );

  expect(screen.queryByText(/base url/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/server model/i)).not.toBeInTheDocument();
  expect(screen.getByText(/no local api key required/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- ServicePanel`

Expected: FAIL because the current panel prints base URL, service name, and model name.

**Step 3: Write minimal implementation**

Rename the panel conceptually to `Privacy & Service` and render only user-relevant facts:

```tsx
<Panel
  title="Privacy & Service"
  subtitle="GitRoast keeps repo inspection local and contacts the hosted service only when you generate."
  aside={<StatusPill tone={tone}>{label}</StatusPill>}
>
  <div className="detail-list">
    <div className="detail-row">
      <span className="detail-label">Local only</span>
      <span className="detail-value">Repo checks and staged file inspection</span>
    </div>
    <div className="detail-row">
      <span className="detail-label">Sent on generate</span>
      <span className="detail-value">Staged diff text</span>
    </div>
    <div className="detail-row">
      <span className="detail-label">Setup</span>
      <span className="detail-value">No local API key required</span>
    </div>
  </div>
```

- Keep the status pill and refresh button.
- Do not render base URL, service name, or active model in the default UI.
- Keep degraded-service messaging concise and actionable.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- ServicePanel`

Expected: PASS with a trust-focused service panel.

**Step 5: Commit**

```bash
git add src/features/onboarding/ApiKeyForm.tsx src/app/App.tsx src/App.css src/features/onboarding/ServicePanel.test.tsx
git commit -m "feat: replace service internals with privacy summary"
```

### Task 5: Make the generator panel easier to scan and act on

**Files:**
- Modify: `src/features/generator/GeneratorPanel.tsx:1-116`
- Modify: `src/App.css:556-720`
- Test: `src/features/generator/GeneratorPanel.test.tsx`

**Step 1: Write the failing generator-state test**

```tsx
it("uses action-oriented copy and a stronger primary CTA", () => {
  render(/* ready_to_generate props */);

  expect(screen.getByRole("button", { name: /generate commit line/i })).toBeEnabled();
  expect(screen.getByText(/ready from your staged diff/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- GeneratorPanel`

Expected: FAIL because the current copy says `Generate` and still mentions backend-model detail.

**Step 3: Write minimal implementation**

Change the generator framing from technical to action-driven:

```tsx
const primaryLabel =
  viewState === "generating" ? "Generating commit line..." : "Generate commit line";
```

```tsx
subtitle={renderStateCopy(viewState)}
```

```tsx
{generation?.success ? (
  <div className="generated-result">
    <pre>{generation.message}</pre>
    <p className="muted">Review it, copy it, then finish the commit in your normal workflow.</p>
  </div>
) : (
  <div className="empty-state">
    <p className="muted">Your next commit line will appear here once a staged diff is ready.</p>
  </div>
)}
```

- Remove `Active backend model` from the subtitle.
- Rename the primary CTA to `Generate commit line`.
- Keep `Copy`, and optionally add `Generate again` behavior by reusing the same button label when a result already exists.
- Ensure error messaging stays in the same visual container as the output state.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- GeneratorPanel`

Expected: PASS with clearer CTA and result messaging.

**Step 5: Commit**

```bash
git add src/features/generator/GeneratorPanel.tsx src/App.css src/features/generator/GeneratorPanel.test.tsx
git commit -m "feat: improve generator clarity and cta copy"
```

### Task 6: Rebalance layout, spacing, and mobile behavior for friendlier UX

**Files:**
- Modify: `src/App.css:1-860`
- Modify: `src/app/App.tsx:264-438`
- Test: `pnpm build`

**Step 1: Write the failing visual checklist**

Create a local checklist in the plan implementation notes:

```md
- Hero reads as product promise first, not infrastructure explanation.
- Primary path is visible above the fold on laptop widths.
- The support CTA is present but clearly secondary.
- No card overflows on <= 840px widths.
- Success, loading, and error states remain visually distinct.
```

**Step 2: Run the current app to confirm the gaps**

Run: `pnpm dev`

Expected: The current layout still gives too much space to implementation detail and repeats trust messaging across multiple cards.

**Step 3: Write minimal implementation**

- Tighten hero vertical spacing.
- Increase contrast on the primary button.
- Add dedicated classes for `trust-chip`, `readiness-list`, `generated-result`, and `empty-state`.
- Reorder the main grid so the generator panel stays visually dominant on desktop and appears immediately after the hero on mobile.
- Ensure all cards collapse cleanly to one column without path overflow or kicker misalignment.

Example CSS direction:

```css
.trust-chip {
  display: inline-flex;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff3e3;
}

.generated-result,
.empty-state,
.readiness-list {
  display: grid;
  gap: 12px;
}
```

**Step 4: Run build to verify it passes**

Run: `pnpm build`

Expected: PASS with no TypeScript or Vite errors.

**Step 5: Commit**

```bash
git add src/App.css src/app/App.tsx
git commit -m "style: rebalance layout for friendlier workflow"
```

### Task 7: Final verification and release-readiness pass

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

**Step 1: Write the failing docs checklist**

```md
- README does not promise source visibility as a trust mechanism.
- README positions the app as a hosted closed-source desktop client.
- CHANGELOG entry mentions the UX refresh and simplified trust messaging.
```

**Step 2: Verify docs currently fail the checklist**

Run: `rg -n "open source|source|GitHub" README.md CHANGELOG.md`

Expected: Output still includes wording that assumes GitHub/source visibility matters to product positioning.

**Step 3: Write minimal implementation**

- Update README product language to match the app: closed-source desktop client, local repo inspection, hosted generation on demand, optional support.
- Add a changelog note for the UX refresh and trust-copy simplification.

**Step 4: Run full validation**

Run: `pnpm test`

Expected: PASS

Run: `pnpm build`

Expected: PASS

**Step 5: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: align product copy with closed-source positioning"
```

## Acceptance Criteria

- The desktop UI no longer advertises source-code access or GitHub as a trust mechanism.
- The default UI does not expose service base URL, model name, or other backend internals.
- A first-time user can understand the full workflow in one pass: choose repo, stage changes, generate, copy.
- Trust messaging remains visible, but it is framed around data handling and local-vs-hosted behavior rather than implementation transparency.
- The donation/support CTA remains available without dominating the main workflow.
- Component tests and a production build pass after the refresh.
