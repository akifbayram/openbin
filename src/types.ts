// Plan/subscription types
export type PlanTier = 'lite' | 'pro';
export type SubscriptionStatus = 'inactive' | 'active' | 'trial';

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  plan?: PlanTier;
  subscriptionStatus?: SubscriptionStatus;
  activeUntil?: string | null;
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
  default_join_role: 'member' | 'viewer';
  role?: 'admin' | 'member' | 'viewer';
  member_count?: number;
  area_count?: number;
  bin_count?: number;
  created_at: string;
  updated_at: string;
}

export interface LocationMember {
  id: string;
  location_id: string;
  user_id: string;
  role: 'admin' | 'member' | 'viewer';
  joined_at: string;
  display_name?: string;
  username?: string;
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
  auth_method: 'jwt' | 'api_key' | null;
  api_key_name: string | null;
  created_at: string;
}

export interface Area {
  id: string;
  location_id: string;
  name: string;
  parent_id: string | null;
  bin_count: number;
  descendant_bin_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type BinVisibility = 'location' | 'private';

export interface BinItem {
  id: string;
  name: string;
  quantity: number | null;
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
  card_style: string;
  created_by: string;
  created_by_name: string;
  visibility: BinVisibility;
  custom_fields: Record<string, string>;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  is_pinned?: boolean;
}

export interface CustomField {
  id: string;
  location_id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
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
  items: Array<string | { name: string; quantity?: number | null }>;
  notes: string;
  tags: string[];
  icon?: string;
  color?: string;
  cardStyle?: string;
  visibility?: 'location' | 'private';
  customFields?: Record<string, string>;
  shortCode?: string;
  createdBy?: string;
  deletedAt?: string | null;
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
  createdBy?: string;
  createdAt?: string;
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
  locationSettings?: {
    activityRetentionDays: number;
    trashRetentionDays: number;
    appName: string;
    termBin: string;
    termLocation: string;
    termArea: string;
    defaultJoinRole: 'member' | 'viewer';
  };
  bins: ExportBinV2[];
  trashedBins?: ExportBinV2[];
  areas?: Array<{ path: string; createdBy?: string }>;
  tagColors?: Array<{ tag: string; color: string }>;
  customFieldDefinitions?: Array<{ name: string; position: number }>;
  pinnedBins?: Array<{ userId: string; binId: string; position: number }>;
  savedViews?: Array<{ userId: string; name: string; searchQuery: string; sort: string; filters: string }>;
  members?: Array<{ userId: string; username: string; role: string; joinedAt: string }>;
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
  reorganizationPrompt: string | null;
  temperature: number | null;
  maxTokens: number | null;
  topP: number | null;
  requestTimeout: number | null;
  taskModelOverrides?: Partial<Record<string, string>> | null;
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

export interface AiSuggestedItem {
  name: string;
  quantity?: number | null;
}

export interface AiSuggestions {
  name: string;
  items: AiSuggestedItem[];
  tags: string[];
  notes: string;
  customFields?: Record<string, string>;
}

export interface PlanFeatures {
  ai: boolean;
  apiKeys: boolean;
  customFields: boolean;
  fullExport: boolean;
  maxLocations: number | null;
  maxBinsPerLocation: number | null;
  maxPhotoStorageMb: number | null;
  maxMembersPerLocation: number | null;
  activityRetentionDays: number | null;
}

export interface PlanInfo {
  plan: PlanTier;
  status: SubscriptionStatus;
  activeUntil: string | null;
  selfHosted: boolean;
  features: PlanFeatures;
  upgradeUrl: string | null;
}
