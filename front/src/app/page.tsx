"use client";

import dynamic from "next/dynamic";
import {
  CircleUserRound,
  ChevronRight,
  History as HistoryIcon,
  Home as HomeIcon,
  Images,
  LayoutDashboard,
  LogOut,
  Map,
  Plus,
  X,
} from "lucide-react";
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
import StoreCard from "../components/StoreCard";
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
import { getLayoutMeasurements, isObjectValid } from "../lib/geometry";
import type {
  LayoutMedia,
  LayoutObject,
  LayoutResponse,
  Store,
} from "../lib/types";
import type { AuthUser } from "../lib/api";

const Scene3D = dynamic(() => import("../components/Scene3D"), {
  ssr: false,
  loading: () => <div className="scene-loading">Подготовка 3D-вида…</div>,
});

type ViewMode = "2d" | "3d";
type AppSection = "home" | "plan" | "gallery" | "history";
type SaveState = "saved" | "unsaved" | "saving" | "error";
type AuthState = "loading" | "authenticated" | "unauthenticated";
type ObjectField = "xCm" | "yCm" | "widthCm" | "depthCm" | "heightCm" | "rotationDeg";

const objectPresets = [
  { type: "shelf", label: "Стеллаж", icon: "▤", widthCm: 180, depthCm: 60, heightCm: 180 },
  { type: "checkout", label: "Касса", icon: "▥", widthCm: 140, depthCm: 80, heightCm: 100 },
  { type: "display", label: "Витрина", icon: "◫", widthCm: 120, depthCm: 80, heightCm: 160 },
] as const;

const objectFieldLabels: Record<ObjectField, string> = {
  xCm: "X от левой стены",
  yCm: "Y от верхней стены",
  widthCm: "Ширина",
  depthCm: "Глубина",
  heightCm: "Высота",
  rotationDeg: "Поворот",
};

function makeObjectId() {
  return globalThis.crypto?.randomUUID?.() ?? `object-${Date.now()}`;
}

function formatNumber(value: number, maximumFractionDigits = 2) {
  return value.toLocaleString("ru-RU", { maximumFractionDigits });
}

function formatRoomSize(widthCm: number, depthCm: number) {
  return `${formatNumber(widthCm / 100)} × ${formatNumber(depthCm / 100)} м · ${formatNumber((widthCm * depthCm) / 10_000)} м²`;
}

function formatMeasurement(valueCm: number) {
  const rounded = Math.round(valueCm * 10) / 10;
  if (rounded >= 100) {
    return `${formatNumber(rounded)} см (${formatNumber(rounded / 100)} м)`;
  }
  return `${formatNumber(rounded)} см`;
}

function isEditableTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

function getObjectTypeLabel(type: string) {
  return objectPresets.find((preset) => preset.type === type)?.label ?? type;
}

export default function Home() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [layoutData, setLayoutData] = useState<LayoutResponse | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState<AppSection>("home");
  const [viewMode, setViewMode] = useState<ViewMode>("2d");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingLayout, setIsLoadingLayout] = useState(false);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isEditorToolsCollapsed, setIsEditorToolsCollapsed] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storeForm, setStoreForm] = useState({ name: "", address: "" });
  const [layoutForm, setLayoutForm] = useState({ name: "Основной зал", widthCm: "1200", depthCm: "800" });

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

  const measurements = useMemo(() => {
    if (!layoutData || !selectedObject) return null;
    return getLayoutMeasurements(selectedObject, layoutData.objects, layoutData.layout);
  }, [layoutData, selectedObject]);

  const dimensionPreview = useMemo(() => {
    const widthCm = Number.parseInt(layoutForm.widthCm, 10);
    const depthCm = Number.parseInt(layoutForm.depthCm, 10);
    if (!Number.isInteger(widthCm) || !Number.isInteger(depthCm) || widthCm <= 0 || depthCm <= 0) {
      return "Введите положительные размеры помещения";
    }
    return formatRoomSize(widthCm, depthCm);
  }, [layoutForm.depthCm, layoutForm.widthCm]);

  const refreshStores = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const nextStores = await listStores();
      setStores(nextStores);
      setSelectedStoreId((current) => current && nextStores.some((store) => store.id === current) ? current : null);
      setSelectedLayoutId((current) => nextStores.some((store) => store.layouts.some((layout) => layout.id === current)) ? current : null);
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
      setSelectedObjectIds(response.objects[0] ? [response.objects[0].id] : []);
      setActiveSection("plan");
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
    }
  }, [selectedStore]);

  useEffect(() => {
    if (selectedLayoutId && selectedLayoutId !== layoutData?.layout.id) void loadLayout(selectedLayoutId);
  }, [layoutData?.layout.id, loadLayout, selectedLayoutId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (isStoreModalOpen || isLayoutModalOpen) {
          setIsStoreModalOpen(false);
          setIsLayoutModalOpen(false);
          return;
        }
        if (!isEditableTarget(event.target)) {
          setSelectedObjectId(null);
          setSelectedObjectIds([]);
        }
        return;
      }

      if (isEditableTarget(event.target)) return;
      if (activeSection !== "plan") return;

      if (event.key === "Shift") {
        setIsShiftPressed(true);
        return;
      }

      if (!layoutData) return;
      const commandKey = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (commandKey && key === "a") {
        event.preventDefault();
        const ids = layoutData.objects.map((object) => object.id);
        setSelectedObjectIds(ids);
        setSelectedObjectId(ids[0] ?? null);
      } else if (commandKey && key === "d") {
        event.preventDefault();
        duplicateSelectedObject();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        removeSelectedObjects();
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key === "Shift") setIsShiftPressed(false);
    }

    function handleWindowBlur() {
      setIsShiftPressed(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [activeSection, isLayoutModalOpen, isStoreModalOpen, layoutData, selectedObjectId, selectedObjectIds]);

  function selectLayout(layoutId: string) {
    const store = stores.find((item) => item.layouts.some((layout) => layout.id === layoutId));
    setSelectedStoreId(store?.id ?? selectedStoreId);
    setSelectedLayoutId(layoutId);
    setSelectedObjectId(null);
    setSelectedObjectIds([]);
    setError(null);
    setHasConflict(false);
    setActiveSection("plan");
  }

  function navigateSection(section: AppSection) {
    if (section !== "home" && !layoutData) {
      setActiveSection("home");
      return;
    }

    setActiveSection(section);

    if (section === "gallery" || section === "history") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function selectObject(id: string | null) {
    setSelectedObjectId(id);
    setSelectedObjectIds(id ? [id] : []);
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

  function updateNumericObjectField(field: ObjectField, value: string) {
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
    setSelectedObjectIds([object.id]);
    setSaveState("unsaved");
    setHasConflict(false);
  }

  function duplicateSelectedObject() {
    if (!layoutData || !selectedObject) return;
    const duplicate: LayoutObject = {
      ...selectedObject,
      id: makeObjectId(),
      name: `${selectedObject.name} — копия`,
      xCm: selectedObject.xCm + 40,
      yCm: selectedObject.yCm + 40,
    };
    setLayoutData((current) => current ? { ...current, objects: [...current.objects, duplicate] } : current);
    setSelectedObjectId(duplicate.id);
    setSelectedObjectIds([duplicate.id]);
    setSaveState("unsaved");
    setHasConflict(false);
  }

  function removeSelectedObjects() {
    const ids = selectedObjectIds.length > 0 ? selectedObjectIds : selectedObject ? [selectedObject.id] : [];
    if (!layoutData || ids.length === 0) return;
    setLayoutData((current) => current ? { ...current, objects: current.objects.filter((object) => !ids.includes(object.id)) } : current);
    setSelectedObjectId(null);
    setSelectedObjectIds([]);
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
      const response = await saveLayoutObjects(layoutData.layout.id, layoutData.currentVersion, layoutData.objects);
      setLayoutData((current) => current ? { ...current, objects: response.objects, currentVersion: response.currentVersion } : current);
      setSelectedObjectId((current) => response.objects.some((object) => object.id === current) ? current : response.objects[0]?.id ?? null);
      setSelectedObjectIds((current) => current.filter((id) => response.objects.some((object) => object.id === id)));
      setSaveState("saved");
      setHasConflict(false);
    } catch (requestError) {
      setSaveState("error");
      if (isApiConflict(requestError)) {
        setHasConflict(true);
        setError("План изменился в другой сессии. Обновите последнюю версию перед сохранением.");
      } else {
        setError(getApiErrorMessage(requestError));
      }
    }
  }

  function handleRestored(snapshot: { layout: LayoutResponse["layout"]; objects: LayoutObject[]; currentVersion: number }) {
    setLayoutData((current) => current ? { ...current, layout: snapshot.layout, objects: snapshot.objects, currentVersion: snapshot.currentVersion } : current);
    const firstObjectId = snapshot.objects[0]?.id ?? null;
    setSelectedObjectId(firstObjectId);
    setSelectedObjectIds(firstObjectId ? [firstObjectId] : []);
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
    setActiveSection("home");
  }

  const saveLabel = {
    saved: activeSection === "home" || activeSection === "gallery" || activeSection === "history" ? "Сохранено" : "Все изменения сохранены",
    unsaved: "Есть несохранённые изменения",
    saving: "Сохранение…",
    error: "Ошибка сохранения",
  }[saveState];

  if (authState === "loading") {
    return <main className="auth-shell"><div className="spinner" aria-label="Проверка сессии" /></main>;
  }

  if (authState === "unauthenticated") {
    return <LoginForm onAuthenticated={(user) => { setAuthUser(user); setAuthState("authenticated"); }} />;
  }

  return (
    <main className={`planner-shell ${activeSection}-active`}>
      <header className="topbar">
        <div className="brand-lockup">
          <LayoutDashboard className="brand-icon" aria-hidden="true" />
          <div><strong>Планировка</strong><span>Рабочее пространство Vizaje-Nica</span></div>
        </div>
        {layoutData && activeSection !== "home" && <ChevronRight className="topbar-breadcrumb-chevron" aria-hidden="true" />}
        {layoutData && activeSection !== "home" && <div className="topbar-context"><span>{selectedStore?.name}</span><b>/</b><strong>{activeSection === "plan" ? layoutData.layout.name : activeSection === "gallery" ? "Галерея" : "История"}</strong></div>}
        {layoutData && activeSection === "plan" ? (
          <div className="view-switch" aria-label="Режим просмотра">
            <button type="button" className={viewMode === "2d" ? "active" : ""} onClick={() => setViewMode("2d")} aria-pressed={viewMode === "2d"}>2D план</button>
            <button type="button" className={viewMode === "3d" ? "active" : ""} onClick={() => setViewMode("3d")} aria-pressed={viewMode === "3d"}>3D вид</button>
          </div>
        ) : activeSection === "home" ? <span className="topbar-note">Внутренний инструмент</span> : <span className="topbar-spacer" aria-hidden="true" />}
        <div className={`save-indicator ${saveState}`}><span className="status-dot" /><span>{saveLabel}</span></div>
        <div className="topbar-account">
          <button
            type="button"
            className="account-avatar"
            onClick={() => setIsAccountMenuOpen((current) => !current)}
            aria-label="Открыть меню пользователя"
            aria-expanded={isAccountMenuOpen}
          >
            {authUser?.image ? <img src={authUser.image} alt="" /> : <CircleUserRound aria-hidden="true" />}
          </button>
          {isAccountMenuOpen && <div className="account-menu"><span>{authUser?.name ?? authUser?.email}</span><button type="button" onClick={() => void handleSignOut()}><LogOut aria-hidden="true" />Выйти</button></div>}
        </div>
      </header>

      <div className={`app-body ${activeSection === "plan" ? "plan-body" : ""} ${activeSection === "home" ? "home-body" : ""} ${activeSection === "gallery" ? "gallery-body" : ""} ${activeSection === "history" ? "history-body" : ""}`}>

        <section className="workspace">
          {error && <div className="error-banner"><span>{error}</span>{hasConflict && layoutData && <button type="button" className="button button-quiet conflict-reload" onClick={() => void loadLayout(layoutData.layout.id)}>Загрузить последнюю версию</button>}</div>}
          {!layoutData || activeSection === "home" ? (
            isLoading || isLoadingLayout ? (
              <div className="workspace-empty"><div className="spinner" /><p>Загрузка планировки…</p></div>
            ) : stores.length === 0 ? (
              <div className="workspace-empty"><div className="empty-illustration" aria-hidden="true"><span /><span /><span /></div><span className="eyebrow">Начните с магазина</span><h2>Планируйте торговый зал быстрее.</h2><p>Добавьте магазин и первую планировку, чтобы расставить стеллажи, кассы и витрины в сантиметрах.</p><button type="button" className="button button-primary" onClick={() => setIsStoreModalOpen(true)}>+ Создать первый магазин</button></div>
            ) : (
              <section className="stores-home" aria-labelledby="stores-title">
                <div className="stores-home-header">
                  <div><h1 id="stores-title">Магазины</h1><p>Планы торговых пространств в одном месте</p></div>
                  <button type="button" className="button home-primary" onClick={() => setIsStoreModalOpen(true)}><Plus aria-hidden="true" />Новый магазин</button>
                </div>
                <div className="stores-home-count">{stores.length} {stores.length === 1 ? "магазин" : stores.length < 5 ? "магазина" : "магазинов"}</div>
                <div className="store-card-grid">
                  {stores.map((store) => <StoreCard key={store.id} store={store} onOpenLayout={(storeId, layoutId) => { setSelectedStoreId(storeId); selectLayout(layoutId); }} onCreateLayout={(storeId) => { setSelectedStoreId(storeId); setIsLayoutModalOpen(true); }} />)}
                </div>
              </section>
            )
          ) : isLoadingLayout || !selectedLayout ? (
            <div className="workspace-empty"><div className="spinner" /><p>Загрузка планировки…</p></div>
          ) : activeSection === "gallery" ? (
            <div className="gallery-page" id="gallery-section">
              <GallerySection layoutId={layoutData.layout.id} media={layoutData.media} isLoading={false} onChange={updateMedia} />
            </div>
          ) : activeSection === "history" ? (
            <div className="history-page" id="history-section">
              <VersionHistory layoutId={layoutData.layout.id} currentVersion={layoutData.currentVersion} onRestored={handleRestored} onConflict={() => { setHasConflict(true); setError("План изменился в другой сессии. Обновите последнюю версию перед восстановлением."); }} />
            </div>
          ) : (
            <>
              <div className="editor-page-header">
                <div><span className="eyebrow">План помещения</span><p>{formatRoomSize(layoutData.layout.widthCm, layoutData.layout.depthCm)} · размеры хранятся в сантиметрах</p></div>
                <div className="workspace-actions"><button type="button" className="button button-primary save-button" onClick={() => void saveObjects()} disabled={saveState === "saving"}>{saveState === "saving" ? "Сохранение…" : "Сохранить план"}</button></div>
              </div>
              <div className={`editor-layout ${isEditorToolsCollapsed ? "tools-collapsed" : ""}`}>
                <aside className="editor-tools-panel">
                  <div className="editor-tools-header"><div><span className="eyebrow">Слои</span>{!isEditorToolsCollapsed && <strong>Инструменты и объекты</strong>}</div><button type="button" className="panel-toggle" onClick={() => setIsEditorToolsCollapsed((current) => !current)} aria-label={isEditorToolsCollapsed ? "Развернуть панель редактора" : "Свернуть панель редактора"} title={isEditorToolsCollapsed ? "Развернуть панель редактора" : "Свернуть панель редактора"}>{isEditorToolsCollapsed ? "›" : "‹"}</button></div>
                  {!isEditorToolsCollapsed && <>
                    <div className="editor-tool-section editor-tool-insert"><span className="tool-section-label">Добавить объект</span><div className="editor-tool-list">{objectPresets.map((preset) => <button type="button" key={preset.type} className="editor-tool-button" onClick={() => addObject(preset)}><span className="editor-tool-icon">{preset.icon}</span><span>{preset.label}</span><b>+</b></button>)}</div></div>
                    <div className="editor-tool-section editor-object-list"><div className="tool-section-heading"><span className="tool-section-label">Объекты</span><small>{layoutData.objects.length}</small></div>{layoutData.objects.length === 0 ? <p className="editor-tools-empty">Добавьте объект, чтобы начать расстановку.</p> : layoutData.objects.map((object) => <button type="button" key={object.id} className={`editor-object-row ${selectedObjectIds.includes(object.id) ? "selected" : ""}`} onClick={() => selectObject(object.id)}><span className={`object-status ${validity[object.id] ? "valid" : "invalid"}`} /><span><strong>{object.name}</strong><small>{getObjectTypeLabel(object.type)} · {object.widthCm} × {object.depthCm} см</small></span></button>)}</div>
                    <div className="editor-properties">
                      {selectedObject ? <>
                        <div className="inspector-heading"><div><span className="eyebrow">Выбранный объект</span><input className="object-name-input" value={selectedObject.name} onChange={(event) => updateObject(selectedObject.id, { name: event.target.value })} aria-label="Название объекта" /></div><button type="button" className="icon-button danger" onClick={removeSelectedObjects} aria-label="Удалить выбранные объекты" title="Удалить объект">×</button></div>
                        <div className={`fit-status ${validity[selectedObject.id] ? "valid" : "invalid"}`}><span>{validity[selectedObject.id] ? "✓" : "!"}</span><div><strong>{validity[selectedObject.id] ? "Размещение корректно" : "Нужно исправить размещение"}</strong><small>{validity[selectedObject.id] ? "Объект помещается в комнату и не пересекается." : "Переместите или измените размер объекта."}</small></div></div>
                        <div className="inspector-section"><div className="section-title">Размеры <span>(см)</span></div><div className="field-grid three-columns">{(["widthCm", "depthCm", "heightCm"] as const).map((field) => <label key={field}><span>{objectFieldLabels[field]}</span><input type="number" min="1" value={selectedObject[field]} onChange={(event) => updateNumericObjectField(field, event.target.value)} /></label>)}</div></div>
                        <div className="inspector-section"><div className="section-title">Позиция <span>(см)</span></div><div className="field-grid two-columns">{(["xCm", "yCm"] as const).map((field) => <label key={field}><span>{objectFieldLabels[field]}</span><input type="number" value={selectedObject[field]} onChange={(event) => updateNumericObjectField(field, event.target.value)} /></label>)}</div></div>
                        <div className="inspector-section rotation-section"><div className="section-title">Поворот <span>(°)</span></div><div className="rotation-control"><input type="number" value={selectedObject.rotationDeg} onChange={(event) => updateNumericObjectField("rotationDeg", event.target.value)} /><button type="button" className="rotate-button" onClick={rotateSelectedObject} title="Повернуть на 90 градусов">↻</button></div></div>
                        {isShiftPressed && measurements && <div className="measurement-panel"><div className="section-title">Измерения <span>Shift</span></div><div className="measurement-walls"><span>Слева <b>{formatMeasurement(measurements.walls.leftCm)}</b></span><span>Справа <b>{formatMeasurement(measurements.walls.rightCm)}</b></span><span>Сверху <b>{formatMeasurement(measurements.walls.topCm)}</b></span><span>Снизу <b>{formatMeasurement(measurements.walls.bottomCm)}</b></span></div><div className="measurement-objects"><span>Ближайшие объекты</span>{measurements.nearestObjects.length === 0 ? <small>Других объектов нет</small> : measurements.nearestObjects.map((item) => <small key={item.id}>{item.name}: <b>{formatMeasurement(item.distanceCm)}</b></small>)}</div></div>}
                        <div className="inspector-footer"><span className="type-label">Тип</span><span className="type-value">{getObjectTypeLabel(selectedObject.type)}</span></div>
                      </> : <div className="inspector-empty"><div className="inspector-empty-icon">⌁</div><strong>Выберите объект</strong><p>Нажмите на объект или слой, чтобы изменить его параметры.</p></div>}
                    </div>
                  </>}
                </aside>
                <div className="editor-main">
              <div className="editor-grid">
                <div className="canvas-panel">
                  <div className="canvas-toolbar"><span className="canvas-title">{viewMode === "2d" ? "План помещения" : "Приблизительный 3D-вид"}</span><span className="canvas-help">{viewMode === "2d" ? "Перетаскивайте объекты. Пустое пространство — панорама. Колесо — масштаб." : "Вращение — мышью или одним пальцем · панорама — правой кнопкой или двумя пальцами · масштаб — колесом."}</span></div>
                  {viewMode === "2d" ? <PlanCanvas room={layoutData.layout} objects={layoutData.objects} selectedObjectId={selectedObjectId} selectedObjectIds={selectedObjectIds} validity={validity} measurements={measurements} showMeasurements={isShiftPressed} onSelect={selectObject} onMove={(id, xCm, yCm) => updateObject(id, { xCm, yCm })} /> : <div className="scene-3d"><Scene3D room={layoutData.layout} objects={layoutData.objects} selectedObjectId={selectedObjectId} onSelect={selectObject} /></div>}
                  <div className="canvas-legend"><span><i className="legend-dot valid" /> Объект помещается</span><span><i className="legend-dot invalid" /> Нужно исправить</span><span className="legend-note">Сетка: 50 см · Shift — измерения</span></div>
                </div>
              </div>
              <div className="shortcut-hint">Ctrl/Cmd+D — дублировать · Delete — удалить · Ctrl/Cmd+A — выбрать всё · Esc — снять выделение · Shift — измерения · Пустое пространство — панорама</div>
              </div>
              </div>
            </>
          )}
        </section>
      </div>

      <nav className="floating-nav" aria-label="Разделы приложения">
        <button type="button" className={activeSection === "home" ? "active" : ""} onClick={() => navigateSection("home")}><HomeIcon aria-hidden="true" />Главная</button>
        <button type="button" className={activeSection === "plan" ? "active" : ""} onClick={() => navigateSection("plan")} disabled={!layoutData}><Map aria-hidden="true" />План</button>
        <button type="button" className={activeSection === "gallery" ? "active" : ""} onClick={() => navigateSection("gallery")} disabled={!layoutData}><Images aria-hidden="true" />Галерея</button>
        <button type="button" className={activeSection === "history" ? "active" : ""} onClick={() => navigateSection("history")} disabled={!layoutData}><HistoryIcon aria-hidden="true" />История</button>
      </nav>

      {isStoreModalOpen && <div className="modal-backdrop" role="presentation"><form className="modal-card" onSubmit={(event) => void handleCreateStore(event)}><div className="modal-header"><div><span className="eyebrow">Новое рабочее пространство</span><h2>Создать магазин</h2></div><button type="button" className="icon-button" onClick={() => setIsStoreModalOpen(false)} aria-label="Закрыть"><X aria-hidden="true" /></button></div><label className="modal-field"><span>Название магазина</span><input required autoFocus value={storeForm.name} onChange={(event) => setStoreForm((current) => ({ ...current, name: event.target.value }))} placeholder="Торговый центр Riverside" /></label><label className="modal-field"><span>Адрес <em>необязательно</em></span><input value={storeForm.address} onChange={(event) => setStoreForm((current) => ({ ...current, address: event.target.value }))} placeholder="Город, улица или внутренний ориентир" /></label><div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setIsStoreModalOpen(false)}>Отмена</button><button type="submit" className="button button-primary">Создать магазин</button></div></form></div>}
      {isLayoutModalOpen && selectedStore && <div className="modal-backdrop" role="presentation"><form className="modal-card" onSubmit={(event) => void handleCreateLayout(event)}><div className="modal-header"><div><span className="eyebrow">{selectedStore.name}</span><h2>Создать планировку</h2></div><button type="button" className="icon-button" onClick={() => setIsLayoutModalOpen(false)} aria-label="Закрыть"><X aria-hidden="true" /></button></div><label className="modal-field"><span>Название планировки</span><input required autoFocus value={layoutForm.name} onChange={(event) => setLayoutForm((current) => ({ ...current, name: event.target.value }))} placeholder="Основной зал" /></label><div className="field-grid two-columns modal-dimensions"><label className="modal-field"><span>Ширина <em>см</em></span><input required min="1" type="number" value={layoutForm.widthCm} onChange={(event) => setLayoutForm((current) => ({ ...current, widthCm: event.target.value }))} /></label><label className="modal-field"><span>Глубина <em>см</em></span><input required min="1" type="number" value={layoutForm.depthCm} onChange={(event) => setLayoutForm((current) => ({ ...current, depthCm: event.target.value }))} /></label></div><p className="dimension-preview">{dimensionPreview}</p><div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setIsLayoutModalOpen(false)}>Отмена</button><button type="submit" className="button button-primary">Создать планировку</button></div></form></div>}
    </main>
  );
}
