import { Redirect } from 'expo-router';
import { isWeb } from '../../utils/platform.js';

export function MobileOnlyRoute({ children, redirectHref = '/' }) {
  if (isWeb) {
    return <Redirect href={redirectHref} />;
  }

  return <>{children}</>;
}
