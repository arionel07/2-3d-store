"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  createLayoutMedia,
  deleteLayoutMedia,
  getApiErrorMessage,
  getMediaAssetUrl,
  uploadLayoutMedia,
} from "../lib/api";
import type { LayoutMedia } from "../lib/types";

type GallerySectionProps = {
  layoutId: string;
  media: LayoutMedia[];
  isLoading: boolean;
  onChange: (media: LayoutMedia[]) => void;
};

type MediaKind = "photo" | "reference";
type SourceMode = "url" | "file";

const emptyForm = {
  kind: "photo" as MediaKind,
  url: "",
  caption: "",
  note: "",
};
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function mediaKindLabel(kind: LayoutMedia["kind"]) {
  return kind === "reference" ? "Идея" : "Фото магазина";
}

function formatMediaDate(createdAt?: string) {
  if (!createdAt) return "Дата не указана";

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "Дата не указана";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function GallerySection({
  layoutId,
  media,
  isLoading,
  onChange,
}: GallerySectionProps) {
  const [activeTab, setActiveTab] = useState<MediaKind>("photo");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [sourceMode, setSourceMode] = useState<SourceMode>("url");
  const [form, setForm] = useState(emptyForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibleMedia = media.filter((item) => item.kind === activeTab);
  const photoCount = media.filter((item) => item.kind !== "reference").length;
  const referenceCount = media.filter((item) => item.kind === "reference").length;

  useEffect(() => {
    if (!isFormOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsFormOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFormOpen]);

  function resetForm() {
    setForm(emptyForm);
    setSelectedFile(null);
    setSourceMode("url");
    setError(null);
  }

  function openForm() {
    setOpenMenuId(null);
    setError(null);
    setIsFormOpen(true);
  }

  function closeForm() {
    resetForm();
    setIsFormOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      if (sourceMode === "file" && !selectedFile) {
        setError("Сначала выберите файл JPEG, PNG или WebP");
        return;
      }

      const created = sourceMode === "file"
        ? await uploadLayoutMedia(layoutId, {
            file: selectedFile as File,
            kind: form.kind,
            caption: form.caption.trim(),
            note: form.note.trim(),
          })
        : await createLayoutMedia(layoutId, {
            ...form,
            url: form.url.trim(),
            caption: form.caption.trim(),
            note: form.note.trim(),
          });

      onChange([...media, created]);
      setActiveTab(form.kind);
      closeForm();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(item: LayoutMedia) {
    setDeletingId(item.id);
    setError(null);
    setOpenMenuId(null);

    try {
      await deleteLayoutMedia(layoutId, item.id);
      onChange(media.filter((entry) => entry.id !== item.id));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setDeletingId(null);
    }
  }

  function confirmDelete(item: LayoutMedia) {
    const label = item.caption || mediaKindLabel(item.kind).toLowerCase();
    if (window.confirm(`Удалить «${label}» из галереи?`)) {
      void handleDelete(item);
    }
  }

  return (
    <section className="gallery-section" aria-labelledby="gallery-title">
      <div className="gallery-header">
        <div>
          <span className="eyebrow">Визуальные материалы</span>
          <h2 id="gallery-title">Галерея</h2>
          <p>Фотографии магазина и идеи оформления в одном месте.</p>
        </div>
        <button
          type="button"
          className="button gallery-add-button"
          onClick={openForm}
          disabled={isLoading}
        >
          <span aria-hidden="true">+</span>
          Добавить изображение
        </button>
      </div>

      <div className="gallery-tabs" role="tablist" aria-label="Тип изображений">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "photo"}
          className={activeTab === "photo" ? "active" : ""}
          onClick={() => setActiveTab("photo")}
        >
          Фото магазина <span>{photoCount}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "reference"}
          className={activeTab === "reference" ? "active" : ""}
          onClick={() => setActiveTab("reference")}
        >
          Идеи <span>{referenceCount}</span>
        </button>
      </div>

      {error && <div className="gallery-error" role="alert">{error}</div>}

      {isLoading ? (
        <div className="gallery-loading">
          <div className="spinner" />
          <span>Загрузка галереи…</span>
        </div>
      ) : visibleMedia.length === 0 ? (
        <div className="gallery-empty">
          <div className="gallery-empty-icon" aria-hidden="true">▧</div>
          <strong>{activeTab === "photo" ? "Фотографий пока нет" : "Идей пока нет"}</strong>
          <p>
            {activeTab === "photo"
              ? "Добавьте первое фото магазина с компьютера или по внешней ссылке."
              : "Сохраните первый референс, чтобы собрать визуальное направление планировки."}
          </p>
          <button type="button" className="button gallery-empty-action" onClick={openForm}>
            + Добавить изображение
          </button>
        </div>
      ) : (
        <div className="gallery-grid">
          {visibleMedia.map((item) => (
            <article className="media-card" key={item.id}>
              <div className="media-image-wrap">
                <img src={getMediaAssetUrl(item.url)} alt={item.caption || mediaKindLabel(item.kind)} loading="lazy" />
                <span className={`media-kind ${item.kind === "reference" ? "reference" : "photo"}`}>
                  {mediaKindLabel(item.kind)}
                </span>
              </div>
              <div className="media-card-content">
                <div className="media-card-heading">
                  <strong>{item.caption || "Изображение без подписи"}</strong>
                  <div className="media-menu-wrap">
                    <button
                      type="button"
                      className="media-menu"
                      aria-label={`Действия: ${item.caption || "изображение"}`}
                      aria-expanded={openMenuId === item.id}
                      onClick={() => setOpenMenuId((current) => current === item.id ? null : item.id)}
                    >
                      ···
                    </button>
                    {openMenuId === item.id && (
                      <div className="media-menu-popover">
                        <button type="button" onClick={() => confirmDelete(item)} disabled={deletingId === item.id}>
                          {deletingId === item.id ? "Удаление…" : "Удалить изображение"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="media-card-meta">
                  <span>{mediaKindLabel(item.kind)}</span>
                  <span>·</span>
                  <time dateTime={item.createdAt}>{formatMediaDate(item.createdAt)}</time>
                </div>
                {item.note && <p>{item.note}</p>}
              </div>
            </article>
          ))}
        </div>
      )}

      {isFormOpen && (
        <div className="gallery-dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeForm();
        }}>
          <form className="gallery-dialog" role="dialog" aria-modal="true" aria-labelledby="gallery-dialog-title" onSubmit={(event) => void handleSubmit(event)}>
            <div className="gallery-dialog-header">
              <div>
                <span className="eyebrow">Новый материал</span>
                <h3 id="gallery-dialog-title">Добавить изображение</h3>
              </div>
              <button type="button" className="icon-button" onClick={closeForm} aria-label="Закрыть">×</button>
            </div>
            <div className="gallery-source-switch" aria-label="Источник изображения">
              <button
                type="button"
                className={sourceMode === "file" ? "active" : ""}
                onClick={() => {
                  setSourceMode("file");
                  setError(null);
                }}
              >
                С компьютера
              </button>
              <button
                type="button"
                className={sourceMode === "url" ? "active" : ""}
                onClick={() => {
                  setSourceMode("url");
                  setSelectedFile(null);
                  setError(null);
                }}
              >
                По ссылке
              </button>
            </div>
            <div className="gallery-form-grid">
              {sourceMode === "url" ? (
                <label className="modal-field gallery-url-field" key="external-url">
                  <span>Ссылка на изображение</span>
                  <input
                    required
                    type="url"
                    value={form.url}
                    onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
                    placeholder="https://example.com/store-photo.jpg"
                  />
                </label>
              ) : (
                <label className="modal-field gallery-url-field" key="local-file">
                  <span>Файл изображения <em>JPEG, PNG или WebP · максимум 10 МБ</em></span>
                  <input
                    required
                    type="file"
                    accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      if (file && file.size > MAX_UPLOAD_BYTES) {
                        setSelectedFile(null);
                        setError("Размер изображения не должен превышать 10 МБ");
                        return;
                      }
                      setError(null);
                      setSelectedFile(file);
                    }}
                  />
                  {selectedFile && <small className="selected-file">Выбран файл: {selectedFile.name}</small>}
                </label>
              )}
              <label className="modal-field">
                <span>Тип</span>
                <select
                  value={form.kind}
                  onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as MediaKind }))}
                >
                  <option value="photo">Фото магазина</option>
                  <option value="reference">Идея</option>
                </select>
              </label>
              <label className="modal-field">
                <span>Подпись</span>
                <input
                  value={form.caption}
                  onChange={(event) => setForm((current) => ({ ...current, caption: event.target.value }))}
                  placeholder="Витрина у входа"
                />
              </label>
              <label className="modal-field gallery-note-field">
                <span>Заметка</span>
                <textarea
                  rows={3}
                  value={form.note}
                  onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                  placeholder="На что команде обратить внимание?"
                />
              </label>
            </div>
            <div className="gallery-form-actions">
              <button type="button" className="button button-quiet" onClick={closeForm}>Отмена</button>
              <button type="submit" className="button gallery-add-button" disabled={isSaving}>
                {isSaving ? "Добавление…" : "Добавить изображение"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
