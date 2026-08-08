import { useLocalSearchParams } from 'expo-router';
import { InviteTeamMembersScreen } from '../../../../components/team/invite-team-members-screen.jsx';

export default function TeamInvite() {
  const { teamId } = useLocalSearchParams();
  return <InviteTeamMembersScreen teamId={teamId} />;
}
