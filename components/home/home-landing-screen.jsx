import { Pressable, ScrollView, Text, View } from 'react-native';
import { PaceronBrand } from '../brand/paceron-brand.jsx';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

const features = [
  {
    icon: 'account-group',
    title: 'Gestión de equipos',
    description: 'Creá y administrá tus equipos de running. Organizá grupos de entrenamiento, definí requisitos de pertenencia e invitá corredores.',
  },
  {
    icon: 'calendar-clock',
    title: 'Planificación de entrenamientos',
    description: 'Diseñá planes y sesiones con parámetros detallados: tipo, duración, intensidad, descansos y objetivos. Exportá a PDF.',
  },
  {
    icon: 'map-marker-path',
    title: 'Seguimiento de actividades',
    description: 'Registrá actividades con los sensores del celular o manualmente. Visualizá rutas en el mapa y compará lo planificado vs. lo realizado.',
  },
  {
    icon: 'chart-line',
    title: 'Monitoreo y métricas',
    description: 'Seguí la evolución de cada corredor con métricas de progreso, identificá tendencias e interpretá datos con resúmenes automáticos.',
  },
  {
    icon: 'qrcode-scan',
    title: 'Control de asistencia',
    description: 'Generá códigos QR para sesiones presenciales. Los corredores escanean para registrar asistencia o el entrenador la marca manualmente.',
  },
  {
    icon: 'trophy',
    title: 'Gamificación',
    description: 'Sistema de logros, rachas, desafíos entre corredores y leaderboards para potenciar la competitividad y motivación del equipo.',
  },
];

function FeatureCard({ icon, title, description, colors }) {
  return (
    <View className="flex-1 min-w-[280px] rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-700 dark:bg-[#1d2125]">
      <View className="mb-4 h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
        <MaterialCommunityIcons color={colors.primary} name={icon} size={24} />
      </View>
      <Text className="mb-2 text-lg font-bold text-slate-900 dark:text-white">{title}</Text>
      <Text className="text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</Text>
    </View>
  );
}

export function HomeLandingScreen() {
  const router = useRouter();
  const colors = useThemeColors();

  return (
    <ScrollView className="flex-1 bg-slate-50 dark:bg-[#0d1013]">
      <View className="mx-auto w-full max-w-5xl px-8 py-20">
        <View className="mb-16 items-center">
          <View className="mb-6 flex-row items-center gap-2 self-center rounded-full bg-primary/20 px-4 py-2">
            <MaterialCommunityIcons color={colors.primary} name="brain" size={16} />
            <Text className="text-xs font-semibold uppercase tracking-wider text-primary">
              Potenciado por Inteligencia Artificial
            </Text>
          </View>

          <Text className="mb-6 text-center text-5xl font-bold leading-tight text-slate-900 dark:text-white">
            Entrená, seguí y gestioná{'\n'}tu equipo de running
          </Text>

          <Text className="mb-10 max-w-2xl text-center text-lg leading-7 text-slate-500 dark:text-slate-400">
            La plataforma integral diseñada para optimizar el rendimiento, facilitar la administración de equipos y
            conectar a entrenadores con sus corredores a través de tecnología de punta.
          </Text>

          <View className="flex-row gap-4">
            <Pressable
              className="h-12 flex-row items-center gap-2 rounded-full bg-primary px-8 shadow-md active:opacity-80"
              onPress={() => router.push('/register')}
            >
              <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]">Empezar ahora</Text>
              <MaterialCommunityIcons color={colors.onPrimary} name="arrow-right" size={18} />
            </Pressable>
            <Pressable
              className="h-12 flex-row items-center gap-2 rounded-full border border-slate-300 px-8 hover:bg-slate-100 active:opacity-80 dark:border-slate-700 dark:hover:bg-slate-800"
              onPress={() => router.push('/login')}
            >
              <Text className="text-sm font-semibold uppercase tracking-wide text-slate-900 dark:text-white">Ingresar</Text>
              <MaterialCommunityIcons color={colors.onSurface} name="login" size={18} />
            </Pressable>
          </View>
        </View>

        <View className="mb-16 flex-row flex-wrap gap-6">
          {features.map((feature) => (
            <FeatureCard key={feature.icon} {...feature} colors={colors} />
          ))}
        </View>

        <View className="mb-16 overflow-hidden rounded-2xl border border-primary/20 bg-white p-12 shadow-lg dark:bg-[#1d2125]">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-12">
              <View className="mb-6 flex-row items-center gap-2 self-start rounded-full bg-primary/20 px-4 py-2">
                <MaterialCommunityIcons color={colors.primary} name="creation" size={16} />
                <Text className="text-xs font-semibold uppercase tracking-wider text-primary">Asistente IA Integrado</Text>
              </View>
              <Text className="mb-4 text-4xl font-bold leading-tight text-slate-900 dark:text-white">
                Tu propio analista{'\n'}de running
              </Text>
              <Text className="mb-4 max-w-lg text-base leading-7 text-slate-500 dark:text-slate-400">
                Preguntá en lenguaje natural sobre métricas, tendencias o pedí sugerencias de rutinas basadas en el
                historial de tus corredores. El asistente genera planes de entrenamiento, interpreta el rendimiento
                y ofrece feedback automatizado para cada corredor.
              </Text>
            </View>
            <View className="items-center justify-center opacity-10">
              <MaterialCommunityIcons color={colors.primary} name="brain" size={200} />
            </View>
          </View>
        </View>

        <View className="mb-16 flex-row gap-6">
          <View className="flex-1 rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-700 dark:bg-[#1d2125]">
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
              <MaterialCommunityIcons color={colors.primary} name="run-fast" size={24} />
            </View>
            <Text className="mb-2 text-lg font-bold text-slate-900 dark:text-white">Para corredores</Text>
            <Text className="text-sm leading-6 text-slate-500 dark:text-slate-400">
              Registrá tus carreras y entrenamientos, accedé a estadísticas de rendimiento, competí con otros
              corredores en desafíos y leaderboards, y recibí estímulos personalizados durante tus sesiones.
            </Text>
          </View>
          <View className="flex-1 rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-700 dark:bg-[#1d2125]">
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
              <MaterialCommunityIcons color={colors.primary} name="whistle" size={24} />
            </View>
            <Text className="mb-2 text-lg font-bold text-slate-900 dark:text-white">Para entrenadores</Text>
            <Text className="text-sm leading-6 text-slate-500 dark:text-slate-400">
              Gestioná tu negocio de running: creá equipos, planificá entrenamientos asistido por IA, controlá
              asistencia con QR, monitoreá el progreso de tus corredores y administrá suscripciones y cobros.
            </Text>
          </View>
        </View>
      </View>

      <View className="border-t border-slate-200 bg-white py-10 dark:border-slate-800 dark:bg-[#111518]">
        <View className="mx-auto w-full max-w-5xl flex-row items-center justify-between px-8">
          <PaceronBrand size={16} />
          <Text className="text-sm text-slate-400">© 2026 Paceron</Text>
        </View>
      </View>
    </ScrollView>
  );
}
