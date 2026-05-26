import { create } from 'zustand';
import api from '../api/client';

interface PanelSettings {
  panel_name: string;
  panel_description: string;
  panel_color: string;
}

interface SettingsStore {
  settings: PanelSettings;
  loaded: boolean;
  load: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: { panel_name: 'Palto-Network', panel_description: '', panel_color: '#7c3aed' },
  loaded: false,
  load: async () => {
    try {
      const res = await api.get('/settings');
      set({ settings: res.data, loaded: true });
    } catch {}
  },
}));
