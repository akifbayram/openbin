export interface Bin {
  id: string;
  name: string;
  contents: string;
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

export interface ExportData {
  version: 1;
  exportedAt: string;
  bins: Array<Omit<Bin, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }>;
  photos: ExportedPhoto[];
}
