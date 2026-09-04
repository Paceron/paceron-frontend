# Unificación de CheckoutFlow como modal (web + nativo)

## Contexto

`CheckoutFlow` (`components/payments/checkout-flow.jsx` / `.web.jsx`) es el
componente de checkout de Mercado Pago, ya usado por `tier-upgrade-screen.jsx`
(Fase 1, PR #97) y por la pantalla de prueba `payments-testbed-screen.jsx`.
Hoy las dos ramas de plataforma tienen formas distintas:

- **Nativo** (`checkout-flow.jsx`): ya es un `Modal` de React Native,
  fullscreen con animación slide, header propio ("Checkout" + botón X) y un
  `WebView` adentro apuntando a `checkout-web-page.jsx` (la ruta `/checkout`,
  deployada en Vercel — página aislada sin shell ni `RequireAuth`, pensada
  solo para cargarse dentro de ese WebView).
- **Web** (`checkout-flow.web.jsx`): es el Brick real de Mercado Pago
  (`@mercadopago/sdk-react`), sin chrome propio. Cada caller lo envuelve a
  mano en un `SectionCard` inline (sección más dentro de la misma pantalla),
  y solo la rama nativa acepta `onCancel` — asimetría ya señalada como
  aceptada en el comentario del propio archivo.

Probando el flujo de Fase 1 con mocks (ver sesión 2026-09-04), confirmamos
visualmente que ese patrón de "sección inline" no escala: el próximo caller
real de `CheckoutFlow` es el pago del corredor para unirse a un equipo (idea
anotada como comodín, ver `team-search-join-requests-spec`), disparado desde
una pantalla de equipo, no de perfil — replicar a mano el `SectionCard` +
lógica de apertura/cierre en cada pantalla nueva no es sostenible.

## Objetivo

`CheckoutFlow` pasa a ser un **modal autocontenido en ambas plataformas** —
mismo contrato de props, mismo patrón de uso desde cualquier caller: el
caller solo setea/limpia el estado que dispara la apertura, sin armar chrome
propio.

- **Nativo:** sin cambios de comportamiento — ya es el modal fullscreen +
  WebView descripto arriba.
- **Web:** pasa de Brick suelto a modal centrado (`Modal transparent` +
  backdrop + card `max-w-lg`), mismo patrón visual ya establecido en el repo
  (`components/team/delete-team-modal.jsx` y el resto de los modales de
  confirmación) — sin inventar un componente de diálogo nuevo.

## Problema a resolver: doble chrome en el WebView nativo

`checkout-web-page.jsx` (la página `/checkout`) importa hoy
`CheckoutFlow` desde `./checkout-flow` (sin extensión, resolución por
plataforma) — en un bundle web esto resuelve a `checkout-flow.web.jsx`. Si
esa variante empieza a dibujar su propio modal + header + X, la página
queda con **doble chrome anidado**: el modal nativo (con su header/X) ya
envuelve el WebView, y adentro el WebView carga una página que ahora también
se dibuja a sí misma dentro de otro modal con otro header/X.

**Solución:** separar el Brick puro del chrome de modal en dos archivos:

- **`components/payments/checkout-brick.web.jsx`** (nuevo) — el Brick sin
  chrome: exactamente el contenido actual de `checkout-flow.web.jsx`
  (`initMercadoPago`, `Payment`, `StatusScreen`, `handleSubmit`,
  `handleError`), renombrado de `CheckoutFlow` a `CheckoutBrick`. Mismas
  props que hoy (`preferenceId`, `publicKey`, `amount`, `installmentId`,
  `marketplace`, `onApproved`, `onError`) — sin `onCancel`, el Brick no tiene
  noción de "cerrar", eso vive en el chrome.
- **`components/payments/checkout-flow.web.jsx`** (reescrito) — wrapper
  delgado: `Modal` con chrome (header + X) envolviendo `<CheckoutBrick
  {...props} />`. Ver sección "Diseño del modal web" para el detalle visual.
- **`checkout-web-page.jsx`** cambia su import de `CheckoutFlow` (sin
  extensión) a `CheckoutBrick` desde `./checkout-brick.web.jsx` **con
  extensión explícita** — a propósito: esta página siempre corre en un
  bundle web (la carga un WebView, no importa la plataforma final), así que
  no aplica el mecanismo de resolución por plataforma de Metro (ver quirk en
  `CLAUDE.md`); acá se quiere, sin ambigüedad, siempre el Brick sin chrome.

Nativo (`checkout-flow.jsx`) no se toca — no tiene este problema, nunca
renderiza el Brick directamente.

## Diseño del modal web

`checkout-flow.web.jsx` reescrito:

```jsx
import { Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { CheckoutBrick } from './checkout-brick.web.jsx';

export function CheckoutFlow({ preferenceId, publicKey, amount, installmentId, marketplace, onApproved, onError, onCancel }) {
  const colors = useThemeColors();

  return (
    <Modal animationType="fade" nativeID="checkout-flow-modal" onRequestClose={onCancel} testID="checkout-flow-modal" transparent visible>
      <View className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="checkout-flow-modal-backdrop" testID="checkout-flow-modal-backdrop">
        <View className="w-full max-w-lg rounded-2xl bg-white p-4 dark:bg-surface" nativeID="checkout-flow-modal-card" testID="checkout-flow-modal-card">
          <View className="mb-3 flex-row items-center justify-between" nativeID="checkout-flow-modal-header" testID="checkout-flow-modal-header">
            <Text className="text-sm font-bold text-slate-900 dark:text-white" nativeID="checkout-flow-modal-title" testID="checkout-flow-modal-title">Checkout</Text>
            <Pressable
              accessibilityLabel="Cerrar"
              className="p-1 hover:opacity-70 active:opacity-70"
              nativeID="checkout-flow-modal-close-button"
              onPress={onCancel}
              testID="checkout-flow-modal-close-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={22} />
            </Pressable>
          </View>
          <CheckoutBrick amount={amount} installmentId={installmentId} marketplace={marketplace} onApproved={onApproved} onError={onError} preferenceId={preferenceId} publicKey={publicKey} />
        </View>
      </View>
    </Modal>
  );
}
```

Notas:

- `max-w-lg` (no `max-w-md`, como los modales de confirmación existentes)
  porque el Brick necesita más ancho que un diálogo de confirmación
  (formulario de tarjeta completo) — sigue degradando a ancho completo menos
  el padding en viewports angostos, mismo patrón responsive que ya usan los
  modales existentes, sin rama `isWeb`/`isNarrowWeb` adicional.
- Si el contenido del Brick excede el alto visible, agregar scroll interno
  es un ajuste de implementación (envolver `CheckoutBrick` en un
  `ScrollView` con `maxHeight`), no un cambio de diseño — a confirmar
  visualmente al implementar.
- No hay caso especial para cuando `approvedPaymentId` está seteado (fase
  `StatusScreen` del Brick, adentro de `CheckoutBrick`): el botón X del
  chrome sigue montado igual en todo momento. Cerrar en ese estado ya es
  responsabilidad del caller vía `onApproved`, que normalmente limpia el
  estado que controla si el modal está montado.
- **Nueva propiedad `onCancel`, antes solo nativa.** Callers existentes
  (`tier-upgrade-screen.jsx`) ya pasan `onCancel` hoy (ignorado en el web de
  antes) — no hace falta agregar la prop en los callers, empieza a
  funcionar sola.

## Cambios en callers existentes

- **`components/profile/tier-upgrade-screen.jsx`**: el bloque
  ```jsx
  {checkoutData && (
    <SectionCard icon="credit-card-outline" title="Checkout">
      <CheckoutFlow ... />
    </SectionCard>
  )}
  ```
  pasa a
  ```jsx
  {checkoutData && <CheckoutFlow ... onCancel={handleCheckoutCancel} />}
  ```
  (se saca el `SectionCard`, `onCancel` ya está siendo pasado hoy — sin
  cambios en esa línea). El import de `SectionCard` se mantiene si la
  pantalla lo sigue usando para las cards de tiers (confirmar al tocar el
  archivo).
- **`components/payments/payments-testbed-screen.jsx`**: mismo cambio —
  saca el `SectionCard icon="credit-card-outline" title="Checkout"` que
  envuelve a `CheckoutFlow`.

## Fuera de alcance

- El flujo de pago-a-equipo (corredor paga para unirse) no se implementa
  acá — este refactor solo deja `CheckoutFlow` listo para que ese futuro
  caller lo use sin fricción (mismo patrón: setear estado, renderizar
  `{checkoutData && <CheckoutFlow ... />}`, listo).
- El bug de fotos de equipo no mostrándose en listados (ícono default
  siempre) es un problema no relacionado, reportado en la misma
  conversación — se aborda en su propia rama, no acá.
- No se toca `checkout-web-page.jsx` más que el import (sigue sin shell,
  sin `RequireAuth`, mismo contrato de query params).

## Testing

Sin tests de render de componentes (convención del repo, ver CLAUDE.md).
Verificación manual: preview web con mocks (`EXPO_PUBLIC_USE_MOCKS=true`) —
confirmar que el modal centrado abre/cierra correctamente desde
`tier-upgrade-screen.jsx`, que el botón X dispara `onCancel`, y que
`checkout-web-page.jsx` (accedido directo por URL con query params de
prueba) sigue mostrando el Brick sin chrome duplicado. `npm test`/`npm run
lint` en verde antes de mergear, como siempre.
