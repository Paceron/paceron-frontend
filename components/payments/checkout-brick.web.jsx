import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { initMercadoPago, Payment, StatusScreen } from '@mercadopago/sdk-react';
import { processPayment } from '../../services/payments.js';
import { toProcessPaymentPayload, toPaymentModel } from '../../services/normalizers.js';

// customization.paymentMethods es requerido por el SDK (@mercadopago/sdk-react
// type.d.ts) — sin él el Brick rechaza la inicialización contra la API real
// de MP con "No payment type was selected" (400), recién detectable contra
// credenciales reales — nunca se notó con mocks porque el Brick ni siquiera
// llega a llamar a MP con la public key falsa. Solo tarjetas: efectivo
// (ticket) no genera token y el backend lo exige, y la billetera de
// Mercado Pago / Mercado Crédito no manda formData (handleSubmit lee
// formData.token) y además confirma por redirect + webhook, que no está
// cableado. Mostrarlos solo llevaba a un error.
// Constante de módulo para que sea la misma referencia en cada render (ver
// el comentario de CheckoutBrick).
const PAYMENT_CUSTOMIZATION = { paymentMethods: { creditCard: 'all', debitCard: 'all' } };

// Brick real de Mercado Pago, sin chrome propio — lo envuelve
// checkout-flow.web.jsx (modal) para los callers normales de la app web, o
// se usa directo (sin chrome) desde checkout-web-page.jsx, que ya corre
// dentro del modal nativo de checkout-flow.jsx. Ver
// docs/superpowers/specs/2026-09-04-checkout-modal-unification-design.md.
// El wrapper de React del SDK desmonta el brick solo al desmontar este
// componente — no hace falta llamar unmount() a mano (eso es necesario
// con el SDK vanilla JS, no con este wrapper).
// `concept` es opcional y solo lo pasa el pago de cuota de equipo
// ("team_subscription"): el backend lo necesita para resolver el access token
// de Mercado Pago del ENTRENADOR y cobrar con split. Sin él el pago se cobra
// con el token de Paceron y la plata no le llega al entrenador, sin ningún
// error visible. Los callers de tier/testbed no lo pasan y siguen igual.
export function CheckoutBrick({ preferenceId, publicKey, amount, installmentId, marketplace, concept, onApproved, onError }) {
  const [approvedPaymentId, setApprovedPaymentId] = useState(null);

  useEffect(() => {
    initMercadoPago(publicKey);
  }, [publicKey]);

  // El <Payment> del SDK desmonta y vuelve a crear el brick cada vez que
  // cambia la REFERENCIA de initialization, customization, onSubmit u onError
  // (son deps de su useEffect). Con objetos y funciones inline, cualquier
  // re-render lo reiniciaba: en Chrome de Android abrir el teclado achica la
  // ventana, algo arriba re-renderiza con useWindowDimensions y el formulario
  // se recargaba con lo tipeado perdido (bug real, 2026-11-10). Por eso los
  // objetos van memoizados por sus valores y los callbacks son estables y
  // leen las props actuales desde un ref.
  const latest = useRef({});
  latest.current = { preferenceId, installmentId, concept, onApproved, onError };

  const initialization = useMemo(
    () => ({ amount, preferenceId, ...(marketplace ? { marketplace: true } : {}) }),
    [amount, preferenceId, marketplace],
  );

  // El Brick espera que onSubmit devuelva una Promise: resuelve para que
  // el brick muestre su propio estado de éxito, rechaza para que
  // muestre su propio estado de error (contrato de @mercadopago/sdk-react).
  const handleSubmit = useCallback(({ formData }) => {
    const current = latest.current;
    return processPayment(toProcessPaymentPayload({
      token: formData.token,
      transactionAmount: formData.transaction_amount,
      paymentMethodId: formData.payment_method_id,
      installments: formData.installments,
      payerEmail: formData.payer.email,
      preferenceId: current.preferenceId,
      installmentId: current.installmentId,
      concept: current.concept,
    }))
      .then((dto) => {
        const payment = toPaymentModel(dto);
        setApprovedPaymentId(payment.paymentId);
        latest.current.onApproved?.(payment);
      })
      .catch((error) => {
        latest.current.onError?.(error);
        throw error;
      });
  }, []);

  const handleError = useCallback((error) => {
    latest.current.onError?.(error);
  }, []);

  const statusInitialization = useMemo(() => ({ paymentId: approvedPaymentId }), [approvedPaymentId]);

  if (approvedPaymentId) {
    return (
      <View nativeID="checkout-brick-status" testID="checkout-brick-status">
        <StatusScreen initialization={statusInitialization} />
      </View>
    );
  }

  return (
    <View nativeID="checkout-brick-payment" testID="checkout-brick-payment">
      <Payment
        customization={PAYMENT_CUSTOMIZATION}
        initialization={initialization}
        onError={handleError}
        onSubmit={handleSubmit}
      />
    </View>
  );
}
