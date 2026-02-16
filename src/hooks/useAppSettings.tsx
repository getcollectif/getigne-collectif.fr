import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import {
  applySiteTheme,
  DeepPartial,
  DEFAULT_SITE_SETTINGS,
  normalizeSiteSettings,
  SiteSettings,
  SiteSettingsByKey,
  SiteSettingsSection,
  siteSettingsSections,
  mergeSiteSettings,
} from '../config/siteSettings';

type AppSettingsContextType = {
  settings: SiteSettings;
  loading: boolean;
  error: Error | null;
  updateSetting: <K extends SiteSettingsSection>(
    key: K,
    value: SiteSettingsByKey[K]
  ) => Promise<boolean>;
  updateSettings: (nextSettings: SiteSettings) => Promise<boolean>;
  refresh: () => Promise<void>;
};

const AppSettingsContext = createContext<AppSettingsContextType>({
  settings: DEFAULT_SITE_SETTINGS,
  loading: false,
  error: null,
  updateSetting: async () => false,
  updateSettings: async () => false,
  refresh: async () => {},
});

async function fetchAppSettingsRows() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value');
  if (error) throw error;
  return data ?? [];
}

export const AppSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const rows = await fetchAppSettingsRows();
      const nextSettings = normalizeSiteSettings(rows);
      setSettings(nextSettings);
    } catch (err) {
      console.error('Erreur lors de la récupération des paramètres:', err);
      setError(err instanceof Error ? err : new Error('Erreur inconnue'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    applySiteTheme(settings);
  }, [settings]);

  const updateSetting = async <K extends SiteSettingsSection>(
    key: K,
    value: SiteSettingsByKey[K]
  ) => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert(
          { key, value, description: `Configuration ${key}` },
          { onConflict: 'key' }
        );
      if (error) throw error;

      const merged = mergeSiteSettings(settings, { [key]: value } as DeepPartial<SiteSettings>);
      setSettings(merged);
      return true;
    } catch (err) {
      console.error('Erreur lors de la mise à jour du paramètre:', err);
      return false;
    }
  };

  const updateSettings = async (nextSettings: SiteSettings) => {
    try {
      const updates = siteSettingsSections.map((section) => ({
        key: section,
        value: nextSettings[section],
        description: `Configuration ${section}`,
      }));

      const { error } = await supabase
        .from('app_settings')
        .upsert(updates, { onConflict: 'key' });

      if (error) throw error;
      setSettings(nextSettings);
      return true;
    } catch (err) {
      console.error('Erreur lors de la mise à jour des paramètres:', err);
      return false;
    }
  };

  return (
    <AppSettingsContext.Provider
      value={{
        settings,
        loading,
        error,
        updateSetting,
        updateSettings,
        refresh,
      }}
    >
      {children}
    </AppSettingsContext.Provider>
  );
};

export const useAppSettings = () => useContext(AppSettingsContext);
