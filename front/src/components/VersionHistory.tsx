"use client";

import { useCallback, useEffect, useState } from "react";
import { Group, Layer, Rect, Stage } from "react-konva";
import {
  getApiErrorMessage,
  isApiConflict,
  listLayoutVersions,
  restoreLayoutVersion,
} from "../lib/api";
import type { LayoutObject, LayoutResponse, LayoutVersion, LayoutVersionObject } from "../lib/types";

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

const PREVIEW_WIDTH = 220;
const PREVIEW_HEIGHT = 132;
const PREVIEW_PADDING = 13;

function formatSavedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Дата не указана";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatRoomSize(widthCm: number, depthCm: number) {
  const format = (value: number) => (value / 100).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
  return `${format(widthCm)} × ${format(depthCm)} м`;
}

function VersionThumbnail({ version }: { version: LayoutVersion }) {
  const scale = Math.min(
    (PREVIEW_WIDTH - PREVIEW_PADDING * 2) / version.widthCm,
    (PREVIEW_HEIGHT - PREVIEW_PADDING * 2) / version.depthCm,
  );
  const roomWidth = version.widthCm * scale;
  const roomDepth = version.depthCm * scale;
  const roomX = (PREVIEW_WIDTH - roomWidth) / 2;
  const roomY = (PREVIEW_HEIGHT - roomDepth) / 2;

  return (
    <div className="version-thumbnail" aria-label={`Миниатюра версии ${version.version}`}>
      <Stage width={PREVIEW_WIDTH} height={PREVIEW_HEIGHT} listening={false} style={{ width: "100%", height: "100%" }}>
        <Layer>
          <Rect x={roomX} y={roomY} width={roomWidth} height={roomDepth} fill="#ffffff" stroke="#6b777b" strokeWidth={1.5} cornerRadius={2} />
          {version.objects.map((object: LayoutVersionObject) => (
            <Group
              key={object.id}
              x={roomX + (object.xCm + object.widthCm / 2) * scale}
              y={roomY + (object.yCm + object.depthCm / 2) * scale}
              offsetX={(object.widthCm * scale) / 2}
              offsetY={(object.depthCm * scale) / 2}
              rotation={object.rotationDeg}
            >
              <Rect
                width={Math.max(2, object.widthCm * scale)}
                height={Math.max(2, object.depthCm * scale)}
                fill="#e3e8e8"
                stroke="#899698"
                strokeWidth={0.8}
                cornerRadius={1}
              />
            </Group>
          ))}
        </Layer>
      </Stage>
    </div>
  );
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
    if (!window.confirm(`Восстановить версию ${version.version}? Будет создана новая версия.`)) {
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
          <span className="eyebrow">Журнал изменений</span>
          <h2 id="version-history-title">История планировки</h2>
          <p>Сохранённые версии этого плана</p>
        </div>
        <button type="button" className="version-refresh" onClick={() => void loadVersions()} disabled={isLoading}>
          <span aria-hidden="true">↻</span> Обновить
        </button>
      </div>
      {error && <div className="version-error" role="alert">{error}</div>}
      {isLoading ? (
        <div className="version-loading"><div className="spinner" />Загрузка истории…</div>
      ) : versions.length === 0 ? (
        <div className="version-empty">Сохранённых версий пока нет. Сохраните план, чтобы создать первый снимок.</div>
      ) : (
        <div className="version-list">
          {versions.map((version) => {
            const isCurrent = version.version === currentVersion;
            return (
              <article className={`version-row ${isCurrent ? "current" : ""}`} key={version.id}>
                <VersionThumbnail version={version} />
                <div className="version-details">
                  <div className="version-title">
                    <strong>Версия {version.version}</strong>
                    {isCurrent && <span className="version-current-badge">Текущая</span>}
                  </div>
                  <span>{formatSavedAt(version.savedAt)} <b>·</b> {version.authorName || version.authorEmail}</span>
                  <span>{formatRoomSize(version.widthCm, version.depthCm)} <b>·</b> {version.objects.length} {version.objects.length === 1 ? "объект" : version.objects.length < 5 ? "объекта" : "объектов"}</span>
                </div>
                {!isCurrent && (
                  <button
                    type="button"
                    className="button button-quiet version-restore"
                    onClick={() => void handleRestore(version)}
                    disabled={restoringVersion !== null}
                  >
                    {restoringVersion === version.version ? "Восстановление…" : "Восстановить"}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
