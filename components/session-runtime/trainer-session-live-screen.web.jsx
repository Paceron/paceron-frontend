import { MobileOnlyRoute } from '../guards/platform-gate.jsx';

// `@maplibre/maplibre-react-native` no tiene build web (su `Camera` llama
// `codegenNativeComponent`, que react-native-web no implementa -- un
// `TypeError` que tira abajo el bundle ENTERO de web, no solo esta pantalla).
// `MobileOnlyRoute` ya redirige a "/" en web, pero eso es un gate de RENDER,
// no de bundling -- Metro igual baja el módulo nativo del archivo hermano
// (mismo quirk ya documentado para expo-sqlite en CLAUDE.md). Este stub evita
// el import por completo en la rama web -- mismo patrón que
// components/shared/location-picker.web.jsx.
export function TrainerSessionLiveScreen() {
  return <MobileOnlyRoute />;
}
