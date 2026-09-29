import { CheckinScreen } from '../../components/checkin/checkin-screen.jsx';

// Ruta de primer nivel, auto-descubierta por Expo Router y **sin** `.web.jsx`:
// la respuesta a "no tengo la app" en web es un aviso dentro de la misma
// pantalla (requisito 6 del change), no una variante distinta de la ruta. Una
// variante `.web.jsx` además obligaría a duplicar el gate de rol.
export default function CheckinRegisterRoute() {
  return <CheckinScreen />;
}
