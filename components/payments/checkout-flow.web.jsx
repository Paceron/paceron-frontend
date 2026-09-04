import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { initMercadoPago, Payment, StatusScreen } from '@mercadopago/sdk-react';
import { processPayment } from '../../services/payments.js';
import { toProcessPaymentPayload, toPaymentModel } from '../../services/normalizers.js';

// Único componente de checkout para las 3 fases de pagos — la firma se
// extiende entre fases (Fase 1 suma `installmentId` opcional), nunca se
// rompe — Fase 0 sigue funcionando sin pasarlo. Ver
// docs/superpowers/specs/2026-09-02-payments-fase0-frontend-design.md.
// Solo web: Payment Brick es un componente HTML/JS
// (@mercadopago/sdk-react) — ver checkout-flow.jsx para la rama nativa
// (placeholder, sin WebView todavía). El wrapper de React del SDK
// desmonta el brick solo al desmontar este componente — no hace falta
// llamar unmount() a mano (eso es necesario con el SDK vanilla JS, no
// con este wrapper).
export function CheckoutFlow({ preferenceId, publicKey, amount, installmentId, marketplace, onApproved, onError }) {
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
      <View nativeID="checkout-flow-status" testID="checkout-flow-status">
        <StatusScreen initialization={{ paymentId: approvedPaymentId }} />
      </View>
    );
  }

  return (
    <View nativeID="checkout-flow-brick" testID="checkout-flow-brick">
      <Payment
        initialization={{ amount, preferenceId, ...(marketplace ? { marketplace: true } : {}) }}
        onError={handleError}
        onSubmit={handleSubmit}
      />
    </View>
  );
}
