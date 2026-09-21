import { useLocalSearchParams } from 'expo-router';
import { GroupCalendarDayScreen } from '../../../../../../../components/team/group-calendar-day-screen.jsx';

export default function TeamGroupCalendarDay() {
  const { teamId, groupId, date } = useLocalSearchParams();
  return <GroupCalendarDayScreen date={date} groupId={groupId} teamId={teamId} />;
}
