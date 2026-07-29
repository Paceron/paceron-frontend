import { useLocalSearchParams } from 'expo-router';
import { TeamDetailScreen } from '../../../../components/team/team-detail-screen.jsx';

export default function EquipoDetalle() {
  const { teamId } = useLocalSearchParams();
  return <TeamDetailScreen teamId={teamId} />;
}
