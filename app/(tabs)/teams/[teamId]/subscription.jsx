import { useLocalSearchParams } from 'expo-router';
import { TeamSubscriptionScreen } from '../../../../components/team/team-subscription-screen.jsx';

export default function TeamSubscription() {
  const { teamId } = useLocalSearchParams();
  return <TeamSubscriptionScreen teamId={teamId} />;
}
