import { ActivityIndicator, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../../theme/colors.js';
import { useThemeMode } from '../../providers/theme-provider.jsx';
import { toAttendanceRate } from '../../utils/attendance-payload.js';
import { toRingGeometry } from '../../utils/attendance-ring.js';
import { StatTile } from '../shared/stat-tile.jsx';

// 56 con 6 de trazo deja un hueco interior de 44 px: entra el número con un
// decimal y el "%" chico adentro sin que el texto toque el trazo. El tamaño
// importa también por la altura — con 72, la tarjeta del % quedaba casi 30 px
// más alta que los dos StatTile y las tres bases se veían desparejas.
const RING_SIZE = 56;
const RING_STROKE = 6;

// Mismo shell que el StatTile compartido (components/shared/stat-tile.jsx) para
// que las tres tarjetas de la fila se lean como una sola cosa. Va sin `bg-*`:
// acá el fondo lo pone el LinearGradient de acento. La regla del CLAUDE.md de
// no duplicar pares claro/oscuro aplica dentro de este archivo (dos usos, el
// placeholder de carga y la tarjeta del anillo) y no entre archivos — el
// StatTile compartido no se toca.
// SIN `justify-center`, a propósito: `flex-row` estira las tres tarjetas a la
// altura de la más alta, y el StatTile compartido tampoco centra su contenido
// (lo tiene arriba). Si esta lo centrara y los otros dos no, el ícono de los
// StatTile dejaría de alinearse con el anillo. El placeholder de carga sí lo
// necesita, y lo pone explícito.
const CARD_SHELL = 'flex-1 items-center rounded-2xl border border-slate-200 px-1.5 py-4 dark:border-slate-700';

// El acento del gradiente se queda solo en la tarjeta del %: es la que D6
// quiere como elemento protagonista de la fila, y las otras dos son
// StatTile, que no aceptan children ni fondo propio.
const RING_GRADIENT = {
  light: ['#eef3dc', '#ffffff'], // primary-tint-subtle → blanco de las cards
  dark: ['rgba(140, 198, 62, 0.18)', '#111518'],
};

// "Asistencias" y no "Asistencias confirmadas": la versión larga son 23
// caracteres y en un tile de un tercio de ancho envuelve a 2-3 líneas, lo que
// dejaba la tarjeta del % ~25px más alta que los dos StatTile y las etiquetas
// desalineadas entre las tres. Se acortó por altura, no por estilo.
const RATE_LABEL = 'Asistencias';

// Un decimal, como el spec ("50.0 % de asistencias confirmadas"), en formato
// local. Mismo criterio que utils/currency.js: la instancia de Intl se crea una
// sola vez a nivel de módulo, no en cada render.
const RATE_FORMATTER = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

// Number(null) y Number('') dan 0, que es finito: sin este descarte, "todavía
// no sé el valor" se mostraría como un cero. Es la regla "sin dato ≠ 0" del
// CLAUDE.md, y acá el caso real es que no vino `summary` (la pantalla lo
// muestra recién cuando la consulta resolvió; con error no llega a montar esto).
const toCount = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const showCount = (count) => (count === null ? '—' : String(count));

// Las tres métricas de la sesión elegida: asistentes, sin confirmar y el
// porcentaje de asistencias confirmadas (spec, requirement "resumen de
// asistencia").
//
// `summary` es el que devuelve `useSessionAttendance` (null hasta que la
// consulta resuelve). `isLoading` NO muestra ceros ni un anillo vacío: la
// pantalla tiene que poder distinguished "está calculando" de "no asistió nadie"
// (spec, escenario "Estado de carga").
export function AttendanceMetricCards({ summary, isLoading, idPrefix }) {
  const colors = useThemeColors();
  const { colorScheme } = useThemeMode();
  const gradient = RING_GRADIENT[colorScheme] ?? RING_GRADIENT.light;

  if (isLoading) {
    return (
      <View className="flex-row gap-2" nativeID={`${idPrefix}-loading`} testID={`${idPrefix}-loading`}>
        <View className={`${CARD_SHELL} min-h-[72px] justify-center`} nativeID={`${idPrefix}-loading-card`} testID={`${idPrefix}-loading-card`}>
          <ActivityIndicator color={colors.primary} size="small" />
        </View>
      </View>
    );
  }

  const attended = toCount(summary?.attended);
  const notConfirmed = toCount(summary?.not_confirmed);
  const rate = toAttendanceRate(summary);
  const ring = toRingGeometry({ pct: rate, size: RING_SIZE, strokeWidth: RING_STROKE });

  // El backend puede mandar MÁS de 100 (`attended` no viene filtrado por
  // roster, así que alguien que ya no está en el grupo hace pasar el cociente).
  // `toAttendanceRate` no clampea a propósito y el anillo sí: una circunferencia
  // no tiene cómo pintar el 125 % y el SVG no lo dibujaría. Pero el NÚMERO que
  // ve el entrenador es el real, con la anomalía anotada abajo — mostrarle
  // "100 %" cuando hay 5 asistencias contra 4 corredores del roster lo haría
  // creer que todo el grupo asistió, y el problema real (gente que se fue y
  // dejó la asistencia cargada) se volvería invisible.
  const overRoster = rate !== null && rate > 100;

  return (
    <View className="flex-row gap-2" nativeID={`${idPrefix}-row`} testID={`${idPrefix}-row`}>
      <StatTile
        colors={colors}
        icon="account-check-outline"
        idPrefix={`${idPrefix}-attended`}
        label="Asistentes"
        value={showCount(attended)}
      />
      <StatTile
        colors={colors}
        icon="account-clock-outline"
        idPrefix={`${idPrefix}-not-confirmed`}
        label="Sin confirmar"
        value={showCount(notConfirmed)}
      />

      <View className={CARD_SHELL} nativeID={`${idPrefix}-rate-card`} testID={`${idPrefix}-rate-card`}>
        <LinearGradient
          colors={gradient}
          end={{ x: 1, y: 1 }}
          nativeID={`${idPrefix}-rate-accent`}
          start={{ x: 0, y: 0 }}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 16 }}
          testID={`${idPrefix}-rate-accent`}
        />

        {/* La caja reserva el tamaño del anillo. Sin esto el `Svg` va en
            `position: 'absolute'`, así que NO aporta altura: la caja colapsaba
            a la altura del número (~20px) y el anillo de 56px se desbordaba 18px
            arriba y abajo — la etiqueta arrancaba 6px después del fondo de la
            caja, o sea 12px adentro de la mitad inferior del círculo. Con el
            alto explícito, el número se centra en el hueco y la etiqueta queda
            6px debajo del anillo. */}
        <View
          className="items-center justify-center"
          nativeID={`${idPrefix}-rate-figure`}
          style={{ height: RING_SIZE, width: RING_SIZE }}
          testID={`${idPrefix}-rate-figure`}
        >
          <Svg
            height={RING_SIZE}
            nativeID={`${idPrefix}-rate-ring`}
            style={{ position: 'absolute' }}
            testID={`${idPrefix}-rate-ring`}
            width={RING_SIZE}
          >
            {/* El <Circle> arranca en las 3 en punto (eje x positivo) y gira en
                sentido horario; el grupo lo gira −90° para que el arco empiece
                a las 12. */}
            <G originX={ring.cx} originY={ring.cy} rotation={-90}>
              <Circle
                cx={ring.cx}
                cy={ring.cy}
                fill="none"
                r={ring.radius}
                stroke={colors.outlineVariant}
                strokeWidth={RING_STROKE}
              />
              {/* El arco de progreso no se dibuja cuando no hay dato, cuando
                  el radio quedó en 0 por un tamaño degenerado (un `dasharray` de
                  ceros lo interpreta SVG como trazo continuo y se vería un
                  anillo lleno) ni al 0 %: con `strokeLinecap="round"` y el
                  patrón corrida un arco entero, el casquete del guion que
                  termina justo en el arranque del path asoma medio punto en las
                  12. El 0 % se muestra con la pista sola, que es lo que tiene
                  que verse cuando `roster_size === 0` (spec). */}
              {rate !== null && ring.radius > 0 && ring.clampPct > 0 ? (
                <Circle
                  cx={ring.cx}
                  cy={ring.cy}
                  fill="none"
                  r={ring.radius}
                  stroke={colors.primary}
                  strokeDasharray={ring.strokeDasharray}
                  strokeDashoffset={ring.strokeDashoffset}
                  strokeLinecap="round"
                  strokeWidth={RING_STROKE}
                />
              ) : null}
            </G>
          </Svg>

          <Text
            className={`text-sm font-bold ${overRoster ? 'text-amber-700 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}
            nativeID={`${idPrefix}-rate-value`}
            numberOfLines={1}
            testID={`${idPrefix}-rate-value`}
          >
            {rate === null ? '—' : RATE_FORMATTER.format(rate)}
            {rate !== null ? (
              <Text
                className="text-[9px] font-semibold"
                nativeID={`${idPrefix}-rate-unit`}
                testID={`${idPrefix}-rate-unit`}
              >
                {' %'}
              </Text>
            ) : null}
          </Text>
        </View>

        <Text
          className="mt-1.5 text-center text-[11px] leading-4 text-slate-500 dark:text-slate-400"
          nativeID={`${idPrefix}-rate-label`}
          testID={`${idPrefix}-rate-label`}
        >
          {RATE_LABEL}
        </Text>

        {/* Los dos casos en los que el número de arriba no es un porcentaje de
           asistencias — se anotan, no se esconden. */}
        {rate === null ? (
          <Text
            className="mt-0.5 text-center text-[10px] leading-3 text-slate-400 dark:text-slate-500"
            nativeID={`${idPrefix}-rate-unknown`}
            testID={`${idPrefix}-rate-unknown`}
          >
            sin datos
          </Text>
        ) : null}
        {overRoster ? (
          <Text
            className="mt-0.5 text-center text-[10px] leading-3 text-amber-600 dark:text-amber-400"
            nativeID={`${idPrefix}-rate-over-roster`}
            testID={`${idPrefix}-rate-over-roster`}
          >
            Gente que ya no está en el grupo
          </Text>
        ) : null}
      </View>
    </View>
  );
}
