"use client";

import { useState, type FormEvent } from "react";
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

const emptyForm = {
  kind: "photo" as "photo" | "reference",
  url: "",
  caption: "",
  note: "",
};
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function mediaKindLabel(kind: LayoutMedia["kind"]) {
  return kind === "reference" ? "Reference" : "Store photo";
}

export default function GallerySection({
  layoutId,
  media,
  isLoading,
  onChange,
}: GallerySectionProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [sourceMode, setSourceMode] = useState<"url" | "file">("url");
  const [form, setForm] = useState(emptyForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      if (sourceMode === "file" && !selectedFile) {
        setError("Choose a JPEG, PNG, or WebP file first");
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
      setForm(emptyForm);
      setSelectedFile(null);
      setIsFormOpen(false);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(item: LayoutMedia) {
    setDeletingId(item.id);
    setError(null);

    try {
      await deleteLayoutMedia(layoutId, item.id);
      onChange(media.filter((entry) => entry.id !== item.id));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="gallery-section" aria-labelledby="gallery-title">
      <div className="gallery-header">
        <div>
          <span className="eyebrow">References</span>
          <h2 id="gallery-title">Gallery</h2>
          <p>Keep store photos and visual references close to the plan.</p>
        </div>
        <button
          type="button"
          className="button button-quiet"
          onClick={() => {
            setError(null);
            setIsFormOpen((current) => !current);
          }}
          disabled={isLoading}
        >
          {isFormOpen ? "Close" : "+ Add image"}
        </button>
      </div>

      {error && <div className="gallery-error">{error}</div>}

      {isFormOpen && (
        <form className="gallery-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="gallery-source-switch" aria-label="Image source">
            <button
              type="button"
              className={sourceMode === "url" ? "active" : ""}
              onClick={() => {
                setSourceMode("url");
                setError(null);
              }}
            >
              External URL
            </button>
            <button
              type="button"
              className={sourceMode === "file" ? "active" : ""}
              onClick={() => {
                setSourceMode("file");
                setError(null);
              }}
            >
              From computer
            </button>
          </div>
          <div className="gallery-form-grid">
            {sourceMode === "url" ? (
              <label className="modal-field gallery-url-field" key="external-url">
                <span>Image URL</span>
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
                <span>Image file <em>JPEG, PNG or WebP · max 10 MB</em></span>
                <input
                  required
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    if (file && file.size > MAX_UPLOAD_BYTES) {
                      setSelectedFile(null);
                      setError("Image must be 10 MB or smaller");
                      return;
                    }
                    setError(null);
                    setSelectedFile(file);
                  }}
                />
                {selectedFile && <small className="selected-file">Selected: {selectedFile.name}</small>}
              </label>
            )}
            <label className="modal-field">
              <span>Type</span>
              <select
                value={form.kind}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  kind: event.target.value as "photo" | "reference",
                }))}
              >
                <option value="photo">Store photo</option>
                <option value="reference">Reference</option>
              </select>
            </label>
            <label className="modal-field">
              <span>Caption</span>
              <input
                value={form.caption}
                onChange={(event) => setForm((current) => ({ ...current, caption: event.target.value }))}
                placeholder="Entrance display"
              />
            </label>
            <label className="modal-field gallery-note-field">
              <span>Note</span>
              <textarea
                rows={2}
                value={form.note}
                onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="What should the team notice?"
              />
            </label>
          </div>
          <div className="gallery-form-actions">
            <button
              type="button"
              className="button button-quiet"
              onClick={() => {
                setForm(emptyForm);
                setSelectedFile(null);
                setIsFormOpen(false);
              }}
            >
              Cancel
            </button>
            <button type="submit" className="button button-primary" disabled={isSaving}>
              {isSaving ? "Adding…" : "Add image"}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="gallery-loading">
          <div className="spinner" />
          <span>Loading gallery…</span>
        </div>
      ) : media.length === 0 ? (
        <div className="gallery-empty">
          <div className="gallery-empty-icon" aria-hidden="true">▧</div>
          <strong>No images yet</strong>
          <p>Add a store photo or reference by URL to keep visual context with this plan.</p>
        </div>
      ) : (
        <div className="gallery-grid">
          {media.map((item) => (
            <article className="media-card" key={item.id}>
              <div className="media-image-wrap">
                <img src={getMediaAssetUrl(item.url)} alt={item.caption || mediaKindLabel(item.kind)} loading="lazy" />
                <span className={`media-kind ${item.kind === "reference" ? "reference" : "photo"}`}>
                  {mediaKindLabel(item.kind)}
                </span>
              </div>
              <div className="media-card-content">
                <div className="media-card-heading">
                  <strong>{item.caption || "Untitled image"}</strong>
                  <button
                    type="button"
                    className="media-delete"
                    onClick={() => void handleDelete(item)}
                    disabled={deletingId === item.id}
                    aria-label={`Delete ${item.caption || "image"}`}
                  >
                    {deletingId === item.id ? "…" : "×"}
                  </button>
                </div>
                {item.note && <p>{item.note}</p>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
