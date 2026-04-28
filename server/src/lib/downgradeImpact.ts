import type { PlanFeatures, UserUsage } from './planGate.js';

export interface DowngradeWarning {
  kind: 'usage-exceeded' | 'feature-loss';
  title: string;
  description: string;
}

export interface DowngradeImpact {
  targetPlan: 'free' | 'plus';
  warnings: DowngradeWarning[];
}

export interface ComputeImpactInput {
  currentFeatures: PlanFeatures;
  targetFeatures: PlanFeatures;
  targetPlan: 'free' | 'plus';
  usage: UserUsage;
}

const FEATURE_LABELS: Record<keyof Pick<PlanFeatures, 'ai' | 'apiKeys' | 'customFields' | 'fullExport' | 'reorganize' | 'binSharing' | 'attachments'>, [string, string]> = {
  ai:           ['AI features',    'AI photo recognition, ask-AI, and reorganize will be disabled.'],
  apiKeys:      ['API keys',       'Existing API keys will be revoked.'],
  customFields: ['Custom fields',  "Existing values stay; you can't add new ones."],
  fullExport:   ['Full export',    'Per-bin export still works; full account export is disabled.'],
  reorganize:   ['Reorganize',     'AI-powered bulk reorganization will be disabled.'],
  binSharing:   ['Bin sharing',    'Shared bin links will stop working.'],
  attachments:  ['Attachments',    "Existing attachments stay; you can't add new ones."],
};

function planLabelTitle(plan: 'free' | 'plus'): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

export function computeDowngradeImpact(input: ComputeImpactInput): DowngradeImpact {
  const { currentFeatures, targetFeatures, targetPlan, usage } = input;
  const warnings: DowngradeWarning[] = [];

  if (targetFeatures.maxBins !== null && usage.binCount > targetFeatures.maxBins) {
    const readOnly = usage.binCount - targetFeatures.maxBins;
    warnings.push({
      kind: 'usage-exceeded',
      title: `${usage.binCount} bins (${planLabelTitle(targetPlan)} allows ${targetFeatures.maxBins})`,
      description: `${readOnly} bin${readOnly === 1 ? '' : 's'} will become read-only.`,
    });
  }

  if (targetFeatures.maxLocations !== null && usage.locationCount > targetFeatures.maxLocations) {
    const readOnly = usage.locationCount - targetFeatures.maxLocations;
    warnings.push({
      kind: 'usage-exceeded',
      title: `${usage.locationCount} locations (${planLabelTitle(targetPlan)} allows ${targetFeatures.maxLocations})`,
      description: `${readOnly} location${readOnly === 1 ? '' : 's'} will become read-only.`,
    });
  }

  if (targetFeatures.maxPhotoStorageMb !== null && usage.photoStorageMb > targetFeatures.maxPhotoStorageMb) {
    warnings.push({
      kind: 'usage-exceeded',
      title: `${usage.photoStorageMb.toFixed(1)} MB photos (${planLabelTitle(targetPlan)} allows ${targetFeatures.maxPhotoStorageMb} MB)`,
      description: 'New photo uploads will be blocked until you delete some.',
    });
  }

  if (targetFeatures.maxMembersPerLocation !== null) {
    const overLocations = Object.entries(usage.memberCounts)
      .filter(([_, count]) => count > targetFeatures.maxMembersPerLocation!);
    if (overLocations.length > 0) {
      const totalOverMembers = overLocations.reduce(
        (sum, [_, count]) => sum + (count - targetFeatures.maxMembersPerLocation!),
        0,
      );
      warnings.push({
        kind: 'usage-exceeded',
        title: `${overLocations.length} location${overLocations.length === 1 ? '' : 's'} exceed${overLocations.length === 1 ? 's' : ''} ${planLabelTitle(targetPlan)}'s ${targetFeatures.maxMembersPerLocation} member${targetFeatures.maxMembersPerLocation === 1 ? '' : 's'} limit`,
        description: `${totalOverMembers} member${totalOverMembers === 1 ? '' : 's'} across these locations will become read-only.`,
      });
    }
  }

  for (const [key, [title, description]] of Object.entries(FEATURE_LABELS) as Array<[keyof typeof FEATURE_LABELS, [string, string]]>) {
    if (currentFeatures[key] && !targetFeatures[key]) {
      warnings.push({ kind: 'feature-loss', title, description });
    }
  }

  return { targetPlan, warnings };
}
