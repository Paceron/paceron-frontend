import { useEffect, useRef, useState } from 'react';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { isWeb } from '../utils/platform.js';

// Intercepta la salida de un form con cambios sin guardar: back
// nativo/gesto/header (usePreventRemove, cubre remoción de ruta real) y
// cierre explícito vía `guardedClose` (para botones de back propios que
// llaman router.back()/router.replace() a mano, y para modales de RN que
// no son rutas — ver components/shared/discard-changes-modal.jsx).
//
// `bypassing`: al confirmar el descarte, el form sigue "sucio" (nunca se
// resetea, no hay razón para hacerlo si nos vamos) — si se disparara la
// navegación real inmediatamente, `usePreventRemove` la volvería a
// interceptar (su listener lee `isDirty` en el momento del dispatch, no
// en el momento en que se mostró el modal) y habría que confirmar dos
// veces. Este flag apaga el guard un render antes de ejecutar la acción
// pendiente, para que la navegación real ya no encuentre nada que
// bloquear.
export function useUnsavedChangesGuard(isDirty) {
  const navigation = useNavigation();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [bypassing, setBypassing] = useState(false);
  const pendingActionRef = useRef(null);
  const effectiveIsDirty = isDirty && !bypassing;

  usePreventRemove(effectiveIsDirty, (e) => {
    pendingActionRef.current = () => navigation.dispatch(e.data.action);
    setConfirmVisible(true);
  });

  useEffect(() => {
    if (!isWeb) return undefined;
    const handler = (e) => {
      if (!effectiveIsDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [effectiveIsDirty]);

  useEffect(() => {
    if (!bypassing || !pendingActionRef.current) return;
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    action();
  }, [bypassing]);

  const guardedClose = (closeFn) => {
    if (!effectiveIsDirty) {
      closeFn();
      return;
    }
    pendingActionRef.current = closeFn;
    setConfirmVisible(true);
  };

  const confirmDiscard = () => {
    setConfirmVisible(false);
    setBypassing(true);
  };

  const cancelDiscard = () => setConfirmVisible(false);

  // Para navegar después de un submit exitoso: el form sigue "sucio" (los
  // valores no se resetean, no hay razón si nos vamos de la pantalla), así
  // que sin esto `usePreventRemove` interceptaría esta misma navegación
  // como si fuera una salida sin confirmar — mismo mecanismo de bypass que
  // confirmDiscard, pero sin mostrar el modal (acá no hay nada que
  // descartar, el guardado ya fue exitoso).
  const bypassGuard = (action) => {
    pendingActionRef.current = action;
    setBypassing(true);
  };

  return { confirmVisible, guardedClose, confirmDiscard, cancelDiscard, bypassGuard };
}
