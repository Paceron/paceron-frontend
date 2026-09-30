import { useMutation } from '@tanstack/react-query';
import { registerCheckin as registerCheckinService } from '../services/attendance.js';

// Registro de asistencia del corredor (POST /attendance/team/:id/session/:id).
//
// Patrón C igual que el resto del change: la mutación deja propagar el error y el
// try/catch vive en el caller, para que la pantalla pueda distinguir un 403 de un
// 422 mirando `error.status` y no por el texto.
//
// A diferencia de las mutaciones del entrenador NO hay `onSuccess` que invalide
// nada: el registro del corredor no cambia ninguna query que la app tenga
// cacheada —el único lugar donde se ve su asistencia es el cartel impreso y el
// registro que acaba de hacer— así que invalidar sería un refetch al pedo.
//
// `isSaving` se expone aunque la pantalla no lo llegue a mirar: la fase
// `submitting` de la pantalla ya cubre el "no ofrecer volver a escanear", pero
// cualquier consumidor futuro lo necesita y pedirlo después implicaría cambiar
// el hook.
export function useSaveCheckin() {
  const mutation = useMutation({
    mutationFn: (payload) => registerCheckinService(payload),
  });

  return { saveCheckin: mutation.mutateAsync, isSaving: mutation.isPending };
}
