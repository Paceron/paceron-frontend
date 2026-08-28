import { useLocalSearchParams } from 'expo-router';
import { AssignTrainingPlanScreen } from '../../../../components/plans/assign-training-plan-screen.jsx';

export default function TrainingPlanAssign() {
  const { planId } = useLocalSearchParams();
  return <AssignTrainingPlanScreen planId={planId} />;
}
