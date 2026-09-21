import { useLocalSearchParams } from 'expo-router';
import { GroupCalendarScreen } from '../../../../../../../components/team/group-calendar-screen.jsx';

export default function TeamGroupCalendar() {
  const { teamId, groupId } = useLocalSearchParams();
  return <GroupCalendarScreen groupId={groupId} teamId={teamId} />;
}
