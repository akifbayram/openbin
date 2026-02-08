export interface Bin {
  id: string;
  name: string;
  items: string[];
  notes: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Photo {
  id: string;
  binId: string;
  data: Blob;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: Date;
}

export interface ExportedPhoto {
  id: string;
  binId: string;
  dataBase64: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

/** V1 export format (legacy: freeform contents string) */
export interface ExportBinV1 {
  id: string;
  name: string;
  contents: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/** V2 export format (current: discrete items + notes) */
export interface ExportBinV2 {
  id: string;
  name: string;
  items: string[];
  notes: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ExportDataV1 {
  version: 1;
  exportedAt: string;
  bins: ExportBinV1[];
  photos: ExportedPhoto[];
}

export interface ExportDataV2 {
  version: 2;
  exportedAt: string;
  bins: ExportBinV2[];
  photos: ExportedPhoto[];
}

export type ExportData = ExportDataV1 | ExportDataV2;
