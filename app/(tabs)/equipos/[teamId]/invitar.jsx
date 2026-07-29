import { useLocalSearchParams } from 'expo-router';
import { InviteTeamMembersScreen } from '../../../../components/team/invite-team-members-screen.jsx';

export default function InvitarCorredores() {
  const { teamId } = useLocalSearchParams();
  return <InviteTeamMembersScreen teamId={teamId} />;
}
