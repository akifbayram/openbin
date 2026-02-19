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
  id: string;
  name: string;
  created_by: string;
  invite_code: string;
  activity_retention_days: number;
  trash_retention_days: number;
  app_name: string;
  term_bin: string;
  term_location: string;
  term_area: string;
  role?: 'admin' | 'member';
  member_count?: number;
  area_count?: number;
  created_at: string;
  updated_at: string;
}

export interface LocationMember {
  id: string;
  location_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  display_name?: string;
}

export interface ActivityLogEntry {
  id: string;
  location_id: string;
  user_id: string | null;
  user_name: string;
  display_name: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  created_at: string;
}

export interface Area {
  id: string;
  location_id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type BinVisibility = 'location' | 'private';

export interface BinItem {
  id: string;
  name: string;
}

export interface Bin {
  id: string;
  location_id: string;
  name: string;
  area_id: string | null;
  area_name: string;
  items: BinItem[];
  notes: string;
  tags: string[];
  icon: string;
  color: string;
  short_code: string;
  created_by: string;
  created_by_name: string;
  visibility: BinVisibility;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  is_pinned?: boolean;
}

/** Generic list response envelope from API */
export interface ListResponse<T> {
  results: T[];
  count: number;
}

export interface Photo {
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

export type AiProvider = 'openai' | 'anthropic' | 'gemini' | 'openai-compatible';

export interface AiSettings {
  id: string;
  provider: AiProvider;
  apiKey: string;
  model: string;
  endpointUrl: string | null;
  customPrompt: string | null;
  commandPrompt: string | null;
  queryPrompt: string | null;
  structurePrompt: string | null;
  providerConfigs?: Partial<Record<AiProvider, {
    apiKey: string;
    model: string;
    endpointUrl: string | null;
  }>>;
  source?: 'user' | 'env';
}

export interface ApiKey {
  id: string;
  key_prefix: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface AiSuggestions {
  name: string;
  items: string[];
  tags: string[];
  notes: string;
}
