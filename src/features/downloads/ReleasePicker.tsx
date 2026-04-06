import { useEffect, useMemo, useState } from "react";
import { Panel } from "../../components/Panel";
import { StatusPill } from "../../components/StatusPill";

type ReleaseAsset = {
  id: number;
  name: string;
  browser_download_url: string;
};

type ReleaseRecord = {
  id: number;
  tag_name: string;
  name: string | null;
  prerelease: boolean;
  published_at: string | null;
  assets: ReleaseAsset[];
};

type ReleasePickerProps = {
  onOpenExternal: (url: string) => Promise<void>;
};

const RELEASES_API = "https://api.github.com/repos/evan00144/tauri-commit-jokes/releases";

function isDownloadableAsset(assetName: string) {
  const lower = assetName.toLowerCase();

  if (lower.endsWith(".sig")) {
    return false;
  }

  return [
    ".dmg",
    ".msi",
    ".exe",
    ".appimage",
    ".deb",
    ".rpm",
    ".zip",
    ".tar.gz",
    ".pkg",
  ].some((extension) => lower.endsWith(extension));
}

function formatReleaseDate(value: string | null) {
  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ReleasePicker({ onOpenExternal }: ReleasePickerProps) {
  const [releases, setReleases] = useState<ReleaseRecord[]>([]);
  const [selectedTag, setSelectedTag] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadReleases() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(RELEASES_API, {
          headers: {
            Accept: "application/vnd.github+json",
          },
        });

        if (!response.ok) {
          throw new Error(`GitHub returned ${response.status}`);
        }

        const payload = (await response.json()) as ReleaseRecord[];
        const nextReleases = payload
          .map((release) => ({
            ...release,
            assets: release.assets.filter((asset) => isDownloadableAsset(asset.name)),
          }))
          .filter((release) => release.assets.length > 0);

        if (cancelled) {
          return;
        }

        setReleases(nextReleases);
        setSelectedTag(nextReleases[0]?.tag_name ?? "");
      } catch (nextError) {
        if (cancelled) {
          return;
        }

        setError(
          nextError instanceof Error
            ? nextError.message
            : "GitRoast could not load release downloads from GitHub.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadReleases();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedRelease = useMemo(
    () => releases.find((release) => release.tag_name === selectedTag) ?? null,
    [releases, selectedTag],
  );

  return (
    <Panel
      title="Download Releases"
      subtitle="Pick a GitHub release tag, then open the packaged asset you want for your platform."
      aside={
        loading ? (
          <StatusPill tone="warning">Loading releases</StatusPill>
        ) : error ? (
          <StatusPill tone="danger">GitHub fetch failed</StatusPill>
        ) : (
          <StatusPill tone="success">{releases.length} release{releases.length === 1 ? "" : "s"}</StatusPill>
        )
      }
    >
      <div className="release-controls">
        <div className="field-block">
          <label className="field-label" htmlFor="release-tag">
            Version tag
          </label>
          <select
            id="release-tag"
            className="input-control"
            value={selectedTag}
            onChange={(event) => setSelectedTag(event.target.value)}
            disabled={loading || releases.length === 0}
          >
            {releases.map((release) => (
              <option key={release.id} value={release.tag_name}>
                {release.tag_name}
                {release.prerelease ? " (pre-release)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="release-meta">
        <div className="detail-row">
          <span className="detail-label">Release name</span>
          <span className="detail-value">{selectedRelease?.name ?? "No release selected"}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Published</span>
          <span className="detail-value">
            {selectedRelease ? formatReleaseDate(selectedRelease.published_at) : "Date unavailable"}
          </span>
        </div>
      </div>

      <div className="release-assets">
        {selectedRelease?.assets.length ? (
          selectedRelease.assets.map((asset) => (
            <button
              className="download-chip"
              type="button"
              key={asset.id}
              onClick={() => {
                void onOpenExternal(asset.browser_download_url);
              }}
            >
              <span className="download-chip-title">{asset.name}</span>
              <span className="download-chip-meta">Open download</span>
            </button>
          ))
        ) : (
          <div className="message-box compact">
            <p className="muted">
              {loading
                ? "Fetching release assets from GitHub..."
                : error
                  ? "GitRoast could not load release downloads right now."
                  : "No packaged assets are available for the selected release."}
            </p>
          </div>
        )}
      </div>

      {error ? <p className="error-copy">{error}</p> : null}
    </Panel>
  );
}
