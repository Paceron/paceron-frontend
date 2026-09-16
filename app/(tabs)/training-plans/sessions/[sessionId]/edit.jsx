import { useLocalSearchParams } from 'expo-router';
import { EditSessionScreen } from '../../../../../components/plans/edit-session-screen.jsx';

export default function SessionEdit() {
  const { sessionId } = useLocalSearchParams();
  return <EditSessionScreen sessionId={sessionId} />;
}
