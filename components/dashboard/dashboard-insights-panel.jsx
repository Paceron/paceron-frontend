import { useState } from 'react';
import { View } from 'react-native';
import { TabBar } from '../shared/tab-bar.jsx';
import { ProfileRadarCard } from './profile-radar-card.jsx';

// El perfil de cinco ejes dejó de ser una card más apilada debajo de los
// gráficos: ahora comparte panel con el ranking y la comparación de sesiones,
// cada uno en su pestaña.
//
// Por qué una pestaña y no tres cards apiladas: las secciones contestan preguntas
// distintas y ninguna depende de leer las otras
// al mismo tiempo. Apiladas empujaban el ranking cientos de píxeles abajo; en
// pestañas se llega a cualquiera sin scrollear la pantalla entera. La primera
// pestaña es el radar, así que el estado inicial sigue siendo el mismo que antes.
//
// Las secciones que dependen del rol se pasan como elementos y NO se montan en
// esta pieza: `ranking` llega en null para un corredor y la comparación A/B
// decide adentro si ofrece el submodo owner-only de períodos. La pestaña inactiva
// no se renderiza, así que sus hooks y requests solo existen al abrirla.
export function DashboardInsightsPanel({
  id = 'dashboard-insights',
  summary,
  kind,
  radarTitle,
  ranking = null,
  comparison = null,
}) {
  const tabs = [{ id: 'radar', label: 'Perfil en 5 ejes', icon: 'radar' }];
  if (ranking) tabs.push({ id: 'ranking', label: 'Ranking', icon: 'podium' });
  if (comparison) tabs.push({ id: 'comparison', label: 'Comparación', icon: 'compare-horizontal' });

  const [active, setActive] = useState(tabs[0].id);
  const current = tabs.some((tab) => tab.id === active) ? active : tabs[0].id;

  return (
    <View className="mt-2" nativeID={id} testID={id}>
      {tabs.length > 1 ? (
        <TabBar
          active={current}
          onChange={setActive}
          scope={`${id}-tabs`}
          tabs={tabs}
          wrapClassName="mb-4 flex-row flex-wrap gap-2"
        />
      ) : null}

      <View
        nativeID={`${id}-panel`}
        // `tabpanel` no existe como accessibilityRole en RN (ver tab-bar.jsx);
        // el prop crudo `role` es el que lo expone en web.
        role="tabpanel"
        testID={`${id}-panel`}
      >
        {current === 'radar' ? (
          <ProfileRadarCard id={`${id}-radar`} kind={kind} summary={summary} title={radarTitle} />
        ) : null}
        {current === 'ranking' ? ranking : null}
        {current === 'comparison' ? comparison : null}
      </View>
    </View>
  );
}
