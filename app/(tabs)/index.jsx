import { HomeMobileScreen } from '../../components/home/home-mobile-screen.jsx';
import { AuthenticatedHomeScreen } from '../../components/home/authenticated-home-screen.jsx';
import { useAuthStore } from '../../store/auth-store.js';

export default function HomeScreen() {
  const userId = useAuthStore((s) => s.userId);
  return userId ? <AuthenticatedHomeScreen /> : <HomeMobileScreen />;
}
