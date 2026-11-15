import { LoadingOverlay } from '../shared/loading-overlay.jsx';

export function DashboardLoadingOverlay({ visible, id = 'dashboard-loading', label }) {
  return (
    <LoadingOverlay
      id={id}
      label={label}
      visible={visible}
    />
  );
}
