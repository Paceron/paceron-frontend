# Date picker nativo en mobile — Design

**Fecha:** 2026-07-14
**Estado:** Aprobado, pendiente de implementación (sin plan formal — diseño acotado, implementación directa)

## Contexto

`DateField` (`components/forms/fields.jsx`) hoy solo implementa la rama
web (`<input type="date">`). En mobile, `RegisterScreen` y
`EditProfileScreen` no usan `DateField` para el campo "Fecha de
nacimiento" — usan un `InputField` de texto libre con placeholder
`DD/MM/AAAA`, obligando a tipear el separador `/` manualmente. Se
reemplaza por un selector de fecha nativo real en mobile.

## Alcance de esta spec

`components/forms/fields.jsx` (`DateField`), `components/auth/register-screen.jsx`,
`components/profile/edit-profile-screen.jsx`, `package.json` (nueva
dependencia). Sin cambios de validación (`utils/date-validators.js` no se
toca — el formato interno sigue siendo el string `DD/MM/YYYY` que ya
consume).

## Decisiones

### Dependencia

`@react-native-community/datetimepicker` — compatible con Expo Go en SDK 54
(no requiere dev client custom). Se instala vía `npx expo install
@react-native-community/datetimepicker` (asegura la versión compatible con
el SDK del proyecto).

### `DateField` (mobile)

En vez del `isWeb ? <input type="date"> : (nada, no existe hoy)`, `DateField`
pasa a manejar mobile internamente:

- Un `Pressable` (mismo tratamiento visual que `PickerField`: borde,
  altura `h-12`, texto placeholder cuando vacío) muestra el valor actual
  formateado como `DD/MM/YYYY`, o el placeholder si está vacío.
- Al tocar, abre `DateTimePicker` (de la librería) con `mode="date"`,
  `value` parseado a `Date` desde el string `DD/MM/YYYY` interno (o la
  fecha actual si está vacío), `maximumDate={new Date()}` (no tiene
  sentido una fecha de nacimiento futura).
- Android: `display="default"` (diálogo nativo del sistema), con
  `accentColor="#8cc63e"` (verde primario de la app) para teñir el picker.
  El resto de la apariencia (claro/oscuro, forma del diálogo) la controla
  el sistema operativo — no es controlable por la app, limitación de la
  plataforma, no de la librería.
- iOS: `display="inline"` dentro de un `Modal` propio (con botón
  "Listo"/cerrar), `themeVariant` seteado a `'dark'` o `'light'` según
  `useThemeMode()` de la app (`providers/theme-provider.jsx`) — esto sí es
  controlable y se sincroniza con el theme de Paceron.
- Al confirmar una fecha, se convierte el `Date` de vuelta a string
  `DD/MM/YYYY` y se llama `onChange` (misma interfaz que ya usa
  `DateField` hoy — no cambia el contrato con los consumidores).
- `onBlur`/`touched`/`error` se mantienen igual (se dispara `onBlur` al
  cerrar el picker, con o sin selección).

### Web

Sin cambios — sigue usando `<input type="date">`. Se evaluó usar la misma
librería también en web para buscar apariencia unificada, pero su
implementación web es un wrapper sobre el mismo `<input type="date">` del
browser — no aporta nada distinto a lo que ya hay. Lograr apariencia
idéntica entre mobile y web requeriría un calendario 100% custom (no
nativo), evaluado y descartado por alcance — cada plataforma usa su
selector nativo, que se ven distintos entre sí por diseño (igual que
cualquier date picker "nativo").

### `RegisterScreen` / `EditProfileScreen`

Ambos sacan la rama condicional `isWeb ? <DateField> : <InputField
placeholder="DD/MM/AAAA">` para el campo de fecha de nacimiento y pasan a
usar `<DateField>` directo, sin condicional — `DateField` ya resuelve la
diferencia de plataforma internamente. Elimina código duplicado en ambos
archivos.

## Fuera de alcance

Calendario custom unificado entre plataformas (evaluado, descartado —
alcance mucho mayor). Cambios a `validateBirthDate` u otros validadores.
Selector de fecha en cualquier otro campo del proyecto (no hay otros
campos de fecha actualmente).

## Verificación

Mobile (dispositivo real vía Expo Go, sin emulador disponible localmente):
1. `/register` y `/profile/edit`: tocar el campo "Fecha de nacimiento"
   abre el picker nativo (diálogo en Android, modal inline en iOS), no
   permite tipear texto libre.
2. Seleccionar una fecha la refleja en el campo como `DD/MM/YYYY`.
3. No se puede seleccionar una fecha futura (`maximumDate`).
4. Validación de fecha (`validateBirthDate`) sigue funcionando igual que
   antes (mismo formato de string).
5. En iOS, el picker respeta el tema claro/oscuro actual de la app.

Web: sin cambios, se verifica que `/register` y `/profile/edit` siguen
igual que antes (input nativo del browser).

`npm test` → 32/32 verde.
