"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import PlanCanvas from "../components/PlanCanvas";
import GallerySection from "../components/GallerySection";
import LoginForm from "../components/LoginForm";
import VersionHistory from "../components/VersionHistory";
import {
  createLayout,
  createStore,
  getSession,
  getApiErrorMessage,
  getLayout,
  isApiConflict,
  listStores,
  saveLayoutObjects,
  signOut,
} from "../lib/api";
import { isObjectValid } from "../lib/geometry";
import type {
  LayoutMedia,
  LayoutObject,
  LayoutResponse,
  Store,
} from "../lib/types";
import type { AuthUser } from "../lib/api";

const Scene3D = dynamic(() => import("../components/Scene3D"), {
  ssr: false,
  loading: () => <div className="scene-loading">Preparing the 3D view…</div>,
});

type ViewMode = "2d" | "3d";
type SaveState = "saved" | "unsaved" | "saving" | "error";
type AuthState = "loading" | "authenticated" | "unauthenticated";

const objectPresets = [
  { type: "shelf", label: "Shelf", icon: "▤", widthCm: 180, depthCm: 60, heightCm: 180 },
  { type: "checkout", label: "Checkout", icon: "▥", widthCm: 140, depthCm: 80, heightCm: 100 },
  { type: "display", label: "Display", icon: "◫", widthCm: 120, depthCm: 80, heightCm: 160 },
] as const;

function makeObjectId() {
  return globalThis.crypto?.randomUUID?.() ?? `object-${Date.now()}`;
}

function countLabel(value: number, singular: string) {
  return `${value} ${value === 1 ? singular : `${singular}s`}`;
}

export default function Home() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [layoutData, setLayoutData] = useState<LayoutResponse | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("2d");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingLayout, setIsLoadingLayout] = useState(false);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storeForm, setStoreForm] = useState({ name: "", address: "" });
  const [layoutForm, setLayoutForm] = useState({ name: "Main floor", widthCm: "1200", depthCm: "800" });

  useEffect(() => {
    let isActive = true;

    void getSession()
      .then((response) => {
        if (!isActive) return;
        setAuthUser(response?.user ?? null);
        setAuthState(response?.user ? "authenticated" : "unauthenticated");
      })
      .catch(() => {
        if (!isActive) return;
        setAuthState("unauthenticated");
      });

    return () => {
      isActive = false;
    };
  }, []);

  const selectedStore = stores.find((store) => store.id === selectedStoreId);
  const selectedLayout = selectedStore?.layouts.find((layout) => layout.id === selectedLayoutId);
  const selectedObject = layoutData?.objects.find((object) => object.id === selectedObjectId);

  const validity = useMemo(() => {
    const result: Record<string, boolean> = {};
    if (!layoutData) return result;
    for (const object of layoutData.objects) {
      result[object.id] = isObjectValid(object, layoutData.objects, layoutData.layout);
    }
    return result;
  }, [layoutData]);

  const refreshStores = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const nextStores = await listStores();
      setStores(nextStores);
      setSelectedStoreId((current) => current ?? nextStores[0]?.id ?? null);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadLayout = useCallback(async (layoutId: string) => {
    setIsLoadingLayout(true);
    setError(null);
    try {
      const response = await getLayout(layoutId);
      setLayoutData(response);
      setSelectedObjectId(response.objects[0]?.id ?? null);
      setSaveState("saved");
      setHasConflict(false);
    } catch (requestError) {
      setLayoutData(null);
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoadingLayout(false);
    }
  }, []);

  useEffect(() => {
    if (authState === "authenticated") {
      void refreshStores();
    }
  }, [authState, refreshStores]);

  useEffect(() => {
    if (!selectedStore) {
      setSelectedLayoutId(null);
      setLayoutData(null);
      return;
    }
    const hasSelectedLayout = selectedStore.layouts.some((layout) => layout.id === selectedLayoutId);
    if (!hasSelectedLayout) setSelectedLayoutId(selectedStore.layouts[0]?.id ?? null);
  }, [selectedLayoutId, selectedStore]);

  useEffect(() => {
    if (selectedLayoutId && selectedLayoutId !== layoutData?.layout.id) void loadLayout(selectedLayoutId);
  }, [layoutData?.layout.id, loadLayout, selectedLayoutId]);

  function selectStore(storeId: string) {
    setSelectedStoreId(storeId);
    setSelectedObjectId(null);
    setError(null);
    setHasConflict(false);
  }

  function selectLayout(layoutId: string) {
    setSelectedLayoutId(layoutId);
    setSelectedObjectId(null);
    setError(null);
    setHasConflict(false);
  }

  async function handleCreateStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const store = await createStore(storeForm);
      setStores((current) => [...current, store]);
      setSelectedStoreId(store.id);
      setSelectedLayoutId(null);
      setLayoutData(null);
      setStoreForm({ name: "", address: "" });
      setIsStoreModalOpen(false);
      setIsLayoutModalOpen(true);
      setError(null);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  }

  async function handleCreateLayout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStoreId) return;
    try {
      const layout = await createLayout(selectedStoreId, {
        name: layoutForm.name,
        widthCm: Number.parseInt(layoutForm.widthCm, 10),
        depthCm: Number.parseInt(layoutForm.depthCm, 10),
      });
      setStores((current) => current.map((store) => store.id === selectedStoreId
        ? { ...store, layouts: [...store.layouts, layout] }
        : store));
      setSelectedLayoutId(layout.id);
      setLayoutData(null);
      setIsLayoutModalOpen(false);
      setError(null);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  }

  function updateObject(id: string, changes: Partial<LayoutObject>) {
    setLayoutData((current) => current
      ? { ...current, objects: current.objects.map((object) => object.id === id ? { ...object, ...changes } : object) }
      : current);
    setSaveState("unsaved");
    setHasConflict(false);
  }

  function updateNumericObjectField(field: "xCm" | "yCm" | "widthCm" | "depthCm" | "heightCm" | "rotationDeg", value: string) {
    if (!selectedObject) return;
    const parsedValue = Number.parseInt(value, 10);
    updateObject(selectedObject.id, { [field]: Number.isNaN(parsedValue) ? 0 : parsedValue });
  }

  function addObject(preset: (typeof objectPresets)[number]) {
    if (!layoutData) return;
    const offset = (layoutData.objects.length * 40) % 240;
    const object: LayoutObject = {
      id: makeObjectId(),
      layoutId: layoutData.layout.id,
      type: preset.type,
      name: preset.label,
      xCm: 80 + offset,
      yCm: 80 + offset,
      widthCm: preset.widthCm,
      depthCm: preset.depthCm,
      heightCm: preset.heightCm,
      rotationDeg: 0,
    };
    setLayoutData((current) => current ? { ...current, objects: [...current.objects, object] } : current);
    setSelectedObjectId(object.id);
    setSaveState("unsaved");
    setHasConflict(false);
  }

  function removeSelectedObject() {
    if (!selectedObject) return;
    setLayoutData((current) => current ? { ...current, objects: current.objects.filter((object) => object.id !== selectedObject.id) } : current);
    setSelectedObjectId(null);
    setSaveState("unsaved");
    setHasConflict(false);
  }

  function updateMedia(media: LayoutMedia[]) {
    setLayoutData((current) => (current ? { ...current, media } : current));
  }

  function rotateSelectedObject() {
    if (!selectedObject) return;
    updateObject(selectedObject.id, { rotationDeg: (selectedObject.rotationDeg + 90) % 360 });
  }

  async function saveObjects() {
    if (!layoutData) return;
    setSaveState("saving");
    setError(null);
    try {
      const response = await saveLayoutObjects(
        layoutData.layout.id,
        layoutData.currentVersion,
        layoutData.objects,
      );
      setLayoutData((current) => current ? {
        ...current,
        objects: response.objects,
        currentVersion: response.currentVersion,
      } : current);
      setSelectedObjectId((current) => response.objects.some((object) => object.id === current) ? current : response.objects[0]?.id ?? null);
      setSaveState("saved");
      setHasConflict(false);
    } catch (requestError) {
      setSaveState("error");
      if (isApiConflict(requestError)) {
        setHasConflict(true);
        setError("This plan changed in another session. Reload the latest version before saving.");
      } else {
        setError(getApiErrorMessage(requestError));
      }
    }
  }

  function handleRestored(snapshot: {
    layout: LayoutResponse["layout"];
    objects: LayoutObject[];
    currentVersion: number;
  }) {
    setLayoutData((current) => current ? {
      ...current,
      layout: snapshot.layout,
      objects: snapshot.objects,
      currentVersion: snapshot.currentVersion,
    } : current);
    setSelectedObjectId(snapshot.objects[0]?.id ?? null);
    setSaveState("saved");
    setHasConflict(false);
    setError(null);
  }

  async function handleSignOut() {
    try {
      await signOut();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
      return;
    }

    setAuthUser(null);
    setAuthState("unauthenticated");
    setStores([]);
    setSelectedStoreId(null);
    setSelectedLayoutId(null);
    setLayoutData(null);
  }

  const saveLabel = { saved: "All changes saved", unsaved: "Unsaved changes", saving: "Saving…", error: "Save failed" }[saveState];

  if (authState === "loading") {
    return <main className="auth-shell"><div className="spinner" aria-label="Checking session" /></main>;
  }

  if (authState === "unauthenticated") {
    return <LoginForm onAuthenticated={(user) => { setAuthUser(user); setAuthState("authenticated"); }} />;
  }

  return (
    <main className="planner-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <div><strong>Store Layout Planner</strong><span>Vizaje-Nica workspace</span></div>
        </div>
        {layoutData ? (
          <div className="view-switch" aria-label="View mode">
            <button type="button" className={viewMode === "2d" ? "active" : ""} onClick={() => setViewMode("2d")} aria-pressed={viewMode === "2d"}>2D plan</button>
            <button type="button" className={viewMode === "3d" ? "active" : ""} onClick={() => setViewMode("3d")} aria-pressed={viewMode === "3d"}>3D view</button>
          </div>
        ) : <span className="topbar-note">Internal planning tool</span>}
        <div className="topbar-account">
          <span className="account-name">{authUser?.name ?? authUser?.email}</span>
          <button type="button" className="signout-button" onClick={() => void handleSignOut()}>Sign out</button>
        </div>
        <div className={`save-indicator ${saveState}`}><span className="status-dot" /><span>{saveLabel}</span></div>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <div className="sidebar-heading">
            <div><span className="eyebrow">Workspace</span><h1>Stores</h1></div>
            <button type="button" className="icon-button" onClick={() => setIsStoreModalOpen(true)} aria-label="Create store" title="Create store">+</button>
          </div>
          {isLoading ? <div className="sidebar-loading">Loading stores…</div> : stores.length === 0 ? (
            <div className="sidebar-empty">
              <div className="empty-icon">⌂</div><strong>No stores yet</strong><p>Create a store to begin planning a layout.</p>
              <button type="button" className="button button-primary button-full" onClick={() => setIsStoreModalOpen(true)}>+ New store</button>
            </div>
          ) : (
            <div className="store-list">
              {stores.map((store) => (
                <div key={store.id} className="store-group">
                  <button type="button" className={`store-row ${selectedStoreId === store.id ? "selected" : ""}`} onClick={() => selectStore(store.id)}>
                    <span className="store-avatar">{store.name.slice(0, 1).toUpperCase()}</span>
                    <span className="store-row-copy"><strong>{store.name}</strong><small>{countLabel(store.layouts.length, "layout")}</small></span><span className="chevron">›</span>
                  </button>
                  {selectedStoreId === store.id && <div className="layout-list">
                    {store.layouts.map((layout) => (
                      <button type="button" key={layout.id} className={`layout-row ${selectedLayoutId === layout.id ? "selected" : ""}`} onClick={() => selectLayout(layout.id)}>
                        <span className="layout-glyph">□</span><span><strong>{layout.name}</strong><small>{layout.widthCm} × {layout.depthCm} cm</small></span>
                      </button>
                    ))}
                    <button type="button" className="layout-add" onClick={() => setIsLayoutModalOpen(true)}>+ New layout</button>
                  </div>}
                </div>
              ))}
            </div>
          )}
          {stores.length > 0 && <button type="button" className="sidebar-create" onClick={() => setIsStoreModalOpen(true)}>+ New store</button>}
          <div className="sidebar-footer"><span className="footer-dot" /><span>Local workspace</span></div>
        </aside>

        <section className="workspace">
          {error && <div className="error-banner"><span>{error}</span>{hasConflict && layoutData && <button type="button" className="button button-quiet conflict-reload" onClick={() => void loadLayout(layoutData.layout.id)}>Reload latest</button>}</div>}
          {!selectedStore ? (
            <div className="workspace-empty"><div className="empty-illustration" aria-hidden="true"><span /><span /><span /></div><span className="eyebrow">Start with a store</span><h2>Plan a better floor, faster.</h2><p>Add a store and create a first layout to place shelves, checkout counters and displays in centimeters.</p><button type="button" className="button button-primary" onClick={() => setIsStoreModalOpen(true)}>+ Create your first store</button></div>
          ) : !selectedLayout ? (
            <div className="workspace-empty"><div className="empty-illustration layout-empty-icon" aria-hidden="true">□</div><span className="eyebrow">{selectedStore.name}</span><h2>Create the first layout.</h2><p>Define the room dimensions, then add simple plan objects and check their fit before saving.</p><button type="button" className="button button-primary" onClick={() => setIsLayoutModalOpen(true)}>+ Create layout</button></div>
          ) : isLoadingLayout || !layoutData ? (
            <>
              <div className="workspace-empty"><div className="spinner" /><p>Loading {selectedLayout.name}…</p></div>
              <GallerySection
                key={selectedLayout.id}
                layoutId={selectedLayout.id}
                media={[]}
                isLoading
                onChange={updateMedia}
              />
            </>
          ) : (
            <>
              <div className="workspace-header">
                <div><div className="breadcrumb"><span>{selectedStore.name}</span><b>/</b><strong>{layoutData.layout.name}</strong></div><p>{layoutData.layout.widthCm} × {layoutData.layout.depthCm} cm room</p></div>
                <div className="workspace-actions"><div className="toolbar-group">{objectPresets.map((preset) => <button type="button" key={preset.type} className="tool-button" onClick={() => addObject(preset)} title={`Add ${preset.label.toLowerCase()}`}><span>{preset.icon}</span>{preset.label}</button>)}</div><button type="button" className="button button-primary save-button" onClick={() => void saveObjects()} disabled={saveState === "saving"}>{saveState === "saving" ? "Saving…" : "Save plan"}</button></div>
              </div>
              <div className="editor-grid">
                <div className="canvas-panel">
                  <div className="canvas-toolbar"><span className="canvas-title">{viewMode === "2d" ? "Plan canvas" : "Approximate 3D"}</span><span className="canvas-help">{viewMode === "2d" ? "Drag objects to place them. Dimensions stay in cm." : "Derived from the 2D plan."}</span></div>
                  {viewMode === "2d" ? <PlanCanvas room={layoutData.layout} objects={layoutData.objects} selectedObjectId={selectedObjectId} validity={validity} onSelect={setSelectedObjectId} onMove={(id, xCm, yCm) => updateObject(id, { xCm, yCm })} /> : <div className="scene-3d"><Scene3D room={layoutData.layout} objects={layoutData.objects} /></div>}
                  <div className="canvas-legend"><span><i className="legend-dot valid" /> Fits in room</span><span><i className="legend-dot invalid" /> Needs attention</span><span className="legend-note">Grid: 50 cm</span></div>
                </div>
                <aside className="inspector">
                  {selectedObject ? <>
                    <div className="inspector-heading"><div><span className="eyebrow">Selected object</span><input className="object-name-input" value={selectedObject.name} onChange={(event) => updateObject(selectedObject.id, { name: event.target.value })} aria-label="Object name" /></div><button type="button" className="icon-button danger" onClick={removeSelectedObject} aria-label="Remove selected object" title="Remove object">×</button></div>
                    <div className={`fit-status ${validity[selectedObject.id] ? "valid" : "invalid"}`}><span>{validity[selectedObject.id] ? "✓" : "!"}</span><div><strong>{validity[selectedObject.id] ? "Valid placement" : "Needs attention"}</strong><small>{validity[selectedObject.id] ? "Fits within the room without overlap." : "Move or resize this object to resolve the overlap."}</small></div></div>
                    <div className="inspector-section"><div className="section-title">Dimensions <span>(cm)</span></div><div className="field-grid three-columns">{(["widthCm", "depthCm", "heightCm"] as const).map((field) => <label key={field}><span>{field.replace("Cm", "")}</span><input type="number" min="1" value={selectedObject[field]} onChange={(event) => updateNumericObjectField(field, event.target.value)} /></label>)}</div></div>
                    <div className="inspector-section"><div className="section-title">Position <span>(cm)</span></div><div className="field-grid two-columns">{(["xCm", "yCm"] as const).map((field) => <label key={field}><span>{field === "xCm" ? "X from left" : "Y from top"}</span><input type="number" value={selectedObject[field]} onChange={(event) => updateNumericObjectField(field, event.target.value)} /></label>)}</div></div>
                    <div className="inspector-section rotation-section"><div className="section-title">Rotation <span>(°)</span></div><div className="rotation-control"><input type="number" value={selectedObject.rotationDeg} onChange={(event) => updateNumericObjectField("rotationDeg", event.target.value)} /><button type="button" className="rotate-button" onClick={rotateSelectedObject} title="Rotate 90 degrees">↻</button></div></div>
                    <div className="inspector-footer"><span className="type-label">Type</span><span className="type-value">{selectedObject.type}</span></div>
                  </> : <div className="inspector-empty"><div className="inspector-empty-icon">⌁</div><strong>Select an object</strong><p>Choose an object on the canvas to edit its size, position and rotation.</p></div>}
                </aside>
              </div>
              <VersionHistory
                layoutId={layoutData.layout.id}
                currentVersion={layoutData.currentVersion}
                onRestored={handleRestored}
                onConflict={() => {
                  setHasConflict(true);
                  setError("This plan changed in another session. Reload the latest version before restoring.");
                }}
              />
              <GallerySection
                layoutId={layoutData.layout.id}
                media={layoutData.media}
                isLoading={false}
                onChange={updateMedia}
              />
            </>
          )}
        </section>
      </div>

      {isStoreModalOpen && <div className="modal-backdrop" role="presentation"><form className="modal-card" onSubmit={(event) => void handleCreateStore(event)}><div className="modal-header"><div><span className="eyebrow">New workspace</span><h2>Create a store</h2></div><button type="button" className="icon-button" onClick={() => setIsStoreModalOpen(false)} aria-label="Close">×</button></div><label className="modal-field"><span>Store name</span><input required autoFocus value={storeForm.name} onChange={(event) => setStoreForm((current) => ({ ...current, name: event.target.value }))} placeholder="Riverside Mall" /></label><label className="modal-field"><span>Address <em>optional</em></span><input value={storeForm.address} onChange={(event) => setStoreForm((current) => ({ ...current, address: event.target.value }))} placeholder="City, street or internal reference" /></label><div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setIsStoreModalOpen(false)}>Cancel</button><button type="submit" className="button button-primary">Create store</button></div></form></div>}
      {isLayoutModalOpen && selectedStore && <div className="modal-backdrop" role="presentation"><form className="modal-card" onSubmit={(event) => void handleCreateLayout(event)}><div className="modal-header"><div><span className="eyebrow">{selectedStore.name}</span><h2>Create a layout</h2></div><button type="button" className="icon-button" onClick={() => setIsLayoutModalOpen(false)} aria-label="Close">×</button></div><label className="modal-field"><span>Layout name</span><input required autoFocus value={layoutForm.name} onChange={(event) => setLayoutForm((current) => ({ ...current, name: event.target.value }))} placeholder="Main floor" /></label><div className="field-grid two-columns modal-dimensions"><label className="modal-field"><span>Room width <em>cm</em></span><input required min="1" type="number" value={layoutForm.widthCm} onChange={(event) => setLayoutForm((current) => ({ ...current, widthCm: event.target.value }))} /></label><label className="modal-field"><span>Room depth <em>cm</em></span><input required min="1" type="number" value={layoutForm.depthCm} onChange={(event) => setLayoutForm((current) => ({ ...current, depthCm: event.target.value }))} /></label></div><div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setIsLayoutModalOpen(false)}>Cancel</button><button type="submit" className="button button-primary">Create layout</button></div></form></div>}
    </main>
  );
}
