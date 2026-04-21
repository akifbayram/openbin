// Plan/subscription types
export type PlanTier = 'free' | 'plus' | 'pro';
export type SubscriptionStatus = 'inactive' | 'active' | 'trial';

export interface User {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  plan?: PlanTier;
  subscriptionStatus?: SubscriptionStatus;
  activeUntil?: string | null;
  isAdmin?: boolean;
  hasPassword?: boolean;
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
  email?: string;
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

export interface ItemCheckout {
  id: string;
  item_id: string;
  origin_bin_id: string;
  location_id: string;
  checked_out_by: string;
  checked_out_by_name: string;
  checked_out_at: string;
  returned_at: string | null;
  returned_by: string | null;
  return_bin_id: string | null;
}

export interface ItemCheckoutWithContext extends ItemCheckout {
  item_name: string;
  origin_bin_name: string;
  origin_bin_icon: string;
  origin_bin_color: string;
}

export interface Bin {
  id: string;
  short_code: string;
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

export interface Attachment {
  id: string;
  bin_id: string;
  filename: string;
  mime_type: string;
  size: number;
  created_by: string;
  created_at: string;
}

/** List response — trimmed projection (GET /api/tag-colors). */
export interface TagColorSummary {
  tag: string;
  color: string;
  parent_tag: string | null;
}

/** Full row — mutation responses (PUT/DELETE). */
export interface TagColor extends TagColorSummary {
  id: string;
  location_id: string;
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
  members?: Array<{ userId: string; email: string; role: string; joinedAt: string }>;
  photos?: ExportedPhoto[];
}

export type ExportData = ExportDataV2;

export type AiProvider = 'openai' | 'anthropic' | 'gemini' | 'openai-compatible';

export type AiTaskGroup = 'vision' | 'quickText' | 'deepText';

export interface AiTaskOverride {
  provider: AiProvider | null;
  model: string | null;
  endpointUrl: string | null;
  source: 'env' | 'user';
}

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
  tagSuggestionPrompt: string | null;
  temperature: number | null;
  maxTokens: number | null;
  topP: number | null;
  requestTimeout: number | null;
  providerConfigs?: Partial<Record<AiProvider, {
    apiKey: string;
    model: string;
    endpointUrl: string | null;
  }>>;
  source?: 'user' | 'env';
  taskOverrides?: Partial<Record<AiTaskGroup, AiTaskOverride | null>>;
  taskOverridesEnvLocked?: AiTaskGroup[];
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
  customFields?: Record<string, string>;
}

export interface PlanFeatures {
  ai: boolean;
  apiKeys: boolean;
  customFields: boolean;
  fullExport: boolean;
  reorganize: boolean;
  binSharing: boolean;
  attachments: boolean;
  maxBins: number | null;
  maxLocations: number | null;
  maxPhotoStorageMb: number | null;
  maxMembersPerLocation: number | null;
  activityRetentionDays: number | null;
  aiCreditsPerMonth: number | null;
}

export interface OverLimits {
  locations: boolean;
  photos: boolean;
  members: string[];
}

export interface PlanUsage {
  binCount: number;
  locationCount: number;
  photoStorageMb: number;
  memberCounts: Record<string, number>;
  overLimits: OverLimits;
}

export interface PlanInfo {
  plan: PlanTier;
  status: SubscriptionStatus;
  activeUntil: string | null;
  previousSubStatus: 'trial' | 'active' | null;
  selfHosted: boolean;
  locked: boolean;
  features: PlanFeatures;
  upgradeUrl: string | null;
  upgradePlusUrl: string | null;
  upgradeProUrl: string | null;
  portalUrl: string | null;
  subscribePlanUrl: string | null;
  canDowngradeToFree: boolean;
  aiCredits: { used: number; limit: number; resetsAt: string | null } | null;
}

export interface UsageDay {
  date: string;       // 'YYYY-MM-DD' UTC
  count: number;
}

export type UsageGranularity = 'daily' | 'weekly' | 'monthly';
