import { Component } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Updates from 'expo-updates';
import { isWeb } from '../../utils/platform.js';

async function reloadApp() {
  if (isWeb) {
    window.location.reload();
    return;
  }
  try {
    await Updates.reloadAsync();
  } catch {
    // Expo Go / dev build sin runtime de updates activo — no hay más
    // acción posible, el usuario cierra y reabre la app a mano.
  }
}

export class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View
        nativeID="error-boundary-fallback"
        testID="error-boundary-fallback"
        className="flex-1 items-center justify-center bg-white dark:bg-surface px-8"
      >
        <Text
          nativeID="error-boundary-title"
          testID="error-boundary-title"
          className="text-lg font-semibold text-slate-900 dark:text-white text-center mb-2"
        >
          Algo salió mal
        </Text>
        <Text
          nativeID="error-boundary-description"
          testID="error-boundary-description"
          className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6"
        >
          Tuvimos un problema inesperado. Probá recargar la app.
        </Text>
        <Pressable
          nativeID="error-boundary-reload-button"
          testID="error-boundary-reload-button"
          onPress={reloadApp}
          className="bg-primary px-6 py-3 rounded-xl"
        >
          <Text
            nativeID="error-boundary-reload-button-text"
            testID="error-boundary-reload-button-text"
            className="text-white font-semibold"
          >
            Recargar
          </Text>
        </Pressable>
      </View>
    );
  }
}
