import { useLocalSearchParams } from 'expo-router';
import { EditTrainingPlanScreen } from '../../../../components/plans/edit-training-plan-screen.jsx';

export default function TrainingPlanEdit() {
  const { planId } = useLocalSearchParams();
  return <EditTrainingPlanScreen planId={planId} />;
}
