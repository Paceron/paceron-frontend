import { cloneElement, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Text, View } from 'react-native';
import { isWeb } from '../../utils/platform.js';

// Tooltip solo-web para botones de solo-ícono -- confirmado decisión del
// usuario 2026-10-09: en mobile no hace nada especial (no hay hover
// táctil), el accessibilityLabel que ya llevan estos botones sigue siendo
// la única pista para lectores de pantalla ahí.
//
// No usa el `title` nativo del DOM porque react-native-web no lo
// reenvía -- confirmado leyendo `forwardedProps` (no está en
// `defaultProps` ni en ninguna otra lista de props permitidas), así que
// un `title="..."` en un `Pressable`/`View` de este repo simplemente se
// pierde en silencio. `onHoverIn`/`onHoverOut` sí son parte de la API
// real de `Pressable` (confirmado en su propia lista de props
// reenviadas) y no-opean en touch por sí solos, sin ninguna rama
// `isWeb` adentro del propio Pressable.
//
// `children` tiene que ser un único elemento Pressable (el botón de
// ícono ya existente en el call site) -- se le inyectan los handlers de
// hover sin que el caller tenga que reescribir su botón.
// `position` elige la vertical (bottom = abajo, top = arriba) y `align` la
// horizontal. El horizontal importa en los extremos de una fila: centrado, el
// pill de la izquierda saca media burbuja fuera de la pantalla. `start` la
// ancla a la izquierda del trigger (se abre hacia la derecha) y `end` a la
// derecha (se abre hacia la izquierda) — para una fila, "hacia adentro".
//
// `wrap` es para labels que son una FRASE y no un nombre de acción: el pill de
// una línea sola (`numberOfLines={1}`, el default de los labels de ícono) crece
// hacia los costados sin techo y con 80 caracteres se sale de la pantalla. Con
// `wrap` la burbuja se acota a `maxWidth: 260` y el texto baja en varias líneas.
export function IconTooltip({ label, children, idPrefix, position = 'bottom', align = 'center', wrapperClassName = '', wrap = false }) {
  const [hovered, setHovered] = useState(false);
  const [coords, setCoords] = useState(null);
  const wrapperRef = useRef(null);

  if (!isWeb) return children;

  // `position:absolute` ataba la burbuja al wrapper -- cualquier ancestro
  // con `overflow-hidden` (ej. web-shell-dropdown-menu-panel, por sus
  // bordes redondeados) la recortaba, y dentro de una card sin overflow
  // igual podía quedar tapada por un hermano posterior en el flujo (ej.
  // leaderboard-tab's `body` con `border-t`) -- bug real, 2026-10-15,
  // reportado en ambos lugares a la vez. `position:fixed` solo (medido con
  // measureInWindow, mismo patrón que AnimatedDropdown) no alcanzó: CUALQUIER
  // ancestro con `transform` (ej. la propia animación de apertura de
  // AnimatedDropdown) se vuelve el containing block de un fixed descendiente
  // -- lo ata a ESE ancestro en vez del viewport, mismo resultado roto que
  // con absolute. Confirmado en preview: la burbuja del tema aparecía a
  // cientos de px de su trigger real por este motivo exacto. Fix real:
  // `createPortal` a `document.body` -- ahí no hay transform/overflow de
  // ningún ancestro de por medio, nunca, sea cual sea el call site.
  const handleHoverIn = () => {
    wrapperRef.current?.measureInWindow?.((x, y, width, height) => {
      setCoords({ x, y, width, height });
    });
    setHovered(true);
  };

  const trigger = cloneElement(children, {
    onHoverIn: handleHoverIn,
    onHoverOut: () => setHovered(false),
  });

  const bubbleStyle = coords
    ? {
        position: 'fixed',
        ...(position === 'top'
          ? { bottom: window.innerHeight - coords.y + 6 }
          : { top: coords.y + coords.height + 6 }),
        ...(align === 'start'
          ? { left: coords.x }
          : align === 'end'
            ? { right: window.innerWidth - (coords.x + coords.width) }
            : { left: coords.x + coords.width / 2, transform: 'translateX(-50%)' }),
      }
    : null;

  // `wrapperClassName` opcional -- por default este wrapper no declara
  // `flexShrink`/ancho propio, así que en una fila flex que necesita que
  // sus hijos se encojan (ej. tab-bar.jsx con `shrink` en el trigger), el
  // wrapper de acá rompía la cadena (bug real, 2026-10-15): el hijo pedía
  // encogerse pero el wrapper, sin esa misma clase, no lo dejaba.
  return (
    <View className={`relative ${wrapperClassName}`} nativeID={idPrefix} ref={wrapperRef} testID={idPrefix}>
      {trigger}
      {hovered && coords && createPortal(
        <View
          // z-tooltip = 70 (tailwind.config.js, espejo de Z_INDEX.tooltip).
          // Montada directo en document.body: no hay stacking context de
          // ningún ancestro real de por medio (el único padre es body), así
          // que esto es sobre todo defensivo contra otro `fixed` de z propio.
          className="z-tooltip rounded-md bg-slate-800 px-2 py-1 shadow-lg dark:bg-slate-700"
          nativeID={`${idPrefix}-bubble`}
          pointerEvents="none"
          style={wrap ? { ...bubbleStyle, maxWidth: 260 } : bubbleStyle}
          testID={`${idPrefix}-bubble`}
        >
          <Text className="text-xs text-white" nativeID={`${idPrefix}-bubble-label`} numberOfLines={wrap ? undefined : 1} testID={`${idPrefix}-bubble-label`}>
            {label}
          </Text>
        </View>,
        document.body,
      )}
    </View>
  );
}
