import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { hasInsufficientData, isLegacyNote } from '../../utils/dashboard-format.js';

// Bloque `data_quality` de la API.
//
// Los CINCO contadores de defecto van como advertencia, cada uno con ícono +
// texto + número: el tono ámbar solo no alcanza para que alguien sepa QUÉ está
// mal. `legacy_sessions` NO entra ahí — es el único contador que no es un
// defecto (son series válidas sin fila en `runner_session`, que igual se
// incluyen en los KPI), así que va como nota al pie informativa con la
// aclaración: sin ella el usuario lo lee como un error que no existe.
//
// Cuando `insufficient_data` es verdadero la pantalla oculta las tendencias
// (lo hace la paleta) y esta banner explica el motivo.
const DEFECTS = [
  {
    key: 'invalid_series',
    label: 'Series no calculables',
    hint: 'Les falta un dato obligatorio del tipo (por ejemplo, distancia en un ejercicio que la exige). Quedan fuera de los promedios.',
  },
  {
    key: 'degraded_time',
    label: 'Con tiempo degradado',
    hint: 'Se evaluaron con el tiempo total en vez del tiempo activo.',
  },
  {
    key: 'unknown_status',
    label: 'Con estado de cumplimiento desconocido',
    hint: 'La serie no dice si se completó o no, así que no se puede juzgar contra el objetivo.',
  },
  {
    key: 'open_sessions',
    label: 'Sesiones sin cerrar',
    hint: 'Hay sesiones del período que todavía no se cerraron: sus series no entran en los KPI.',
  },
];

export function QualityBanner({ id = 'dashboard-quality', quality }) {
  if (!quality) return null;
  const active = DEFECTS.filter((defect) => Number(quality[defect.key]) > 0);
  const insufficient = hasInsufficientData(quality);

  if (!active.length && !insufficient && !isLegacyNote(quality)) return null;

  return (
    // El `border-l-4` grueso es lo que separa el AVISO de las tarjetas de KPI:
    // después de teñirlas de ámbar, las dos superficies comparten `bg-amber-50`
    // y `border-amber-300`, y sin una marca distinta el aviso se lee como una
    // cifra más. El borde izquierdo dice "mirá esto" sin gritar, y las KPI no lo
    // tienen.
    <View className="mb-4 rounded-2xl border border-l-4 border-amber-300 border-l-amber-600 bg-amber-50 p-4 dark:border-amber-900/50 dark:border-l-amber-400 dark:bg-amber-950/20" nativeID={id} testID={id}>
      <View className="mb-2 flex-row items-center gap-2" nativeID={`${id}-header`} testID={`${id}-header`}>
        <MaterialCommunityIcons color="#f59e0b" name="alert-outline" size={16} />
        <Text className="flex-1 text-sm font-bold text-amber-800 dark:text-amber-300" nativeID={`${id}-title`} testID={`${id}-title`}>
          Calidad de los datos
        </Text>
      </View>

      {insufficient ? (
        <View className="mb-3" nativeID={`${id}-insufficient`} testID={`${id}-insufficient`}>
          <Text className="text-xs font-semibold text-amber-800 dark:text-amber-300" nativeID={`${id}-insufficient-text`} testID={`${id}-insufficient-text`}>
            No hay volumen suficiente para calcular una tendencia: las variaciones están ocultas.
          </Text>
        </View>
      ) : null}

      {active.length ? (
        <View nativeID={`${id}-defects`} testID={`${id}-defects`}>
          {active.map((defect) => (
            <View className="mb-2 flex-row items-start gap-2" key={defect.key} nativeID={`${id}-defect-${defect.key}`} testID={`${id}-defect-${defect.key}`}>
              <MaterialCommunityIcons color="#f59e0b" name="alert-circle-outline" size={15} style={{ marginTop: 1 }} />
              <View className="flex-1" nativeID={`${id}-defect-${defect.key}-body`} testID={`${id}-defect-${defect.key}-body`}>
                <Text className="text-xs font-semibold text-amber-900 dark:text-amber-200" nativeID={`${id}-defect-${defect.key}-label`} testID={`${id}-defect-${defect.key}-label`}>
                  {`${defect.label}: ${quality[defect.key]}`}
                </Text>
                <Text className="text-[11px] leading-4 text-amber-800/80 dark:text-amber-300/80" nativeID={`${id}-defect-${defect.key}-hint`} testID={`${id}-defect-${defect.key}-hint`}>
                  {defect.hint}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {isLegacyNote(quality) ? (
        <View className="mt-1 flex-row items-start gap-2" nativeID={`${id}-legacy`} testID={`${id}-legacy`}>
          <MaterialCommunityIcons color="#6b7280" name="information-outline" size={15} style={{ marginTop: 1 }} />
          <Text className="flex-1 text-[11px] leading-4 text-slate-600 dark:text-slate-400" nativeID={`${id}-legacy-text`} testID={`${id}-legacy-text`}>
            {`${quality.legacy_sessions} ${quality.legacy_sessions === 1 ? 'serie' : 'series'} sin registro en la sesión del corredor: se incluyen igual en los indicadores de arriba.`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
