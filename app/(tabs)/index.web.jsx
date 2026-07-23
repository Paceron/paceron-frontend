import { HomeLandingScreen } from '../../components/home/home-landing-screen.jsx';
import { HomeWebNarrowScreen } from '../../components/home/home-web-narrow-screen.jsx';
import { AuthenticatedHomeScreen } from '../../components/home/authenticated-home-screen.jsx';
import { useAuthStore } from '../../store/auth-store.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';

export default function HomeScreenWeb() {
  const user = useAuthStore((s) => s.user);
  const isNarrowWeb = useIsNarrowWeb();

  if (user) return <AuthenticatedHomeScreen />;
  return isNarrowWeb ? <HomeWebNarrowScreen /> : <HomeLandingScreen />;
}
