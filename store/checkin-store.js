import { create } from 'zustand';

// Identidad del escaneo en curso, para poder retomarlo si la sesión se cae.
//
// Existe por un caso REAL y acotado: el token expira **mientras se registra**.
// `services/api.js` intenta el refresh, si falla cierra la sesión, `RequireAuth`
// reacciona y manda a `/login` — y el identificador leído del QR se perdía
// justo cuando el corredor ya lo tenía leído y no quería volver a apuntar la
// cámara al cartel.
//
// No es "el caso de abrir la app sin sesión": ese no llega acá, porque el
// escáner vive detrás del menú, y el menú exige sesión. Lo que se guarda es un
// escaneo **ya realizado** que quedó a medio camino.
//
// Mismo patrón que `session-runtime-store.js#pendingSession`: un destino de
// navegación con sus datos, que la pantalla destino consume al montar. Se
// prefiere a un `?redirect=` en el login porque el login hace `replace('/')`
// fijo y el estado tiene que sobrevivir a esa navegación sin depender de que se
// pase adelante.
//
// El estado es efímero a propósito: no se persiste. Si la app se cierra con una
// sesión sin registrar, el siguiente escaneo lo reemplaza.
export const useCheckinStore = create((set) => ({
  pendingCheckin: null,
  // `stale` distingue "nunca escaneó" de "escaneó y no se pudo registrar": en el
  // segundo caso la pantalla puede avisar que fue hace un rato, en vez de
  //Trivia mostrar el escáner como si nada.
  setPendingCheckin: (payload, { stale = false } = {}) => set({ pendingCheckin: payload ? { ...payload, stale } : null }),
  clearPendingCheckin: () => set({ pendingCheckin: null }),
}));
