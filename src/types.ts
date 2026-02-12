export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Location {
  [key: string]: unknown;  // ElectricSQL Row compatibility
  id: string;
  name: string;
  created_by: string;
  invite_code: string;
  created_at: string;
  updated_at: string;
}

export interface LocationMember {
  [key: string]: unknown;  // ElectricSQL Row compatibility
  id: string;
  location_id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
}

export interface Area {
  [key: string]: unknown;
  id: string;
  location_id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Bin {
  [key: string]: unknown;  // ElectricSQL Row compatibility
  id: string;
  location_id: string;
  name: string;
  area_id: string | null;
  area_name: string;
  items: string[];
  notes: string;
  tags: string[];
  icon: string;
  color: string;
  short_code: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Photo {
  [key: string]: unknown;  // ElectricSQL Row compatibility
  id: string;
  bin_id: string;
  filename: string;
  mime_type: string;
  size: number;
  storage_path: string;
  created_by: string;
  created_at: string;
}

export interface TagColor {
  [key: string]: unknown;  // ElectricSQL Row compatibility
  id: string;
  location_id: string;
  tag: string;
  color: string;
  created_at: string;
  updated_at: string;
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

/** V2 export format (current: discrete items + notes + optional location) */
export interface ExportBinV2 {
  id: string;
  name: string;
  location?: string;
  items: string[];
  notes: string;
  tags: string[];
  icon?: string;
  color?: string;
  shortCode?: string;
  createdAt: string;
  updatedAt: string;
  photos?: ExportBinPhoto[];
}

/** Photo embedded in a bin export (server format) */
export interface ExportBinPhoto {
  id: string;
  filename: string;
  mimeType: string;
  data: string;
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
  locationName?: string;
  bins: ExportBinV2[];
  photos?: ExportedPhoto[];
}

export type ExportData = ExportDataV1 | ExportDataV2;

export type AiProvider = 'openai' | 'anthropic' | 'openai-compatible';

export interface AiSettings {
  id: string;
  provider: AiProvider;
  apiKey: string;
  model: string;
  endpointUrl: string | null;
}

export interface AiSuggestions {
  name: string;
  items: string[];
  tags: string[];
  notes: string;
}
