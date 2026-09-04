import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { initMercadoPago, Payment, StatusScreen } from '@mercadopago/sdk-react';
import { processPayment } from '../../services/payments.js';
import { toProcessPaymentPayload, toPaymentModel } from '../../services/normalizers.js';

// Brick real de Mercado Pago, sin chrome propio — lo envuelve
// checkout-flow.web.jsx (modal) para los callers normales de la app web, o
// se usa directo (sin chrome) desde checkout-web-page.jsx, que ya corre
// dentro del modal nativo de checkout-flow.jsx. Ver
// docs/superpowers/specs/2026-09-04-checkout-modal-unification-design.md.
// El wrapper de React del SDK desmonta el brick solo al desmontar este
// componente — no hace falta llamar unmount() a mano (eso es necesario
// con el SDK vanilla JS, no con este wrapper).
export function CheckoutBrick({ preferenceId, publicKey, amount, installmentId, marketplace, onApproved, onError }) {
  const [approvedPaymentId, setApprovedPaymentId] = useState(null);

  useEffect(() => {
    initMercadoPago(publicKey);
  }, [publicKey]);

  // El Brick espera que onSubmit devuelva una Promise: resuelve para que
  // el brick muestre su propio estado de éxito, rechaza para que
  // muestre su propio estado de error (contrato de @mercadopago/sdk-react).
  const handleSubmit = ({ formData }) => processPayment(toProcessPaymentPayload({
    token: formData.token,
    transactionAmount: formData.transaction_amount,
    paymentMethodId: formData.payment_method_id,
    installments: formData.installments,
    payerEmail: formData.payer.email,
    preferenceId,
    installmentId,
  }))
    .then((dto) => {
      const payment = toPaymentModel(dto);
      setApprovedPaymentId(payment.paymentId);
      onApproved?.(payment);
    })
    .catch((error) => {
      onError?.(error);
      throw error;
    });

  const handleError = (error) => {
    onError?.(error);
  };

  if (approvedPaymentId) {
    return (
      <View nativeID="checkout-brick-status" testID="checkout-brick-status">
        <StatusScreen initialization={{ paymentId: approvedPaymentId }} />
      </View>
    );
  }

  return (
    <View nativeID="checkout-brick-payment" testID="checkout-brick-payment">
      <Payment
        initialization={{ amount, preferenceId, ...(marketplace ? { marketplace: true } : {}) }}
        onError={handleError}
        onSubmit={handleSubmit}
      />
    </View>
  );
}
