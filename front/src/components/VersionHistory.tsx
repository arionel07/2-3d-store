"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getApiErrorMessage,
  isApiConflict,
  listLayoutVersions,
  restoreLayoutVersion,
} from "../lib/api";
import type { LayoutObject, LayoutResponse, LayoutVersion } from "../lib/types";

type VersionHistoryProps = {
  layoutId: string;
  currentVersion: number;
  onRestored: (snapshot: {
    layout: LayoutResponse["layout"];
    objects: LayoutObject[];
    currentVersion: number;
  }) => void;
  onConflict: () => void;
};

function formatSavedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function VersionHistory({
  layoutId,
  currentVersion,
  onRestored,
  onConflict,
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<LayoutVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadVersions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setVersions(await listLayoutVersions(layoutId));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, [layoutId]);

  useEffect(() => {
    void loadVersions();
  }, [currentVersion, loadVersions]);

  async function handleRestore(version: LayoutVersion) {
    if (!window.confirm(`Restore version ${version.version}? This will create a new version.`)) {
      return;
    }

    setRestoringVersion(version.version);
    setError(null);
    try {
      const snapshot = await restoreLayoutVersion(layoutId, version.version, currentVersion);
      onRestored(snapshot);
      await loadVersions();
    } catch (requestError) {
      if (isApiConflict(requestError)) {
        onConflict();
      }
      setError(getApiErrorMessage(requestError));
    } finally {
      setRestoringVersion(null);
    }
  }

  return (
    <section className="version-history" aria-labelledby="version-history-title">
      <div className="version-history-header">
        <div>
          <span className="eyebrow">Audit trail</span>
          <h2 id="version-history-title">Plan history</h2>
          <p>Saved geometry only. Gallery media is not included.</p>
        </div>
        <span className="current-version">Current · v{currentVersion}</span>
      </div>
      {error && <div className="version-error" role="alert">{error}</div>}
      {isLoading ? (
        <div className="version-loading"><div className="spinner" />Loading history…</div>
      ) : versions.length === 0 ? (
        <div className="version-empty">No saved versions yet. Save the plan to create the first snapshot.</div>
      ) : (
        <div className="version-list">
          {versions.map((version) => (
            <article className="version-row" key={version.id}>
              <div className="version-number">v{version.version}</div>
              <div className="version-details">
                <strong>{version.authorName}</strong>
                <span>{formatSavedAt(version.savedAt)} · {version.widthCm} × {version.depthCm} cm</span>
              </div>
              <button
                type="button"
                className="button button-quiet version-restore"
                onClick={() => void handleRestore(version)}
                disabled={restoringVersion !== null || version.version === currentVersion}
              >
                {restoringVersion === version.version ? "Restoring…" : version.version === currentVersion ? "Current" : "Restore"}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
