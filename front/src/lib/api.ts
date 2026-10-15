import type {
  LayoutMedia,
  LayoutResponse,
  LayoutSummary,
  LayoutObject,
  Store,
  LayoutVersion,
} from "./types";

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

export type AuthSessionResponse = {
  session: {
    id: string;
    expiresAt: string;
  };
  user: AuthUser;
} | null;

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const isFormData =
    typeof FormData !== "undefined" && init?.body instanceof FormData;

  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_ORIGIN}${path}`, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new ApiError(
      body?.error ?? `Ошибка запроса (${response.status})`,
      response.status,
    );
  }

  return body as T;
}

export function getApiErrorMessage(error: unknown) {
  const translate = (message: string) => {
    const knownMessages: Record<string, string> = {
      "Authentication required": "Требуется войти в аккаунт",
      "Authentication unavailable": "Сервис авторизации временно недоступен",
      "Store not found": "Магазин не найден",
      "Layout not found": "Планировка не найдена",
      "Media not found": "Изображение не найдено",
      "Version not found": "Версия не найдена",
      "Layout objects are outside the room or overlap.": "Объекты выходят за границы помещения или пересекаются.",
      "Layout changed since this plan was loaded. Reload it before saving.": "План изменился после загрузки. Обновите последнюю версию перед сохранением.",
      "Layout changed since this plan was loaded. Reload it before restoring.": "План изменился после загрузки. Обновите последнюю версию перед восстановлением.",
      "Only JPEG, PNG, and WebP images are supported": "Поддерживаются только изображения JPEG, PNG и WebP",
      "Media file not found": "Файл изображения не найден",
      "Internal server error": "Внутренняя ошибка сервера",
    };
    return knownMessages[message] ?? message;
  };

  if (error instanceof ApiError) {
    return translate(error.message);
  }

  return error instanceof Error ? translate(error.message) : "Произошла неизвестная ошибка";
}

export function isApiConflict(error: unknown) {
  return error instanceof ApiError && error.status === 409;
}

export function getMediaAssetUrl(url: string) {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return `${API_ORIGIN}${url.startsWith("/") ? url : `/${url}`}`;
}

export function getSession() {
  return request<AuthSessionResponse>("/api/auth/get-session");
}

export function signIn(email: string, password: string) {
  return request<AuthSessionResponse>("/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify({ email, password, rememberMe: true }),
  });
}

export function signOut() {
  return request<null>("/api/auth/sign-out", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function listStores() {
  const response = await request<{ stores: Store[] }>("/api/stores");
  return response.stores;
}

export async function createStore(input: { name: string; address: string }) {
  const response = await request<{ store: Store }>("/api/stores", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return response.store;
}

export async function createLayout(
  storeId: string,
  input: { name: string; widthCm: number; depthCm: number },
) {
  const response = await request<{ layout: LayoutSummary }>(
    `/api/stores/${storeId}/layouts`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  return response.layout;
}

export async function getLayout(layoutId: string) {
  return request<LayoutResponse>(`/api/layouts/${layoutId}`);
}

export async function listLayoutMedia(layoutId: string) {
  const response = await request<{ media: LayoutMedia[] }>(
    `/api/layouts/${layoutId}/media`,
  );
  return response.media;
}

export async function createLayoutMedia(
  layoutId: string,
  input: {
    kind: "photo" | "reference";
    url: string;
    caption: string;
    note: string;
  },
) {
  const response = await request<{ media: LayoutMedia }>(
    `/api/layouts/${layoutId}/media`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  return response.media;
}

export async function uploadLayoutMedia(
  layoutId: string,
  input: {
    file: File;
    kind: "photo" | "reference";
    caption: string;
    note: string;
  },
) {
  const formData = new FormData();
  formData.append("file", input.file);
  formData.append("kind", input.kind);
  formData.append("caption", input.caption);
  formData.append("note", input.note);

  const response = await request<{ media: LayoutMedia }>(
    `/api/layouts/${layoutId}/media/upload`,
    {
      method: "POST",
      body: formData,
    },
  );
  return response.media;
}

export async function deleteLayoutMedia(layoutId: string, mediaId: string) {
  return request<{ deleted: true; mediaId: string }>(
    `/api/layouts/${layoutId}/media/${mediaId}`,
    { method: "DELETE" },
  );
}

export async function saveLayoutObjects(
  layoutId: string,
  baseVersion: number,
  objects: LayoutObject[],
) {
  return request<{
    objects: LayoutObject[];
    currentVersion: number;
    versionCreated: boolean;
  }>(
    `/api/layouts/${layoutId}/objects`,
    {
      method: "PUT",
      body: JSON.stringify({ baseVersion, objects }),
    },
  );
}

export async function listLayoutVersions(layoutId: string) {
  const response = await request<{ versions: LayoutVersion[] }>(
    `/api/layouts/${layoutId}/versions`,
  );
  return response.versions;
}

export async function restoreLayoutVersion(
  layoutId: string,
  version: number,
  baseVersion: number,
) {
  return request<{
    layout: LayoutResponse["layout"];
    objects: LayoutObject[];
    currentVersion: number;
  }>(`/api/layouts/${layoutId}/versions/${version}/restore`, {
    method: "POST",
    body: JSON.stringify({ baseVersion }),
  });
}
