export type LayoutSummary = {
  id: string;
  storeId: string;
  name: string;
  widthCm: number;
  depthCm: number;
  createdAt?: string;
  updatedAt?: string;
};

export type Store = {
  id: string;
  name: string;
  address: string;
  layouts: LayoutSummary[];
  createdAt?: string;
  updatedAt?: string;
};

export type LayoutObject = {
  id: string;
  layoutId: string;
  type: string;
  name: string;
  xCm: number;
  yCm: number;
  widthCm: number;
  depthCm: number;
  heightCm: number;
  rotationDeg: number;
  createdAt?: string;
  updatedAt?: string;
};

export type Layout = LayoutSummary & {
  createdAt: string;
  updatedAt: string;
};

export type LayoutMedia = {
  id: string;
  storeId: string | null;
  layoutId: string | null;
  kind: "photo" | "reference" | string;
  url: string;
  caption: string;
  note: string;
  createdAt?: string;
  updatedAt?: string;
};

export type LayoutResponse = {
  layout: Layout;
  objects: LayoutObject[];
  media: LayoutMedia[];
  currentVersion: number;
};

export type LayoutVersion = {
  id: string;
  version: number;
  widthCm: number;
  depthCm: number;
  objects: LayoutVersionObject[];
  authorId: string;
  authorName: string;
  authorEmail: string;
  savedAt: string;
};

export type LayoutVersionObject = {
  id: string;
  type: string;
  name: string;
  xCm: number;
  yCm: number;
  widthCm: number;
  depthCm: number;
  heightCm: number;
  rotationDeg: number;
};

export type ObjectDraft = Omit<LayoutObject, "id" | "layoutId"> & {
  id?: string;
  layoutId?: string;
};
