import { useLocalSearchParams } from 'expo-router';
import { EditTeamScreen } from '../../../../components/team/edit-team-screen.jsx';

export default function EditarEquipo() {
  const { teamId } = useLocalSearchParams();
  return <EditTeamScreen teamId={teamId} />;
}
