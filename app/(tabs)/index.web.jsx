import { HomeLandingScreen } from '../../components/home/home-landing-screen.jsx';
import { AuthenticatedHomeScreen } from '../../components/home/authenticated-home-screen.jsx';
import { useAuthStore } from '../../store/auth-store.js';

export default function HomeScreenWeb() {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);

  if (!hydrated) return null;
  return user ? <AuthenticatedHomeScreen /> : <HomeLandingScreen />;
}
