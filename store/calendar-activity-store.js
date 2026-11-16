import { create } from 'zustand';

function normalizeScopeId(scopeId) {
  return scopeId == null ? null : String(scopeId);
}

function normalizeDates(dates) {
  const list = Array.isArray(dates) ? dates : [dates];
  return Array.from(new Set(list.filter((date) => date != null && date !== '').map(String)));
}

export function isCalendarDatePending(activityByScope, scopeId, date) {
  const scope = normalizeScopeId(scopeId);
  if (!scope || date == null || date === '') return false;
  return (activityByScope?.[scope]?.[String(date)] ?? 0) > 0;
}

export const useCalendarActivityStore = create((set) => ({
  activityByScope: {},
  startActivity: (scopeId, dates) => {
    const scope = normalizeScopeId(scopeId);
    const normalizedDates = normalizeDates(dates);
    if (!scope || normalizedDates.length === 0) return;
    set((state) => {
      const scopeActivity = { ...(state.activityByScope[scope] ?? {}) };
      for (const date of normalizedDates) {
        scopeActivity[date] = (scopeActivity[date] ?? 0) + 1;
      }
      return { activityByScope: { ...state.activityByScope, [scope]: scopeActivity } };
    });
  },
  finishActivity: (scopeId, dates) => {
    const scope = normalizeScopeId(scopeId);
    const normalizedDates = normalizeDates(dates);
    if (!scope || normalizedDates.length === 0) return;
    set((state) => {
      const currentScope = state.activityByScope[scope];
      if (!currentScope) return state;
      const scopeActivity = { ...currentScope };
      for (const date of normalizedDates) {
        const nextCount = (scopeActivity[date] ?? 0) - 1;
        if (nextCount > 0) scopeActivity[date] = nextCount;
        else delete scopeActivity[date];
      }
      const activityByScope = { ...state.activityByScope };
      if (Object.keys(scopeActivity).length === 0) delete activityByScope[scope];
      else activityByScope[scope] = scopeActivity;
      return { activityByScope };
    });
  },
  clearScope: (scopeId) => {
    const scope = normalizeScopeId(scopeId);
    if (!scope) return;
    set((state) => {
      if (!state.activityByScope[scope]) return state;
      const activityByScope = { ...state.activityByScope };
      delete activityByScope[scope];
      return { activityByScope };
    });
  },
  clearAll: () => set({ activityByScope: {} }),
}));

export function useCalendarDateActivity(scopeId, date) {
  return useCalendarActivityStore((state) => isCalendarDatePending(state.activityByScope, scopeId, date));
}
