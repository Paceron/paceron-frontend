import { useLocalSearchParams } from 'expo-router';
import { DashboardScreen } from '../../../../components/dashboard/dashboard-screen.jsx';

// La pantalla vive DENTRO de `teams/[teamId]/` y NO en `routes/catalog.js`: el
// acceso es por la pestaña "Rendimiento" del detalle de equipo, no por navegación
// del catálogo. Agregarla al catálogo rompería __tests__/routes.catalog.test.js a
// propósito — es el test que fija esa decisión.
export default function TeamDashboard() {
  const { teamId } = useLocalSearchParams();
  return <DashboardScreen teamId={teamId} />;
}
