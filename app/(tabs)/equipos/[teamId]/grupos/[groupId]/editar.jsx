import { useLocalSearchParams } from 'expo-router';
import { EditGroupScreen } from '../../../../../../components/team/edit-group-screen.jsx';

export default function EditarGrupo() {
  const { teamId, groupId } = useLocalSearchParams();
  return <EditGroupScreen groupId={groupId} teamId={teamId} />;
}
