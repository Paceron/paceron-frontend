import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { getAttendanceQr } from '../../services/attendance.js';
import { toQrDataUri } from '../../utils/attendance-qr-image.js';
import { buildAttendanceQrHtml } from '../../utils/attendance-qr-pdf.js';
import { printAttendanceQr, resolveLogoDataUri } from '../../utils/attendance-qr-file.js';
import { shareAttendanceQr, shareViaWhatsApp } from '../../utils/attendance-qr-share.js';
import { notifyError, notifySuccess } from '../../utils/haptics.js';

// Modal del QR de una sesión: lo muestra, y desde ahí se descarga como PDF, se
// comparte como archivo o se manda el aviso por WhatsApp.
//
// El QR se pide al abrir (`GET /attendance/qr`), no antes: es una request por
// apertura y no hay nada que mostrar hasta que llega. Ojo con una restricción
// real del endpoint — el QR es por sesión de instancia, y el backend lo valida
// contra el equipo; si el entrenador perdió permisos entre que abrió la
// pantalla y que tocó el botón, esto es un 403 y se muestra como tal.
export function AttendanceQrModal({ visible, onClose, teamName, session, teamId, sessionInstanceId, formatDate }) {
  const colors = useThemeColors();
  const [qrDataUri, setQrDataUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState(null);
  const [error, setError] = useState(null);

  // El QR se reinicia en cada apertura: si queda el de la apertura anterior, un
  // fallo de red mostraría el QR viejo como si fuera el bueno.
  useEffect(() => {
    if (!visible) {
      setQrDataUri(null);
      setError(null);
      setBusyAction(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getAttendanceQr(teamId, sessionInstanceId)
      .then((dto) => {
        if (cancelled) return;
        const uri = toQrDataUri(dto?.qr_code_base64);
        if (!uri) {
          setError('El backend no devolvió una imagen de QR para esta sesión.');
          return;
        }
        setQrDataUri(uri);
      })
      .catch((requestError) => {
        if (cancelled) return;
        setError(requestError.status === 403
          ? 'Ya no administrás este equipo, así que no se puede emitir su QR.'
          : 'No pudimos generar el QR de esta sesión.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [visible, teamId, sessionInstanceId]);

  // El logo y el HTML se arman recién al descargar o compartir, no al abrir: son
  // trabajo de plataforma (leer el asset, cachear base64) que no vale la pena
  // pagar si el entrenador solo va a mirar el QR.
  //
  // OJO con `date`: se pasa el ISO CRUDO, sin formatear. `buildAttendanceQrHtml`
  // lo formatea él (a DD-MM-AAAA) porque su parseo está pensado para no correr el
  // día por un offset de zona horaria en un documento impreso. Preformatear acá
  // hacía que el regex no matcheara y la fecha NO se imprimiera, sin error.
  const buildHtml = async () => {
    const logoDataUri = await resolveLogoDataUri();
    return buildAttendanceQrHtml({
      team: { name: teamName },
      session,
      qrDataUri,
      logoDataUri,
    });
  };

  const handleDownload = async () => {
    if (busyAction) return;
    setBusyAction('download');
    setError(null);
    try {
      // En nativo devuelve el uri del PDF; en web abre el diálogo de impresión
      // y devuelve `{ printed: true }` — no hay archivo que compartir después.
      const result = await printAttendanceQr(await buildHtml());
      if ('printed' in result) {
        notifySuccess();
      } else {
        // El archivo quedó en caché temporal: guardarlo en la carpeta del
        // usuario requiere permisos de storage que no tenemos en Android scoped
        // storage. Lo honesto es ofrecer la hoja de compartir, que es lo que
        // `Share` hace bien en las dos plataformas.
        await shareAttendanceQr(result.uri, {
          dialogTitle: 'Asistencia — Paceron',
          html: await buildHtml(),
        });
        notifySuccess();
      }
    } catch (_actionError) {
      notifyError();
      setError('No pudimos generar el PDF. Probá de nuevo.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleShare = async () => {
    if (busyAction) return;
    setBusyAction('share');
    setError(null);
    try {
      const html = await buildHtml();
      const printed = await printAttendanceQr(html);
      if ('printed' in printed) return;
      await shareAttendanceQr(printed.uri, { dialogTitle: 'Asistencia — Paceron', html });
      notifySuccess();
    } catch (_actionError) {
      notifyError();
      setError('No pudimos compartir el QR.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleWhatsApp = async () => {
    if (busyAction) return;
    setBusyAction('whatsapp');
    setError(null);
    try {
      await shareViaWhatsApp({
        teamName,
        sessionName: session?.name,
        date: formatDate(session?.date),
      });
    } catch (_actionError) {
      notifyError();
      setError('No pudimos abrir WhatsApp.');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <Modal
      animationType="fade"
      nativeID="attendance-qr-modal"
      onRequestClose={onClose}
      testID="attendance-qr-modal"
      transparent
      visible={visible}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/50 px-4"
        nativeID="attendance-qr-modal-backdrop"
        onPress={onClose}
        testID="attendance-qr-modal-backdrop"
      >
        <Pressable
          className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-surface"
          nativeID="attendance-qr-modal-card"
          onPress={() => {}}
          testID="attendance-qr-modal-card"
        >
          <View className="mb-3 flex-row items-start" nativeID="attendance-qr-modal-header" testID="attendance-qr-modal-header">
            <View className="flex-1" nativeID="attendance-qr-modal-titles" testID="attendance-qr-modal-titles">
              <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="attendance-qr-modal-title" testID="attendance-qr-modal-title">
                QR de asistencia
              </Text>
              <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="attendance-qr-modal-subtitle" testID="attendance-qr-modal-subtitle">
                {[teamName, session?.name].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Cerrar"
              className="h-9 w-9 items-center justify-center rounded-full active:opacity-70 hover:bg-slate-100 dark:hover:bg-slate-800"
              nativeID="attendance-qr-modal-close"
              onPress={onClose}
              testID="attendance-qr-modal-close"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={20} />
            </Pressable>
          </View>

          <View className="items-center rounded-xl bg-slate-50 p-4 dark:bg-slate-900/60" nativeID="attendance-qr-modal-qr-box" testID="attendance-qr-modal-qr-box">
            {loading ? (
              <View className="h-48 w-48 items-center justify-center" nativeID="attendance-qr-modal-loading" testID="attendance-qr-modal-loading">
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : qrDataUri ? (
              <Image
                accessibilityLabel="Código QR de la sesión"
                contentFit="contain"
                nativeID="attendance-qr-modal-image"
                source={{ uri: qrDataUri }}
                style={{ width: 192, height: 192 }}
                testID="attendance-qr-modal-image"
              />
            ) : (
              <View className="h-48 w-48 items-center justify-center px-2" nativeID="attendance-qr-modal-placeholder" testID="attendance-qr-modal-placeholder">
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="qrcode" size={36} />
              </View>
            )}
          </View>

          {error ? (
            <Text className="mt-3 text-center text-sm text-red-600 dark:text-red-400" nativeID="attendance-qr-modal-error" testID="attendance-qr-modal-error">
              {error}
            </Text>
          ) : null}

          {/* Los tres botones están siempre habilitados mientras haya QR: el
              atajo de WhatsApp no necesita el archivo, y el PDF sirve aunque no
              haya ninguna asistencia cargada todavía (el QR es de la sesión, no
              de las asistencias). */}
          <View className="mt-4 gap-2" nativeID="attendance-qr-modal-actions" testID="attendance-qr-modal-actions">
            <Pressable
              accessibilityLabel="Descargar el QR como PDF"
              className={`h-11 flex-row items-center justify-center gap-2 rounded-full active:opacity-80 ${busyAction || !qrDataUri ? 'bg-slate-400' : 'bg-primary'}`}
              disabled={Boolean(busyAction) || !qrDataUri}
              nativeID="attendance-qr-modal-download"
              onPress={handleDownload}
              testID="attendance-qr-modal-download"
            >
              {busyAction === 'download' ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons color="#ffffff" name="file-download-outline" size={18} />
                  <Text className="text-sm font-semibold uppercase tracking-wide text-white" nativeID="attendance-qr-modal-download-label" testID="attendance-qr-modal-download-label">
                    Descargar PDF
                  </Text>
                </>
              )}
            </Pressable>

            <View className="flex-row gap-2" nativeID="attendance-qr-modal-actions-row" testID="attendance-qr-modal-actions-row">
              <Pressable
                accessibilityLabel="Compartir el QR como archivo"
                className={`h-11 flex-1 flex-row items-center justify-center gap-2 rounded-full border border-slate-200 active:opacity-70 dark:border-slate-700 ${busyAction || !qrDataUri ? 'opacity-50' : ''}`}
                disabled={Boolean(busyAction) || !qrDataUri}
                nativeID="attendance-qr-modal-share"
                onPress={handleShare}
                testID="attendance-qr-modal-share"
              >
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="share-variant-outline" size={18} />
                <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="attendance-qr-modal-share-label" testID="attendance-qr-modal-share-label">
                  Compartir
                </Text>
              </Pressable>

              <Pressable
                accessibilityLabel="Enviar un aviso por WhatsApp. Ojo: el PDF no va adjunto, los enlaces de WhatsApp no pueden mandar archivos"
                className={`h-11 flex-1 flex-row items-center justify-center gap-2 rounded-full border border-slate-200 active:opacity-70 dark:border-slate-700 ${busyAction ? 'opacity-50' : ''}`}
                disabled={Boolean(busyAction)}
                nativeID="attendance-qr-modal-whatsapp"
                onPress={handleWhatsApp}
                testID="attendance-qr-modal-whatsapp"
              >
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="whatsapp" size={18} />
                <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="attendance-qr-modal-whatsapp-label" testID="attendance-qr-modal-whatsapp-label">
                  WhatsApp
                </Text>
              </Pressable>
            </View>

            {/* El atajo de WhatsApp abre una conversación con el aviso, no
                adjunta el PDF (R2, limitación de la plataforma que no depende de
                nosotros). El `accessibilityLabel` del botón lo dice, pero el
                usuario que va a compartirlo es el que mira acá: si no está
                escrito, manda a 20 corredores a buscar un archivo que nunca
                llegó. */}
            <Text className="px-1 pt-1 text-xs text-slate-500 dark:text-slate-400" nativeID="attendance-qr-modal-hint" testID="attendance-qr-modal-hint">
              El botón de WhatsApp abre una conversación con el aviso: el PDF no se adjunta. Para mandarlo, usá &quot;Compartir&quot;.
            </Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
