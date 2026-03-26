import { ChevronRight, ExternalLink, Info, Keyboard, LogOut, Monitor, Moon, Sparkles, Sun, UserCircle } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Disclosure } from '@/components/ui/disclosure';
import { OptionGroup } from '@/components/ui/option-group';
import { PageHeader } from '@/components/ui/page-header';
import { Switch } from '@/components/ui/switch';
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
import { useUserPreferences } from '@/lib/userPreferences';
import { ApiKeysSection } from './ApiKeysSection';
import { DangerZoneSection } from './DangerZoneSection';
import { DashboardSection } from './DashboardSection';
import { DataSection } from './DataSection';
import { PersonalizationSection } from './PersonalizationSection';
import { useDataSectionActions } from './useDataSectionActions';

export function SettingsPage() {
  const navigate = useNavigate();
  const { preference, setThemePreference } = useTheme();
  const { aiEnabled, setAiEnabled } = useAiEnabled();
  const { settings, updateSettings, resetSettings } = useAppSettings();
  const t = useTerminology();
  const { user, activeLocationId, logout, deleteAccount } = useAuth();
  const { isAdmin, isLoading: permissionsLoading } = usePermissions();
  const { preferences, updatePreferences } = useUserPreferences();
  const dataActions = useDataSectionActions();

  const { locations } = useLocationList();
  const activeLocation = locations.find((l) => l.id === activeLocationId);
  const binCount = activeLocation?.bin_count ?? 0;
  const { settings: dashSettings, updateSettings: updateDashSettings } = useDashboardSettings();

  // Scroll to a settings section when navigated with a hash (e.g. #ai-settings, #dashboard-settings)
  // Retry briefly to handle async-rendered sections
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
      if (++attempts < 10) {
        requestAnimationFrame(tryScroll);
      }
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

      {/* Account */}
      {user && (
        <Card>
          <CardContent>
            <Disclosure label={<span className="inline-flex items-center gap-1.5 text-[var(--text-primary)]"><UserCircle className="h-3.5 w-3.5" />Account</span>} labelClassName="text-[15px] font-semibold">
            <div className="flex flex-col gap-3 mt-1">
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] transition-colors w-full text-left"
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
              <Button
                variant="outline"
                onClick={logout}
                className="justify-start h-11 text-[var(--destructive)]"
              >
                <LogOut className="h-4 w-4 mr-2.5" />
                Sign Out
              </Button>
            </div>
            </Disclosure>
          </CardContent>
        </Card>
      )}

      {/* Dashboard */}
      <DashboardSection settings={dashSettings} updateSettings={updateDashSettings} />

      {/* Keyboard Shortcuts */}
      <Card>
        <CardContent>
          <Disclosure label={<span className="inline-flex items-center gap-1.5 text-[var(--text-primary)]"><Keyboard className="h-3.5 w-3.5" />Keyboard Shortcuts</span>} labelClassName="text-[15px] font-semibold">
          <div className="mt-1">
            <div className="row-spread py-1">
              <div>
                <span className="text-[14px] text-[var(--text-primary)]">Enable keyboard shortcuts</span>
                <p className="text-[13px] text-[var(--text-tertiary)] mt-0.5">
                  Press <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-[var(--radius-sm)] bg-[var(--bg-input)] font-mono text-[11px] text-[var(--text-secondary)] leading-none">?</kbd> to view all shortcuts
                </p>
              </div>
              <Switch
                checked={preferences.keyboard_shortcuts_enabled}
                onCheckedChange={(checked) => updatePreferences({ keyboard_shortcuts_enabled: checked })}
              />
            </div>
          </div>
          </Disclosure>
        </CardContent>
      </Card>

      {/* AI Settings (admin only) */}
      {(isAdmin || permissionsLoading) && <AiSettingsSection aiEnabled={aiEnabled} onToggle={setAiEnabled} />}

      {/* API Keys (admin only) */}
      {(isAdmin || permissionsLoading) && aiEnabled && <ApiKeysSection />}

      {/* Data (admin only) */}
      {(isAdmin || permissionsLoading) && (
        <DataSection
          activeLocationId={activeLocationId}
          actions={dataActions}
          locationName={activeLocation?.name}
        />
      )}

      {/* Personalization (admin only) */}
      {(isAdmin || permissionsLoading) && (
        <PersonalizationSection
          settings={settings}
          updateSettings={updateSettings}
          resetSettings={resetSettings}
        />
      )}

      {/* About */}
      <Card>
        <CardContent>
          <Disclosure label={<span className="inline-flex items-center gap-1.5 text-[var(--text-primary)]"><Info className="h-3.5 w-3.5" />About</span>} labelClassName="text-[15px] font-semibold">
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
                className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
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
                className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
              >
                <Sparkles className="h-3 w-3" />
                Replay Tour
              </button>
            </div>
          </div>
          </Disclosure>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      {user && <DangerZoneSection deleteAccount={deleteAccount} />}
    </div>
  );
}
