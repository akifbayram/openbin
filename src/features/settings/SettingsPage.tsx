import {
  ChevronRight,
  ExternalLink,
  Info,
  Keyboard,
  Monitor,
  Moon,
  Shield,
  Sparkles,
  Sun,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Disclosure } from '@/components/ui/disclosure';
import { OptionGroup } from '@/components/ui/option-group';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { Switch } from '@/components/ui/switch';
import { UpgradePrompt } from '@/components/ui/upgrade-prompt';
import { UserAvatar } from '@/components/ui/user-avatar';
import { AiSettingsSection } from '@/features/ai/AiSettingsSection';
import { useLocationList } from '@/features/locations/useLocations';
import { useAiEnabled } from '@/lib/aiToggle';
import { getAvatarUrl } from '@/lib/api';
import { useAppSettings } from '@/lib/appSettings';
import { useAuth } from '@/lib/auth';
import { useDashboardSettings } from '@/lib/dashboardSettings';
import { useTerminology } from '@/lib/terminology';
import { useTheme } from '@/lib/theme';
import { usePermissions } from '@/lib/usePermissions';
import { usePlan } from '@/lib/usePlan';
import { useUserPreferences } from '@/lib/userPreferences';
import { categoryHeader, cn, focusRing } from '@/lib/utils';
import { ApiKeysSection } from './ApiKeysSection';
import { DangerZoneSection } from './DangerZoneSection';
import { DashboardSection } from './DashboardSection';
import { DataSection } from './DataSection';
import { PersonalizationSection } from './PersonalizationSection';
import { SubscriptionSection } from './SubscriptionSection';
import { useDataSectionActions } from './useDataSectionActions';

const SEARCH_KEYWORDS: Record<string, string[]> = {
  account: ['profile', 'admin', 'subscription', 'plan', 'billing', 'upgrade', 'pro', 'lite', 'trial', 'avatar', 'password'],
  preferences: ['dashboard', 'keyboard', 'shortcuts', 'personalization', 'terminology', 'app name', 'theme', 'widgets', 'stats', 'bins', 'scan'],
  integrations: ['ai', 'api', 'key', 'openai', 'anthropic', 'gemini', 'provider', 'model', 'prompt', 'automation'],
  data: ['export', 'import', 'backup', 'activity', 'trash', 'csv', 'json', 'zip', 'download'],
  about: ['version', 'github', 'tour', 'members', 'bins', 'areas'],
  danger: ['delete', 'account', 'remove', 'permanent'],
};

function SettingsGroup({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-20">
      <h2 id={`${id}-heading`} className={cn(categoryHeader, 'px-1 mb-2.5')}>
        {label}
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { preference, setThemePreference } = useTheme();
  const { aiEnabled, setAiEnabled } = useAiEnabled();
  const { settings, updateSettings, resetSettings } = useAppSettings();
  const t = useTerminology();
  const { user, activeLocationId, deleteAccount, demoMode } = useAuth();
  const { isAdmin, isLoading: permissionsLoading } = usePermissions();
  const { preferences, updatePreferences } = useUserPreferences();
  const { isGated, isSelfHosted, planInfo } = usePlan();
  const aiGated = !isSelfHosted && isGated('ai');
  const apiKeysGated = !isSelfHosted && isGated('apiKeys');
  const dataActions = useDataSectionActions();
  const { locations } = useLocationList();
  const activeLocation = locations.find((l) => l.id === activeLocationId);
  const binCount = activeLocation?.bin_count ?? 0;
  const { settings: dashSettings, updateSettings: updateDashSettings } = useDashboardSettings();

  const [searchQuery, setSearchQuery] = useState('');
  const isVisible = useMemo(() => {
    if (!searchQuery.trim()) return () => true;
    const q = searchQuery.toLowerCase();
    return (sectionId: string) => {
      const keywords = SEARCH_KEYWORDS[sectionId] ?? [];
      return keywords.some((k) => k.includes(q)) || sectionId.includes(q);
    };
  }, [searchQuery]);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    let attempts = 0;
    const tryScroll = () => {
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
      if (++attempts < 10) requestAnimationFrame(tryScroll);
    };
    tryScroll();
  }, []);

  return (
    <div className="page-content">
      <PageHeader
        title="Settings"
        actions={
          <OptionGroup
            options={[
              { key: 'light' as const, label: 'Light', icon: Sun },
              { key: 'dark' as const, label: 'Dark', icon: Moon },
              { key: 'auto' as const, label: 'Auto', icon: Monitor },
            ]}
            value={preference}
            onChange={setThemePreference}
            iconOnly
          />
        }
      />

      <SearchInput
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onClear={searchQuery ? () => setSearchQuery('') : undefined}
        placeholder="Search settings..."
      />

      {searchQuery.trim() && !['account', 'preferences', 'integrations', 'data', 'about', 'danger'].some((id) => isVisible(id)) && (
        <p className="text-center text-[14px] text-[var(--text-tertiary)] py-8">
          No settings match &ldquo;{searchQuery}&rdquo;
        </p>
      )}

      {/* ACCOUNT */}
      {isVisible('account') && (
        <SettingsGroup id="account" label="Account">
          {user?.isAdmin && (
            <Card>
              <CardContent>
                <button
                  type="button"
                  onClick={() => navigate('/admin/users')}
                  className={cn('flex items-center justify-between w-full text-[15px] font-semibold rounded-[var(--radius-xs)] hover:opacity-70 transition-opacity', focusRing)}
                >
                  <span className="inline-flex items-center gap-1.5 text-[var(--text-primary)]">
                    <Shield className="h-4 w-4" />
                    Admin
                  </span>
                  <ChevronRight className="h-4 w-4 text-[var(--text-tertiary)]" />
                </button>
              </CardContent>
            </Card>
          )}

          {user && (
            <Card>
              <CardContent>
                <button
                  type="button"
                  onClick={() => navigate('/profile')}
                  className={cn('flex items-center gap-3 w-full text-left rounded-[var(--radius-xs)] hover:opacity-70 transition-opacity', focusRing)}
                >
                  <UserAvatar
                    avatarUrl={user.avatarUrl ? getAvatarUrl(user.avatarUrl) : null}
                    displayName={user.displayName || user.username}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-[var(--text-primary)] truncate">
                      {user.displayName || user.username}
                    </p>
                    <p className="text-[13px] text-[var(--text-tertiary)]">@{user.username}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
                </button>
              </CardContent>
            </Card>
          )}

          {!demoMode && <SubscriptionSection />}
        </SettingsGroup>
      )}

      {/* PREFERENCES */}
      {isVisible('preferences') && (
        <SettingsGroup id="preferences" label="Preferences">
          <DashboardSection settings={dashSettings} updateSettings={updateDashSettings} />

          <Card>
            <CardContent>
              <div className="row-spread">
                <div className="flex items-center gap-3">
                  <Keyboard className="h-4 w-4 text-[var(--text-tertiary)]" />
                  <div>
                    <span id="kbd-shortcuts-label" className="text-[15px] font-medium text-[var(--text-primary)]">
                      Keyboard Shortcuts
                    </span>
                    <p className="text-[13px] text-[var(--text-tertiary)] mt-0.5">
                      Press{' '}
                      <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-[var(--radius-sm)] bg-[var(--bg-input)] font-mono text-[11px] text-[var(--text-secondary)] leading-none">
                        ?
                      </kbd>{' '}
                      to view all shortcuts
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.keyboard_shortcuts_enabled}
                  onCheckedChange={(checked) => updatePreferences({ keyboard_shortcuts_enabled: checked })}
                  aria-labelledby="kbd-shortcuts-label"
                />
              </div>
            </CardContent>
          </Card>

          {!demoMode && (isAdmin || permissionsLoading) && (
            <PersonalizationSection
              settings={settings}
              updateSettings={updateSettings}
              resetSettings={resetSettings}
            />
          )}
        </SettingsGroup>
      )}

      {/* INTEGRATIONS */}
      {isVisible('integrations') && (isAdmin || permissionsLoading) && (
        <SettingsGroup id="integrations" label="Integrations">
          {aiGated ? (
            <UpgradePrompt
              feature="AI Features"
              description="Enable AI-powered suggestions and commands."
              upgradeUrl={planInfo.upgradeUrl}
            />
          ) : (
            <AiSettingsSection aiEnabled={aiEnabled} onToggle={setAiEnabled} />
          )}
          {aiEnabled && !demoMode &&
            (apiKeysGated ? (
              <UpgradePrompt
                feature="API Keys"
                description="Create API keys to integrate with external tools."
                upgradeUrl={planInfo.upgradeUrl}
              />
            ) : (
              <ApiKeysSection />
            ))}
        </SettingsGroup>
      )}

      {/* DATA */}
      {isVisible('data') && !demoMode && (isAdmin || permissionsLoading) && (
        <SettingsGroup id="data" label="Data">
          <DataSection
            activeLocationId={activeLocationId}
            actions={dataActions}
            locationName={activeLocation?.name}
          />
        </SettingsGroup>
      )}

      {/* ABOUT */}
      {isVisible('about') && (
        <Card>
          <CardContent>
            <Disclosure
              label={<span className="inline-flex items-center gap-1.5 text-[var(--text-primary)]"><Info className="h-4 w-4" />About</span>}
              labelClassName="text-[15px] font-semibold"
            >
              <div className="mt-1 space-y-2 text-[15px] text-[var(--text-secondary)]">
                <div className="flex items-baseline gap-2">
                  <p className="font-semibold text-[var(--text-primary)]">{settings.appName}</p>
                  <span className="text-[13px] text-[var(--text-tertiary)]">v{__APP_VERSION__}</span>
                </div>
                {activeLocation && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                    <span>{binCount} {binCount !== 1 ? t.bins : t.bin}</span>
                    {activeLocation.area_count != null && (
                      <span>{activeLocation.area_count} {activeLocation.area_count !== 1 ? t.areas : t.area}</span>
                    )}
                    {activeLocation.member_count != null && (
                      <span>{activeLocation.member_count} {activeLocation.member_count === 1 ? 'member' : 'members'}</span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-4">
                  <a
                    href="https://github.com/akifbayram/openbin"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn('inline-flex items-center gap-1.5 text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors rounded-[var(--radius-xs)]', focusRing)}
                  >
                    GitHub
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      updatePreferences({ tour_completed: false, tour_version: 0 });
                      navigate('/bins', { state: { startTour: true } });
                    }}
                    className={cn('inline-flex items-center gap-1.5 text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors rounded-[var(--radius-xs)]', focusRing)}
                  >
                    <Sparkles className="h-3 w-3" />
                    Replay Tour
                  </button>
                </div>
              </div>
            </Disclosure>
          </CardContent>
        </Card>
      )}

      {/* DANGER ZONE */}
      {isVisible('danger') && user && (
        <DangerZoneSection deleteAccount={deleteAccount} />
      )}
    </div>
  );
}
