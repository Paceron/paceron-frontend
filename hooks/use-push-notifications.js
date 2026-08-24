import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../store/auth-store.js';
import { registerPushToken } from '../services/notifications.js';
import { isAndroid } from '../utils/platform.js';

// Con la app abierta (foreground) no se muestra el banner nativo del
// sistema — se maneja con Toast en el segundo useEffect de abajo, mismo
// mecanismo de feedback que el resto de la app (ver
// docs/superpowers/specs/2026-08-16-notifications-design.md).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Pide permiso tras el login, registra el token contra el backend, y
// cablea los listeners de foreground (Toast) y tap-to-navigate
// (data.route). Android-only — en web/iOS no hace nada (isAndroid, no
// isMobile: iOS no está contemplado todavía, aunque isMobile lo incluya).
export function usePushNotifications() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const registeredForUserId = useRef(null);

  useEffect(() => {
    if (!isAndroid || !user?.userId) return;
    if (registeredForUserId.current === user.userId) return;
    registeredForUserId.current = user.userId;

    (async () => {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return;

        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
        await registerPushToken(token, 'android');
      } catch {
        // best-effort — permiso rechazado o fallo de red no debe romper
        // el arranque de la app; el badge in-app sigue siendo el fallback
      }
    })();
  }, [user?.userId]);

  useEffect(() => {
    if (!isAndroid) return undefined;

    const foregroundSub = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body } = notification.request.content;
      Toast.show({ type: 'info', text1: title ?? '', text2: body ?? '' });
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = response.notification.request.content.data?.route;
      if (route) router.push(route);
    });

    return () => {
      foregroundSub.remove();
      responseSub.remove();
    };
  }, [router]);
}
