import { AttendanceScreen } from '../../components/attendance/attendance-screen.jsx';

// Ruta de primer nivel, auto-descubierta por Expo Router y sin `.web.jsx`
// (D2): hereda el shell de app/(tabs)/_layout.jsx, que ya resuelve el
// responsive (web ancho / web angosto / mobile) por viewport. El guard de rol
// va adentro de la pantalla, igual que en las demás rutas de la tab.
export default function AttendanceIndex() {
  return <AttendanceScreen />;
}
