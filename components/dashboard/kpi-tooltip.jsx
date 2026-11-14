import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { EMPTY_METRIC, formatMetric, hasMetric } from '../../utils/dashboard-format.js';
import { isWeb } from '../../utils/platform.js';

// Cuánto se espera antes de cerrar un tooltip abierto por hover. Sin demora, el
// mouse no puede cruzar el pequeño espacio entre la tarjeta y el bubble (donde
// vive el link "Más información") sin que el bubble se cierre.
const HOVER_CLOSE_DELAY_MS = 250;

// Mismo verde que los íconos de `KpiTile`, para que el "i" se lea como parte de
// la tarjeta y no como un control ajeno.
const INFO_ICON_COLOR = '#166534';

// Cómo cerrarse, una por tooltip abierto. El registro vive en el módulo y no en
// un contexto porque el tooltip se usa en pantallas que no comparten árbol
// (dashboard, Home del corredor, Home del entrenador) y porque abrir un "i"
// tiene que cerrar el bubble de otro, sin importar en qué tarjeta esté.
const openTooltipClosers = new Set();

// Cierra todos los tooltips abiertos menos el que se está por abrir. Se copia
// el set antes de recorrerlo: cada `close()` dispara un efecto que lo modifica.
function closeOtherTooltips(except) {
  for (const close of Array.from(openTooltipClosers)) {
    if (close !== except) close();
  }
}

// Tooltip de KPI: qué mide el número (definición), la fórmula con la que se
// calculó, la tolerancia EFECTIVA que se aplicó (`tolerance_applied` de la
// respuesta) y cuántas series entraron.
//
// `definition` es la explicación en lenguaje llano ("qué mide"); `formula` es
// el detalle del cálculo del backend ("cómo se calcula"). Separarlos importa:
// una fórmula sola, sin decir qué representa el número, es justo lo que hacía
// los tooltips difíciles de leer. Si no hay `definition` pero sí `hint`, el
// hint se muestra como definición (es el caso de "Velocidad esperada", que no
// tiene fórmula porque es un valor congelado del plan).
//
// Se abre por click/tap en el botón "i" (ver `trigger`) y por foco de teclado
// (web). Un tooltip que solo abre con el mouse es invisible para quien navega
// con Tab, así que el foco se mantiene. Con `trigger="card"` —el bubble
// informativo del Home, que no es una tarjeta de KPI— el disparador es toda la
// tarjeta y además abre con hover.
//
// NO reusa `components/shared/icon-tooltip.jsx`: ese es web-only por decisión
// explícita (no hace nada en mobile) y no cubre teclado ni tap — que son
// justamente los dos caminos que la spec exige acá.
//
// El `accessibilityHint` del trigger lleva el valor y la unidad: en móvil el
// tooltip no se abre solo y hace falta que el lector de pantalla lo anuncie sin
// que el usuario tenga que descubrir que existe.
//
// Reutilizable fuera del dashboard (Home del corredor): `valueLabel` permite
// pasar el valor YA formateado (el Home formatea fechas y relojes, no solo
// números), `meta` agrega líneas de contexto propias y `showTolerance`/
// `showSeries` apagan las del dashboard cuando no aplican. Los defaults
// mantienen intactos a los consumidores actuales.
//
// `trigger` decide qué abre el tooltip:
//   - 'icon' (default): el disparador es un "i" en la esquina superior derecha
//     de la tarjeta. La tarjeta en sí NO es clickeable ni abre por hover, que
//     era justo lo molesto en las grillas de KPIs. `KpiTile` tiene que reservar
//     el espacio (`showInfo`).
//   - 'card': el disparador es todo el contenido, como el aviso del Home.
//
// `bubbleContent` reemplaza el cuerpo del tooltip cuando el contenido no es una
// fórmula (ej. el aviso del Home con un link) y `bubbleClassName` ajusta su
// ancho. `openOnHover=false` convierte el tooltip en un popover de click/tap:
// con un link adentro, abrir solo por hover haría que el bubble se cierre al
// mover el mouse hacia el link. En web el foco se sigue dentro del tooltip
// (trigger + bubble) para que Tab llegue al link sin cerrarlo.
//
// `onHelp` agrega el link "Más información" al pie del bubble y abre la ventana
// de documentación (`MetricHelpSheet`) que arma cada pantalla. Para que el link
// sea alcanzable con el mouse se conserva el hover (en trigger 'card'), pero el
// cierre se demora 250 ms: el bubble está separado de la tarjeta por unos
// píxeles y sin la demora se cerraría justo en el hueco. Entrar al bubble
// cancela el cierre.
//
// Cierre (2026-11-13): en web, un clic en cualquier lugar de la pantalla cierra
// el bubble; Escape también. En nativo, el segundo toque del "i". Además, abrir
// un tooltip cierra el que estuviera abierto (`openTooltipClosers`), así nunca
// quedan dos bubbles visibles a la vez.
export function KpiTooltip({
  id,
  hint,
  definition,
  formula,
  tolerance,
  seriesCount,
  unit,
  value,
  valueLabel,
  meta = [],
  showTolerance = true,
  showSeries = true,
  bubbleContent,
  bubbleClassName = '',
  openOnHover = true,
  hitSlop,
  children,
  onOpenChange,
  onHelp,
  helpLabel = 'Más información',
  trigger = 'icon',
  triggerLabel = 'Ver explicación',
}) {
  const rootRef = useRef(null);
  const closeTimer = useRef(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [tapped, setTapped] = useState(false);
  // El hover es un camino del trigger-tarjeta (el bubble informativo del Home).
  // Con el botón "i" el tooltip se abre solo por click/tap o foco de teclado:
  // pasar el mouse por la tarjeta ya no muestra nada.
  const hoverEnabled = openOnHover && trigger === 'card';
  const open = (hoverEnabled && hovered) || focused || tapped;

  // El cierre del hover se demora para poder cruzar el hueco entre la tarjeta y
  // el bubble. `useRef` y no `useState`: el timer no se pinta.
  const cancelHoverClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);
  const scheduleHoverClose = useCallback(() => {
    cancelHoverClose();
    closeTimer.current = setTimeout(() => setHovered(false), HOVER_CLOSE_DELAY_MS);
  }, [cancelHoverClose]);
  useEffect(() => cancelHoverClose, [cancelHoverClose]);

  // Cierre total: apaga los tres caminos de apertura y cancela el timer del
  // hover. Un solo `close` sirve para el clic afuera, Escape y el registro de
  // "un tooltip a la vez".
  const closeTooltip = useCallback(() => {
    cancelHoverClose();
    setHovered(false);
    setFocused(false);
    setTapped(false);
  }, [cancelHoverClose]);

  // En web, un clic en CUALQUIER lugar cierra el bubble: se escucha
  // `pointerdown` en el documento en fase de captura, así corre antes de que el
  // clic active otra cosa (por ejemplo, otro "i"). Los clics dentro del propio
  // tooltip —el "i" y el link "Más información"— se ignoran: esos sí tienen que
  // funcionar. Escape hace lo mismo con el teclado.
  //
  // En nativo no hay documento: el bubble se cierra tocando el "i" de nuevo.
  useEffect(() => {
    if (!isWeb || !open) return undefined;
    if (typeof document === 'undefined') return undefined;

    const handlePointerDown = (event) => {
      const target = event?.target;
      if (target && rootRef.current?.contains?.(target)) return;
      closeTooltip();
    };
    const handleKeyDown = (event) => {
      if (event?.key === 'Escape') closeTooltip();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, closeTooltip]);

  // Un solo tooltip abierto a la vez. Al abrirse uno, cierra el anterior (en
  // cualquier pantalla) y se anota para que el siguiente pueda cerrarlo.
  useEffect(() => {
    if (!open) return undefined;
    openTooltipClosers.add(closeTooltip);
    closeOtherTooltips(closeTooltip);
    return () => {
      openTooltipClosers.delete(closeTooltip);
    };
  }, [open, closeTooltip]);

  // El padre necesita saber si hay ALGUN tooltip abierto para subir la fila de
  // KPIs por encima de la card hermana de abajo. Sin esto el tooltip se dibuja
  // debajo de "Cumplimiento del objetivo".
  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  // `hovered` se pasa al hijo para que la card se ponga verde: el tooltip
  // abriéndose ya es la señal, pero el color marca cuál de las seis tarjetas
  // está explicando el bubble (antes el hover hacía ese trabajo solo). Los
  // hijos que no son función siguen recibiendo el nodo tal cual.
  const child = typeof children === 'function' ? children(hovered || open) : children;

  // Abrir la guía cierra el bubble: la ventana ocupa la pantalla y dejar el
  // tooltip abierto detrás no aporta nada (en nativo, además, evita dos modales
  // apilados).
  const handleHelp = () => {
    closeTooltip();
    onHelp?.();
  };

  const valueLabelResolved = valueLabel ?? (hasMetric(value) ? formatMetric(value, unit) : EMPTY_METRIC);
  // Si la pieza no tiene definición propia pero sí un hint, el hint ES la
  // definición. No se muestra cuando hay bubbleContent: ese contenido ya
  // reemplaza el cuerpo (ej. el aviso del Home con su link).
  const resolvedDefinition = definition ?? (formula || bubbleContent ? null : hint);

  return (
    <View
      className="relative"
      nativeID={`${id}-root`}
      onBlur={isWeb ? (event) => {
        const next = event?.nativeEvent?.relatedTarget;
        if (next && rootRef.current?.contains?.(next)) return;
        setFocused(false);
      } : undefined}
      onFocus={isWeb ? () => setFocused(true) : undefined}
      ref={rootRef}
      style={{ zIndex: open ? 1 : 0 }}
      testID={`${id}-root`}
    >
      {trigger === 'icon' ? (
        <>
          {/* La tarjeta ya NO es el disparador: se toca el "i" y nada más.
              Así el tooltip no aparece al pasar por encima de la tarjeta ni al
              tocarla sin querer. El botón es transparente y va encima de la
              esquina superior derecha, que es donde `KpiTile` reserva el
              espacio (`showInfo`). */}
          {child}
          <Pressable
            accessibilityHint={hint ?? definition ?? valueLabelResolved}
            accessibilityLabel={triggerLabel}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            aria-expanded={open}
            className="absolute right-1 top-1 z-10 h-8 w-8 items-center justify-center rounded-full active:bg-black/5 dark:active:bg-white/10"
            hitSlop={hitSlop ?? 6}
            nativeID={`${id}-trigger`}
            onBlur={isWeb ? undefined : () => setFocused(false)}
            onFocus={isWeb ? undefined : () => setFocused(true)}
            onPress={() => setTapped((current) => !current)}
            testID={`${id}-trigger`}
          >
            <MaterialCommunityIcons color={INFO_ICON_COLOR} name="information-outline" size={14} />
          </Pressable>
        </>
      ) : (
        <Pressable
          accessibilityHint={hint ?? definition ?? valueLabelResolved}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          aria-expanded={open}
          hitSlop={hitSlop}
          nativeID={`${id}-trigger`}
          onBlur={isWeb ? undefined : () => setFocused(false)}
          onFocus={isWeb ? undefined : () => setFocused(true)}
          onHoverIn={isWeb && hoverEnabled ? () => { cancelHoverClose(); setHovered(true); } : undefined}
          onHoverOut={isWeb && hoverEnabled ? scheduleHoverClose : undefined}
          onPress={() => setTapped((current) => !current)}
          testID={`${id}-trigger`}
        >
          {child}
        </Pressable>
      )}
      {open ? (
        <View
          // Un solo tema para el bubble, sin `dark:`. Gris oscuro + borde azul
          // + texto blanco funciona igual sobre las tarjetas KPI, que son
          // ambar en los dos modos: un bubble claro se perdia sobre amber-50 en
          // modo claro, y las variantes `dark:` lo hacian translucido sobre el
          // fondo oscuro. Sin ramas de tema no hay nada que sincronizar.
          //
          // El fondo va TAMBIEN inline y opaco: `bg-slate-800` solo dejo pasar
          // el fondo en oscuro en su momento, y este color no depende del tema,
          // asi que fijarlo en `style` no tiene contraindicaciones.
          className={`absolute left-0 right-0 top-full mt-1.5 rounded-lg border-2 border-green-500 bg-green-800 p-3 shadow-2xl ${bubbleClassName}`}
          // `zIndex` aca solo ordena el bubble dentro de su celda. En web NO
          // alcanza para salir de ella: react-native-web le pone `position:
          // relative; z-index: 0` a TODO `View`, asi que cada una es su propio
          // stacking context y un z-index maximo queda encerrado. Quien tiene
          // que subir es la celda (y su fila) — ver `openCell`/`openRow` en las
          // paletas.
          style={{ backgroundColor: "#166534", zIndex: 2147483647 }}
          nativeID={`${id}-bubble`}
          onPointerEnter={isWeb && hoverEnabled ? cancelHoverClose : undefined}
          onPointerLeave={isWeb && hoverEnabled ? scheduleHoverClose : undefined}
          testID={`${id}-bubble`}
        >
          {resolvedDefinition ? (
            <View nativeID={`${id}-bubble-definition-block`} testID={`${id}-bubble-definition-block`}>
              <Text
                className="text-[10px] font-semibold uppercase tracking-wide text-green-200"
                nativeID={`${id}-bubble-definition-label`}
                testID={`${id}-bubble-definition-label`}
              >
                Qué mide
              </Text>
              <Text className="mt-0.5 text-[11px] leading-4 text-white" nativeID={`${id}-bubble-definition`} testID={`${id}-bubble-definition`}>
                {resolvedDefinition}
              </Text>
            </View>
          ) : null}
          {formula ? (
            <View className={resolvedDefinition ? 'mt-2' : ''} nativeID={`${id}-bubble-formula-block`} testID={`${id}-bubble-formula-block`}>
              <Text
                className="text-[10px] font-semibold uppercase tracking-wide text-green-200"
                nativeID={`${id}-bubble-formula-label`}
                testID={`${id}-bubble-formula-label`}
              >
                Cómo se calcula
              </Text>
              <Text className="mt-0.5 text-[11px] leading-4 text-slate-100" nativeID={`${id}-bubble-formula`} testID={`${id}-bubble-formula`}>
                {formula}
              </Text>
            </View>
          ) : null}
          {showTolerance ? (
            <Text className="mt-1 text-[11px] leading-4 text-slate-100" nativeID={`${id}-bubble-tolerance`} testID={`${id}-bubble-tolerance`}>
              {`Tolerancia aplicada: ${toleranceLabel(tolerance)}`}
            </Text>
          ) : null}
          {showSeries ? (
            <Text className="text-[11px] leading-4 text-slate-100" nativeID={`${id}-bubble-series`} testID={`${id}-bubble-series`}>
              {seriesCount === null || seriesCount === undefined
                ? 'Series usadas: sin dato'
                : `Series usadas: ${seriesCount}`}
            </Text>
          ) : null}
          {meta.length ? (
            <View className="mt-1" nativeID={`${id}-bubble-meta`} testID={`${id}-bubble-meta`}>
              {meta.map((line, index) => (
                <Text
                  className="text-[11px] leading-4 text-slate-100"
                  key={`${line}-${index}`}
                  nativeID={`${id}-bubble-meta-${index}`}
                  testID={`${id}-bubble-meta-${index}`}
                >
                  {line}
                </Text>
              ))}
            </View>
          ) : null}
          {bubbleContent}
          {onHelp ? (
            <Pressable
              accessibilityHint="Abre la explicación completa con ejemplos y tablas"
              accessibilityRole="link"
              className="mt-2 self-start"
              nativeID={`${id}-bubble-help`}
              onPress={handleHelp}
              testID={`${id}-bubble-help`}
            >
              <Text
                className="text-[11px] font-semibold leading-4 text-green-200 underline"
                nativeID={`${id}-bubble-help-label`}
                testID={`${id}-bubble-help-label`}
              >
                {helpLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function toleranceLabel(tolerance) {
  const value = Number(tolerance);
  return Number.isFinite(value) ? `${Math.round(value * 1000) / 10} %` : EMPTY_METRIC;
}
