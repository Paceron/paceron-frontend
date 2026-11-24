import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { IconButton } from '../shared/icon-button.jsx';
import { MarkdownView } from './markdown-view.jsx';
import termsMarkdown from '../../data/legal/terms-and-conditions.md';

// Modal de solo lectura con el contrato. Cerrarlo no acepta nada: la
// aceptación es siempre un acto explícito sobre el checkbox del registro.
export function TermsModal({ visible, onClose }) {
  return (
    <Modal
      nativeID="terms-modal"
      testID="terms-modal"
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View className="flex-1 bg-black/50" nativeID="terms-modal-container" testID="terms-modal-container">
        <Pressable
          className="absolute inset-0"
          nativeID="terms-modal-backdrop"
          onPress={onClose}
          testID="terms-modal-backdrop"
        />
        <View
          className="flex-1 items-center justify-center px-4"
          nativeID="terms-modal-wrapper"
          pointerEvents="box-none"
          testID="terms-modal-wrapper"
        >
          <View
            className="max-h-[80%] w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-surface"
            nativeID="terms-modal-card"
            testID="terms-modal-card"
          >
            <View
              className="flex-row items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800"
              nativeID="terms-modal-header"
              testID="terms-modal-header"
            >
              <Text
                className="text-lg font-bold text-slate-900 dark:text-white"
                nativeID="terms-modal-title"
                testID="terms-modal-title"
              >
                Términos y Condiciones
              </Text>
              <IconButton
                icon="close"
                idPrefix="terms-modal-close"
                label="Cerrar"
                onPress={onClose}
                size={36}
              />
            </View>

            {/* Sin flex-1: la tarjeta solo tiene max-h, sin altura propia, y en nativo un
                hijo flex-1 no tiene contra qué crecer y colapsa a 0 (el texto no se veía en
                mobile; en web el CSS sí lo estira). Crece con su contenido y se achica hasta
                el máximo de la tarjeta, donde scrollea. */}
            <ScrollView
              className="px-6 py-4"
              nativeID="terms-modal-scroll"
              style={{ flexGrow: 0, flexShrink: 1 }}
              testID="terms-modal-scroll"
            >
              <MarkdownView content={termsMarkdown} idPrefix="terms-modal-content" />
            </ScrollView>

            <View
              className="border-t border-slate-200 px-6 py-4 dark:border-slate-800"
              nativeID="terms-modal-footer"
              testID="terms-modal-footer"
            >
              <Pressable
                className="h-11 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
                nativeID="terms-modal-close-button"
                testID="terms-modal-close-button"
                onPress={onClose}
                accessibilityRole="button"
              >
                <Text
                  className="text-sm font-semibold text-slate-700 dark:text-slate-200"
                  nativeID="terms-modal-close-button-label"
                  testID="terms-modal-close-button-label"
                >
                  Cerrar
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
