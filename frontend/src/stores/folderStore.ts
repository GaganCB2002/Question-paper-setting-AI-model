import { create } from 'zustand';
import { api } from '../lib/api';

export interface FolderItem {
  id: string;
  name: string;
  description?: string | null;
  parent_id?: string | null;
  color?: string | null;
  icon?: string | null;
  sort_order?: number | null;
  file_count: number;
  created_at: string;
  updated_at: string;
  children?: FolderItem[];
}

interface FolderState {
  folders: FolderItem[];
  tree: FolderItem[];
  currentFolder: FolderItem | null;
  loading: boolean;
  error: string | null;
  fetchFolders: (parentId?: string) => Promise<void>;
  fetchTree: () => Promise<void>;
  fetchFolder: (id: string) => Promise<void>;
  createFolder: (data: { name: string; description?: string; parent_id?: string; color?: string }) => Promise<boolean>;
  updateFolder: (id: string, data: { name?: string; description?: string; color?: string }) => Promise<boolean>;
  deleteFolder: (id: string, recursive?: boolean) => Promise<boolean>;
  setCurrentFolder: (folder: FolderItem | null) => void;
}

export const useFolderStore = create<FolderState>((set, get) => ({
  folders: [],
  tree: [],
  currentFolder: null,
  loading: false,
  error: null,

  fetchFolders: async (parentId?: string) => {
    set({ loading: true, error: null });
    const res = await api.listFolders(parentId);
    if (res.success) {
      set({ folders: res.data?.items || [], loading: false });
    } else {
      set({ error: res.error || 'Failed to load folders', loading: false });
    }
  },

  fetchTree: async () => {
    set({ loading: true, error: null });
    const res = await api.getFolderTree();
    if (res.success) {
      set({ tree: res.data || [], loading: false });
    } else {
      set({ error: res.error || 'Failed to load folder tree', loading: false });
    }
  },

  fetchFolder: async (id: string) => {
    set({ loading: true, error: null });
    const res = await api.getFolder(id);
    if (res.success) {
      set({ currentFolder: res.data, loading: false });
    } else {
      set({ error: res.error || 'Failed to load folder', loading: false });
    }
  },

  createFolder: async (data) => {
    set({ loading: true, error: null });
    const res = await api.createFolder(data);
    if (res.success) {
      await get().fetchFolders(data.parent_id);
      await get().fetchTree();
      set({ loading: false });
      return true;
    }
    set({ error: res.error || 'Failed to create folder', loading: false });
    return false;
  },

  updateFolder: async (id, data) => {
    set({ loading: true, error: null });
    const res = await api.updateFolder(id, data);
    if (res.success) {
      await get().fetchFolders();
      await get().fetchTree();
      if (get().currentFolder?.id === id) {
        set({ currentFolder: res.data });
      }
      set({ loading: false });
      return true;
    }
    set({ error: res.error || 'Failed to update folder', loading: false });
    return false;
  },

  deleteFolder: async (id, recursive = false) => {
    set({ loading: true, error: null });
    const res = await api.deleteFolder(id, recursive);
    if (res.success) {
      await get().fetchFolders();
      await get().fetchTree();
      if (get().currentFolder?.id === id) {
        set({ currentFolder: null });
      }
      set({ loading: false });
      return true;
    }
    set({ error: res.error || 'Failed to delete folder', loading: false });
    return false;
  },

  setCurrentFolder: (folder) => set({ currentFolder: folder }),
}));
