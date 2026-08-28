import { useLocalSearchParams } from 'expo-router';
import { TrainingPlanDetailScreen } from '../../../../components/plans/training-plan-detail-screen.jsx';

export default function MyPlanDetail() {
  const { planId } = useLocalSearchParams();
  return <TrainingPlanDetailScreen planId={planId} />;
}
