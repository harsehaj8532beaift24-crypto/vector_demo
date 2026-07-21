"use client";

import { create } from "zustand";

/**
 * Ephemeral UI state only — never server data (that's React Query's job).
 * The roadmap canvas (Phase 7) reads/writes selection and panel state here.
 */
interface UiState {
  selectedTaskId: string | null;
  detailPanelOpen: boolean;
  selectTask: (id: string | null) => void;
  closeDetail: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedTaskId: null,
  detailPanelOpen: false,
  selectTask: (id) => set({ selectedTaskId: id, detailPanelOpen: id !== null }),
  closeDetail: () => set({ detailPanelOpen: false, selectedTaskId: null }),
}));
