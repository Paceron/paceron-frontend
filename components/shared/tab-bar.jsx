import { useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';

// Barra de pestañas horizontal reusada por pantallas con secciones que
// merecen navegación propia en vez de ir todas apiladas — hoy
// TeamDetailScreen, TrainingPlansScreen y PaymentsScreen (las tres plataformas,
// ver docs/superpowers/specs/2026-09-03-exercises-sessions-catalog-design.md).
// `scope` prefija los nativeID/testID para que no colisionen entre
// pantallas que la usen a la vez.
//
// Accesibilidad: implementa el patrón ARIA de tablist completo. Dos detalles
// del repo que condicionan cómo se escribe:
//
//  - `accessibilityRole` solo acepta roles que existen en
//    ReactAccessibilityDelegate.java — los valida
//    __tests__/accessibility-roles.test.js. `tab` y `tablist` están;
//    `tabpanel` NO existe, así que el panel de la pantalla lo tiene que poner
//    con el prop crudo `role` (no se hace acá: esta barra no conoce el panel).
//  - react-native-web@0.21 no implementa `accessibilityState`, así que el
//    estado seleccionado va por los dos caminos: `accessibilityState` (nativo)
//    y `aria-selected` plano (web). Mismo criterio que SearchablePickerField.
//
// Navegación por teclado: solo web, donde tiene sentido (flechas del teclado
// físico). En nativo el acceso es por touch y las flechas no aplican.
export function TabBar({ active, onChange, tabs, scope = 'tab-bar', badges = {} }) {
  const colors = useThemeColors();
  const refs = useRef({});

  const select = (index) => {
    const target = tabs[index];
    if (!target) return;
    onChange(target.id);
    // El foco DOM se mueve solo en web: en nativo las flechas no aplican, y
    // `findNodeHandle` además tira en react-native-web ("not supported on
    // web"), así que ni siquiera tiene sentido intentarlo — ver el early
    // return equivalente en SearchablePickerField.
    if (isWeb) refs.current[target.id]?.focus?.();
  };

  const handleKeyDown = (event, index) => {
    const positions = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: tabs.length - 1,
    };
    const next = positions[event.key];
    if (next === undefined) return;
    // Wrap-around: en una tablist las flechas dan vueltas, no se detienen en los
    // extremos — es lo que espera quien ya usa tabs en cualquier lado.
    event.preventDefault?.();
    select((next + tabs.length) % tabs.length);
  };

  return (
    // Antes era un ScrollView horizontal (ancho natural por tab + scroll si
    // no entraban) -- con 6 tabs (ej. team-detail-screen.jsx del lado
    // entrenador) eso dejaba tabs cortados sin pista visual de que había
    // más para el costado (pedido real, 2026-10-15). Ahora cada tab es
    // `flex-1` (ancho repartido en partes iguales, sin scroll) y su
    // contenido interno es `flex-row flex-wrap` -- si ícono+texto no entran
    // en una sola línea al ancho que le tocó, el texto baja solo a una
    // segunda línea (mismo mecanismo de flexbox en web y nativo, sin medir
    // nada a mano); `numberOfLines={1}` en el texto corta con "…" como
    // último recurso si ni así entra.
    <View accessibilityRole="tablist" className="mb-5 flex-row flex-wrap gap-2" nativeID={scope} testID={scope}>
      {tabs.map((tab, index) => {
        const isActive = tab.id === active;
        return (
          <Pressable
            accessibilityLabel={tab.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            aria-selected={isActive}
            className={`flex-1 flex-row flex-wrap items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 ${
              isActive
                ? 'bg-primary-tint-subtle dark:bg-primary/10'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            focusable={isWeb}
            key={tab.id}
            nativeID={`${scope}-${tab.id}`}
            // Pressable de react-native-web implementa onKeyDown (lo ve el
            // keyDownHandler de RNW); en nativo es no-op.
            onKeyDown={isWeb ? (event) => handleKeyDown(event, index) : undefined}
            onPress={() => onChange(tab.id)}
            ref={(node) => { refs.current[tab.id] = node; }}
            role="tab"
            style={{ minWidth: 72 }}
            // Solo la tab activa entra en el orden de tabulación: las flechas
            // hacen el resto del recorrido. Es el patrón de roving tabindex.
            tabIndex={isActive ? 0 : -1}
            testID={`${scope}-${tab.id}`}
          >
            <View className="relative" nativeID={`${scope}-${tab.id}-icon-wrapper`} testID={`${scope}-${tab.id}-icon-wrapper`}>
              <MaterialCommunityIcons name={tab.icon} size={16} color={isActive ? colors.primary : colors.onSurfaceVariant} />
              {badges[tab.id] && (
                <View className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" nativeID={`${scope}-${tab.id}-badge`} testID={`${scope}-${tab.id}-badge`} />
              )}
            </View>
            <Text
              className={`text-center text-sm ${isActive ? 'font-semibold text-primary' : 'font-medium text-slate-700 dark:text-slate-200'}`}
              nativeID={`${scope}-${tab.id}-label`}
              numberOfLines={1}
              testID={`${scope}-${tab.id}-label`}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
