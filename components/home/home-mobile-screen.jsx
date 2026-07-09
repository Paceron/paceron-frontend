import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

const features = [
  {
    icon: 'account-group',
    title: 'Gestión de equipos',
    description: 'Creá y administrá equipos, organizá grupos e invitá corredores.',
  },
  {
    icon: 'calendar-clock',
    title: 'Planificación',
    description: 'Diseñá planes con parámetros detallados y exportá a PDF.',
  },
  {
    icon: 'map-marker-path',
    title: 'Seguimiento',
    description: 'Registrá actividades con GPS, visualizá rutas y compará resultados.',
  },
  {
    icon: 'chart-line',
    title: 'Métricas',
    description: 'Seguí la evolución con métricas de progreso y tendencias.',
  },
  {
    icon: 'qrcode-scan',
    title: 'Asistencia QR',
    description: 'Escaneá QR para registrar asistencia a sesiones presenciales.',
  },
  {
    icon: 'trophy',
    title: 'Gamificación',
    description: 'Logros, rachas, desafíos y leaderboards para motivarte.',
  },
];

function FeatureItem({ icon, title, description, colors }) {
  return (
    <View className="flex-row gap-4 py-4">
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
        <MaterialCommunityIcons color={colors.primary} name={icon} size={20} />
      </View>
      <View className="flex-1">
        <Text className="mb-1 text-base font-bold text-slate-950 dark:text-white">{title}</Text>
        <Text className="text-sm leading-5 text-slate-600 dark:text-slate-300">{description}</Text>
      </View>
    </View>
  );
}

export function HomeMobileScreen() {
  const router = useRouter();
  const colors = useThemeColors();

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-[#111518]"
      contentContainerClassName="px-gutter pb-16"
    >
      <View className="items-center py-16">
        <View className="mb-6 flex-row items-center gap-2 rounded-full bg-primary/20 px-3 py-1.5">
          <MaterialCommunityIcons
            color={colors.primary}
            name="brain"
            size={16}
          />
          <Text className="text-xs font-semibold uppercase tracking-wide text-primary">
            Potenciado por Inteligencia Artificial
          </Text>
        </View>

        <Text className="mb-6 text-center text-[26px] font-bold leading-8 text-slate-950 dark:text-white">
          Entrená, seguí y gestioná tu equipo de running
        </Text>

        <Text className="mb-10 text-center text-base leading-6 text-slate-600 dark:text-slate-300">
          La plataforma integral diseñada para optimizar el rendimiento,
          facilitar la administración de equipos y conectar a entrenadores con
          sus corredores a través de tecnología de punta.
        </Text>

        <View className="w-full gap-4">
          <Pressable
            className="h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary shadow-md active:opacity-80"
            onPress={() => router.push('/register')}
          >
            <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]">
              Empezar ahora
            </Text>
            <MaterialCommunityIcons
              color={colors.onPrimary}
              name="arrow-right"
              size={18}
            />
          </Pressable>

          <Pressable
            className="h-12 flex-row items-center justify-center gap-2 rounded-full border border-slate-300 active:opacity-80 dark:border-slate-700"
            onPress={() => router.push('/login')}
          >
            <Text className="text-sm font-semibold uppercase tracking-wide text-slate-950 dark:text-white">
              Ingresar
            </Text>
            <MaterialCommunityIcons
              color={colors.onSurface}
              name="login"
              size={18}
            />
          </Pressable>
        </View>
      </View>

      <View className="py-4">
        {features.map((feature) => (
          <FeatureItem key={feature.icon} {...feature} colors={colors} />
        ))}
      </View>

      <View className="py-12">
        <View className="overflow-hidden rounded-2xl border border-primary/20 bg-slate-50 p-8 shadow-lg dark:bg-[#282d31]">
          <View className="mb-6 flex-row items-center gap-2 self-start rounded-full bg-primary/20 px-3 py-1.5">
            <MaterialCommunityIcons
              color={colors.primary}
              name="creation"
              size={16}
            />
            <Text className="text-xs font-semibold uppercase tracking-wide text-primary">
              Asistente IA Integrado
            </Text>
          </View>

          <Text className="mb-4 text-[26px] font-bold leading-8 text-slate-950 dark:text-white">
            Tu propio analista de running
          </Text>

          <Text className="text-base leading-6 text-slate-600 dark:text-slate-300">
            Preguntá en lenguaje natural sobre métricas, tendencias o pedí
            sugerencias de rutinas basadas en el historial de tus corredores.
            El asistente genera planes, interpreta rendimiento y ofrece
            feedback automatizado.
          </Text>
        </View>
      </View>

      <View className="mt-8 flex-row gap-4">
        <View className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-[#1d2125]">
          <MaterialCommunityIcons color={colors.primary} name="run-fast" size={24} style={{ marginBottom: 8 }} />
          <Text className="mb-1 text-base font-bold text-slate-950 dark:text-white">Corredores</Text>
          <Text className="text-sm leading-5 text-slate-600 dark:text-slate-300">
            Registrá carreras, accedé a estadísticas, competí en desafíos y recibí estímulos personalizados.
          </Text>
        </View>
        <View className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-[#1d2125]">
          <MaterialCommunityIcons color={colors.primary} name="whistle" size={24} style={{ marginBottom: 8 }} />
          <Text className="mb-1 text-base font-bold text-slate-950 dark:text-white">Entrenadores</Text>
          <Text className="text-sm leading-5 text-slate-600 dark:text-slate-300">
            Gestioná equipos, planificá con IA, controlá asistencia y administrá suscripciones.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
