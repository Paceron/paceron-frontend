import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { createPreference, getPayment } from '../../services/payments.js';
import { toCreatePreferencePayload, toPreferenceResponseModel, toPaymentModel } from '../../services/normalizers.js';
import { SectionCard } from '../forms/section-card.jsx';
import { InputField, PickerField } from '../forms/fields.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';
// Sin extensión a propósito: Metro solo aplica resolución por plataforma
// (.web.jsx antes que .jsx) cuando el specifier NO trae extensión.
import { CheckoutFlow } from './checkout-flow';

const CONCEPT_OPTIONS = [
  { id: 'order', name: 'order' },
  { id: 'subscription', name: 'subscription' },
];

// Pantalla interna sin entrada en routes/catalog.js — solo alcanzable
// tipeando /profile/payments-testbed. Prueba la plomería de Fase 0
// (services/payments.js + CheckoutFlow) contra los mocks; sin
// verificación en vivo contra Mercado Pago todavía (el backend no tiene
// sandbox configurado). Ver
// docs/superpowers/specs/2026-09-02-payments-fase0-frontend-design.md.
function PaymentsTestbedScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();

  const [itemTitle, setItemTitle] = useState('Item de prueba');
  const [amount, setAmount] = useState('1000');
  const [concept, setConcept] = useState('order');
  const [creating, setCreating] = useState(false);
  const [preference, setPreference] = useState(null);
  const [lastPayment, setLastPayment] = useState(null);

  const handleCreatePreference = async () => {
    if (creating) return;
    const unitPrice = Number(amount);
    if (!itemTitle.trim() || !unitPrice || unitPrice <= 0) {
      Toast.show({ type: 'error', text1: 'Completá título y un monto mayor a 0' });
      return;
    }
    setCreating(true);
    try {
      const dto = await createPreference(toCreatePreferencePayload({
        concept,
        description: itemTitle.trim(),
        items: [{ title: itemTitle.trim(), quantity: 1, unitPrice }],
      }));
      setPreference(toPreferenceResponseModel(dto));
      setLastPayment(null);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'No pudimos crear la preferencia', text2: error.message });
    } finally {
      setCreating(false);
    }
  };

  const handleApproved = async (payment) => {
    Toast.show({ type: 'success', text1: 'Pago aprobado' });
    try {
      // Re-fetch deliberately, to exercise GET /payments/:id (the testbed's job is proving the whole service surface works, not just the happy path CheckoutFlow already returned).
      const dto = await getPayment(payment.paymentId);
      setLastPayment(toPaymentModel(dto));
    } catch {
      setLastPayment(payment);
    }
  };

  const handleError = (error) => {
    Toast.show({ type: 'error', text1: 'Error en el checkout', text2: error?.message });
  };

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="payments-testbed-screen-scroll"
      showsVerticalScrollIndicator={false}
      testID="payments-testbed-screen-scroll"
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="payments-testbed-screen-container" testID="payments-testbed-screen-container">
        <View className="mb-8 flex-row items-center gap-2" nativeID="payments-testbed-screen-header" testID="payments-testbed-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="payments-testbed-screen-back-button"
            onPress={() => router.back()}
            testID="payments-testbed-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="payments-testbed-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="payments-testbed-screen-title">
            Testbed de pagos
          </Text>
        </View>

        <SectionCard icon="flask-outline" title="Crear preferencia">
          <InputField dense label="Título del item" onChange={setItemTitle} value={itemTitle} />
          <InputField dense keyboardType="number-pad" label="Monto" onChange={setAmount} value={amount} />
          <PickerField dense label="Concept" onChange={setConcept} options={CONCEPT_OPTIONS} value={concept} />

          <Pressable
            className={`h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 ${creating ? 'opacity-60' : ''}`}
            disabled={creating}
            nativeID="payments-testbed-create-preference-button"
            onPress={handleCreatePreference}
            testID="payments-testbed-create-preference-button"
          >
            {creating ? <ActivityIndicator color={colors.onPrimary} /> : (
              <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="payments-testbed-create-preference-button-label" testID="payments-testbed-create-preference-button-label">
                Crear preferencia
              </Text>
            )}
          </Pressable>
        </SectionCard>

        {preference && (
          <SectionCard icon="credit-card-outline" title="Checkout">
            <CheckoutFlow
              amount={Number(amount)}
              key={preference.preferenceId}
              onApproved={handleApproved}
              onError={handleError}
              preferenceId={preference.preferenceId}
              publicKey={preference.publicKey}
            />
          </SectionCard>
        )}

        {lastPayment && (
          <SectionCard icon="code-json" title="Última respuesta de pago">
            <Text className="text-xs text-slate-600 dark:text-slate-300" nativeID="payments-testbed-last-payment" testID="payments-testbed-last-payment">
              {JSON.stringify(lastPayment, null, 2)}
            </Text>
          </SectionCard>
        )}
      </View>
    </ScrollView>
  );
}

export function PaymentsTestbedScreen() {
  return (
    <RequireAuth>
      <PaymentsTestbedScreenContent />
    </RequireAuth>
  );
}
