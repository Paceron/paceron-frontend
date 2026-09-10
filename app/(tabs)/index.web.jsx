import { HomeLandingScreen } from '../../components/home/home-landing-screen.jsx';
import { HomeWebNarrowScreen } from '../../components/home/home-web-narrow-screen.jsx';
import { AuthenticatedHomeScreen } from '../../components/home/authenticated-home-screen.jsx';
import { useAuthStore } from '../../store/auth-store.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';

export default function HomeScreenWeb() {
  const userId = useAuthStore((s) => s.userId);
  const isNarrowWeb = useIsNarrowWeb();

  if (userId) return <AuthenticatedHomeScreen />;
  return isNarrowWeb ? <HomeWebNarrowScreen /> : <HomeLandingScreen />;
}
