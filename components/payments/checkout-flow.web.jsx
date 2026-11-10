import { useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { CheckoutBrick } from './checkout-brick.web.jsx';
import { IconTooltip } from '../shared/icon-tooltip.jsx';

// Wrapper de chrome para CheckoutBrick — modal centrado (no fullscreen,
// a diferencia de la rama nativa) porque en web hay más ancho disponible
// y este mismo patrón (Modal transparent + backdrop + card centrada,
// border+shadow+p-6, alto tope con ScrollView interno para contenido de
// alto variable) ya es el establecido en el repo para diálogos (ver
// components/team/delete-team-modal.jsx, components/plans/create-session-modal.jsx).
// Sin cierre al clickear afuera del backdrop — a propósito, mismo criterio
// que el resto de los modales de confirmación del repo (10 de 11 no
// cierran así; la única excepción, usage-list-modal.jsx, es informativa,
// sin riesgo de perder datos cargados). Firma idéntica a checkout-flow.jsx
// (nativo) — ambas variantes de plataforma aceptan las mismas props. Ver
// docs/superpowers/specs/2026-09-04-checkout-modal-unification-design.md.
export function CheckoutFlow({ preferenceId, publicKey, amount, installmentId, marketplace, concept, onApproved, onError, onCancel }) {
  const colors = useThemeColors();
  // Bug real reportado 2026-11-08: la tarjeta usaba `max-h-[90%]` de un
  // padre `flex-1` -- ese 90% se recalcula contra el alto de VENTANA EN
  // VIVO. En mobile web, tocar un input del Brick abre el teclado y
  // `window.innerHeight` se achica para no tapar nada -- la tarjeta
  // volvía a encogerse en cascada sobre ese alto ya reducido, dando la
  // sensación de haberse cerrado. `Dimensions.get` (no el hook
  // `useWindowDimensions`, que SÍ re-renderiza con cada resize) capturado
  // una sola vez al montar: el tope de alto queda fijo en píxeles desde
  // el arranque, así que abrir el teclado ya no dispara un nuevo cálculo.
  const [maxCardHeight] = useState(() => Dimensions.get('window').height * 0.9);

  return (
    <Modal animationType="fade" nativeID="checkout-flow-modal" onRequestClose={onCancel} testID="checkout-flow-modal" transparent visible>
      <View className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="checkout-flow-modal-backdrop" testID="checkout-flow-modal-backdrop">
        <View className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="checkout-flow-modal-card" style={{ maxHeight: maxCardHeight }} testID="checkout-flow-modal-card">
          <View className="mb-3 flex-row items-center justify-between" nativeID="checkout-flow-modal-header" testID="checkout-flow-modal-header">
            <Text className="text-sm font-bold text-slate-900 dark:text-white" nativeID="checkout-flow-modal-title" testID="checkout-flow-modal-title">
              Checkout
            </Text>
            <IconTooltip idPrefix="checkout-flow-modal-close-button-tooltip" label="Cerrar">
              <Pressable
                accessibilityLabel="Cerrar"
                className="p-1 hover:opacity-70 active:opacity-70"
                nativeID="checkout-flow-modal-close-button"
                onPress={onCancel}
                testID="checkout-flow-modal-close-button"
              >
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={22} />
              </Pressable>
            </IconTooltip>
          </View>
          <ScrollView nativeID="checkout-flow-modal-scroll" showsVerticalScrollIndicator={false} testID="checkout-flow-modal-scroll">
            <CheckoutBrick
              amount={amount}
              concept={concept}
              installmentId={installmentId}
              marketplace={marketplace}
              onApproved={onApproved}
              onError={onError}
              preferenceId={preferenceId}
              publicKey={publicKey}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
