"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { Group, Layer, Line, Rect, Stage } from "react-konva";
import { getLayout } from "../lib/api";
import type { LayoutObject, LayoutSummary, Store } from "../lib/types";

type StoreCardProps = {
  store: Store;
  onOpenLayout: (storeId: string, layoutId: string) => void;
  onCreateLayout: (storeId: string) => void;
};

type LayoutPreviewProps = {
  layout: LayoutSummary;
  objects: LayoutObject[];
};

const PREVIEW_WIDTH = 400;
const PREVIEW_HEIGHT = 270;
const PREVIEW_PADDING = 22;

function formatNumber(value: number) {
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function formatLayoutSize(layout: LayoutSummary) {
  return `${formatNumber(layout.widthCm / 100)} × ${formatNumber(layout.depthCm / 100)} м`;
}

function formatUpdatedAt(value?: string) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDifference = Math.round((startOfToday - startOfDate) / 86_400_000);

  if (dayDifference === 0) return "Изменён сегодня";
  if (dayDifference === 1) return "Изменён вчера";

  return `Изменён ${date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }).replace(" г.", "")}`;
}

function LayoutPreview({ layout, objects }: LayoutPreviewProps) {
  const scale = Math.min(
    (PREVIEW_WIDTH - PREVIEW_PADDING * 2) / layout.widthCm,
    (PREVIEW_HEIGHT - PREVIEW_PADDING * 2) / layout.depthCm,
  );
  const roomWidth = layout.widthCm * scale;
  const roomDepth = layout.depthCm * scale;
  const roomX = (PREVIEW_WIDTH - roomWidth) / 2;
  const roomY = (PREVIEW_HEIGHT - roomDepth) / 2;

  return (
    <Stage
      width={PREVIEW_WIDTH}
      height={PREVIEW_HEIGHT}
      listening={false}
      style={{ width: "100%", height: "100%" }}
    >
      <Layer>
        <Rect
          x={roomX}
          y={roomY}
          width={roomWidth}
          height={roomDepth}
          fill="#ffffff"
          stroke="#6b777b"
          strokeWidth={2}
          cornerRadius={2}
        />
        {Array.from({ length: Math.floor(layout.widthCm / 100) + 1 }, (_, index) => {
          const x = roomX + Math.min(index * 100 * scale, roomWidth);
          return <Line key={`vertical-${index}`} points={[x, roomY, x, roomY + roomDepth]} stroke="#e9edef" strokeWidth={0.7} listening={false} />;
        })}
        {Array.from({ length: Math.floor(layout.depthCm / 100) + 1 }, (_, index) => {
          const y = roomY + Math.min(index * 100 * scale, roomDepth);
          return <Line key={`horizontal-${index}`} points={[roomX, y, roomX + roomWidth, y]} stroke="#e9edef" strokeWidth={0.7} listening={false} />;
        })}
        {objects.slice(0, 80).map((object) => (
          <Group
            key={object.id}
            x={roomX + (object.xCm + object.widthCm / 2) * scale}
            y={roomY + (object.yCm + object.depthCm / 2) * scale}
            offsetX={(object.widthCm * scale) / 2}
            offsetY={(object.depthCm * scale) / 2}
            rotation={object.rotationDeg}
          >
            <Rect
              width={Math.max(3, object.widthCm * scale)}
              height={Math.max(3, object.depthCm * scale)}
              fill="#e7ecec"
              stroke="#8b989b"
              strokeWidth={1}
              cornerRadius={1}
            />
          </Group>
        ))}
      </Layer>
    </Stage>
  );
}

export default function StoreCard({ store, onOpenLayout, onCreateLayout }: StoreCardProps) {
  const [preview, setPreview] = useState<{ layout: LayoutSummary; objects: LayoutObject[] } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(store.layouts.length > 0);
  const [previewError, setPreviewError] = useState(false);
  const firstLayout = store.layouts[0];

  useEffect(() => {
    let isActive = true;

    if (!firstLayout) {
      setPreview(null);
      setIsLoadingPreview(false);
      return () => {
        isActive = false;
      };
    }

    setIsLoadingPreview(true);
    setPreviewError(false);
    void getLayout(firstLayout.id)
      .then((response) => {
        if (!isActive) return;
        setPreview({ layout: response.layout, objects: response.objects });
      })
      .catch(() => {
        if (isActive) setPreviewError(true);
      })
      .finally(() => {
        if (isActive) setIsLoadingPreview(false);
      });

    return () => {
      isActive = false;
    };
  }, [firstLayout]);

  const openFirstLayout = () => {
    if (firstLayout) onOpenLayout(store.id, firstLayout.id);
  };
  const layoutSizes = store.layouts.map(formatLayoutSize).join(" · ");
  const updatedAtLabel = formatUpdatedAt(firstLayout?.updatedAt ?? store.updatedAt);

  return (
    <article className={`store-card ${firstLayout ? "has-layout" : "without-layout"}`}>
      {firstLayout ? (
        <button type="button" className="store-card-open" onClick={openFirstLayout} aria-label={`Открыть магазин ${store.name}`}>
          <div className="store-plan-thumbnail">
            {isLoadingPreview ? <span className="store-thumbnail-state">Загрузка плана…</span> : previewError || !preview ? <span className="store-thumbnail-state">Превью недоступно</span> : <LayoutPreview layout={preview.layout} objects={preview.objects} />}
          </div>
          <div className="store-card-content">
            <div className="store-card-title"><strong>{store.name}</strong><ChevronRight aria-hidden="true" /></div>
            <p>{store.address || "Адрес не указан"} <span>·</span> {store.layouts.length} {store.layouts.length === 1 ? "планировка" : store.layouts.length < 5 ? "планировки" : "планировок"}</p>
            <div className="store-card-meta"><span>{layoutSizes}</span>{updatedAtLabel && <span>{updatedAtLabel}</span>}</div>
          </div>
        </button>
      ) : (
        <div className="store-card-empty">
          <div className="store-plan-thumbnail empty"><span>Планировок пока нет</span></div>
          <div className="store-card-content">
            <div className="store-card-title"><strong>{store.name}</strong><ChevronRight aria-hidden="true" /></div>
            <p>{store.address || "Адрес не указан"} <span>·</span> Планировок пока нет</p>
            <button type="button" className="store-card-create" onClick={() => onCreateLayout(store.id)}><Plus aria-hidden="true" />Создать планировку</button>
          </div>
        </div>
      )}
    </article>
  );
}
