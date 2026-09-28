import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  findNodeHandle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FIELD_LABEL } from './fields.jsx';
import { useThemeColors } from '../../theme/colors.js';
import { filterByName } from '../../utils/attendance-filter.js';
import { dedupeById, isSameId } from '../../utils/id-match.js';
import { isAndroid, isWeb } from '../../utils/platform.js';

// Campo de formulario para elegir un valor de una lista BUSCABLE: el trigger
// se ve igual que un select del repo (misma geometría que el trigger de
// PickerField, misma etiqueta) y al apretarlo se abre un Modal con un
// TextInput de filtro arriba y la lista filtrada abajo.
//
// Por qué no `ResponsiveSelectField`: en web el `<select>` nativo no tiene
// dónde escribir para filtrar, y en mobile el `PickerField` es una lista
// pelada — con decenas de opciones que se distinguen por un dato secundario
// (fecha, conteo) y no solo por el nombre, hay que poder escribir para llegar.
// Ver D1 de openspec/changes/gestion-asistencia-entrenador/design.md.
//
// Un solo archivo, sin split `.web.jsx`: el árbol es idéntico en las dos
// plataformas y las únicas decisiones por plataforma son el `behavior` del
// KeyboardAvoidingView y el autofocus del input (comentadas abajo).
export function SearchablePickerField({
  label,
  value,
  options,
  onChange,
  idPrefix,
  placeholder = 'Elegir',
  disabled = false,
  loading = false,
  emptyMessage = 'Sin coincidencias',
  renderOptionMeta,
  // Margen vertical, mismo criterio que SelectField/PickerField/InputField
  // (`className ?? (dense ? 'mb-3' : 'mb-5')`). Sin esto los tres pickers del
  // panel de cascada quedaban pegados uno contra otro y el call site tenía que
  // envolver cada uno en su propio View para separarlos.
  className,
  dense = false,
  hideLabel = false,
}) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef(null);

  // `options` puede llegar sin resolver mientras el caller carga, y hay dos
  // basura que hay quesacarle ANTES de tocar nada: las opciones sin `id` (no son
  // elegibles — al tocarlas `onChange(undefined)` no cambiaría nada y el modal
  // cerraría en silencio) y las repetidas por id normalizado (si `options`
  // mezclara 42 y '42', las dos filas quedarían marcadas a la vez y sus nativeID
  // se pisarían). Ver dedupeById, que tiene test.
  const items = useMemo(() => dedupeById(Array.isArray(options) ? options : []), [options]);

  // 'name' explícito aunque sea el default: deja dicho en el call site que el
  // filtro es por nombre y no por otro campo. La normalización de acentos y
  // mayúsculas vive en filterByName (ya testeada) — no se reimplementa.
  const filtered = useMemo(() => filterByName(items, query, 'name'), [items, query]);

  const selected = items.find((option) => isSameId(option.id, value));

  // Hay valor elegido pero no aparece en la lista. Pasa en los dos casos que el
  // spec hace de primera clase:
  //   - la lista todavía está cargando (el deep link arranca con la sesión ya
  //     elegida y sin opciones en pantalla durante el fetch), y
  //   - la sesión no existe o no es del equipo (deep link inválido).
  // Caer al placeholder en cualquiera de los dos mentiría: en el segundo, la
  // pantalla muestra "Elegir" al lado del error de "esa sesión no existe". Se
  // muestra el id crudo con la tipografía de un valor presente, que es el mismo
  // criterio del DateField hermano (`{value || 'DD/MM/AAAA'}`: nunca cae al
  // placeholder si hay valor).
  const hasValue = value !== null && value !== undefined && value !== '';
  const triggerText = selected ? selected.name : hasValue ? String(value) : placeholder;

  // `loading` también deshabilita el trigger, no solo muestra el spinner: con
  // la carga en curso la lista todavía no existe y el modal se abriría vacío.
  const triggerDisabled = disabled || loading;

  const openPicker = () => {
    // El filtro se limpia al abrir, no al cerrar: si el modal queda montado
    // (visible=false) el estado viejo se vería apenas se reabre.
    setQuery('');
    setOpen(true);
  };

  // Único embudo de cierre: entran por acá el backdrop, el `onRequestClose`
  // (botón de atrás de Android) y el Escape de react-native-web. Baja el
  // teclado a propósito porque en Android el teclado puede sobrevivir al
  // cierre del modal (se desmonta el TextInput, no siempre la ventana del
  // teclado) y dejarlo tapando la pantalla hace parecer que el modal no cerró.
  const closePicker = () => {
    Keyboard.dismiss();
    setOpen(false);
  };

  // Devuelve el foco al trigger al cerrar. El trigger es el ÚNICO camino para
  // reabrir el selector, así que si el foco se pierde el usuario de lector de
  // pantalla queda varado en nativo: al cerrar un Modal en iOS el foco no vuelve
  // solo al elemento que lo abrió, y cae arriba de la pantalla. En web no hace
  // falta (el ModalFocusTrap de react-native-web restaura el elemento previo).
  // Va en un efecto y no dentro de closePicker porque setAccessibilityFocus
  // necesita el nodo ya montado del trigger, que existe siempre, pero recién
  // después del render que cierra el modal.
  useEffect(() => {
    if (open || !triggerRef.current) return;
    AccessibilityInfo.setAccessibilityFocus(findNodeHandle(triggerRef.current));
  }, [open]);

  const chooseOption = (option) => {
    // Se devuelve el id de la opción, nunca el del `value`: el caller siempre
    // recibe el tipo que trae la lista de opciones (ver isSameId).
    onChange(option.id);
    closePicker();
  };

  return (
    <>
      <View className={className ?? (dense ? 'mb-3' : 'mb-5')} nativeID={idPrefix} testID={idPrefix}>
        {!hideLabel && (
          <Text className={FIELD_LABEL} nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
            {label}
          </Text>
        )}
        <Pressable
          accessibilityLabel={`${label}: ${triggerText}`}
          accessibilityRole="combobox"
          // `aria-expanded` es el alias plano de accessibilityState.expanded.
          // Se pasa por lo mismo que `aria-selected` en las opciones: la
          // accessibilityState no la implementa (ver comentario abajo).
          accessibilityState={{ busy: loading, disabled: triggerDisabled, expanded: open }}
          aria-controls={`${idPrefix}-modal-list`}
          aria-expanded={open}
          className={`h-12 flex-row items-center gap-2 rounded-xl border px-4 ${
            disabled
              ? 'border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900'
              : 'border-slate-200 bg-white hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
          }`}
          disabled={triggerDisabled}
          nativeID={`${idPrefix}-trigger`}
          onPress={openPicker}
          ref={triggerRef}
          testID={`${idPrefix}-trigger`}
        >
          <Text
            className={`flex-1 text-sm ${selected || hasValue ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}
            nativeID={`${idPrefix}-trigger-value`}
            numberOfLines={1}
            testID={`${idPrefix}-trigger-value`}
          >
            {triggerText}
          </Text>
          {loading ? (
            <ActivityIndicator color={colors.onSurfaceVariant} size="small" />
          ) : (
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-down" size={20} />
          )}
        </Pressable>
      </View>

      <Modal
        animationType="fade"
        // El diálogo no tenía nombre accesible: en web react-native-web arma un
        // View con role="dialog" + aria-modal, pero sin aria-labelledby el lector
        // de pantalla anuncia "dialog" a secas. El título ya existe con id más
        // abajo (y en web `nativeID` es el atributo `id` del DOM), así que se
        // asocia por id. RN 0.81 parsea `aria-labelledby` a
        // accessibilityLabelledBy, así que funciona en las dos plataformas.
        aria-labelledby={`${idPrefix}-modal-title`}
        nativeID={`${idPrefix}-modal`}
        onRequestClose={closePicker}
        testID={`${idPrefix}-modal`}
        transparent
        visible={open}
      >
        {/* `behavior` en undefined deja el KeyboardAvoidingView como un View
          pelado (el default de RN) — que es lo que corresponde en Android: el
          `adjustResize` default de Expo YA encogió la ventana, y un
          `behavior="height"` ahí la encogería una segunda vez. En iOS la
          ventana no se reacomoda sola y hace falta el `padding` de verdad. En
          web el KeyboardAvoidingView de react-native-web es un View que
          descarta `behavior` (verificado en su dist): sobra un View, no
          molesta. */}
        <KeyboardAvoidingView
          behavior={isAndroid ? undefined : 'padding'}
          nativeID={`${idPrefix}-modal-keyboard-avoiding`}
          style={{ flex: 1 }}
          testID={`${idPrefix}-modal-keyboard-avoiding`}
        >
          {/* Backdrop presable: cierra al tocar afuera (CLAUDE.md, sección
            "Modales"). La card de adentro también es Pressable con un onPress
            no-op, que existe solo para frenar la propagación del click. */}
          <Pressable
            className="flex-1 items-center justify-center bg-black/50 px-4"
            nativeID={`${idPrefix}-modal-backdrop`}
            onPress={closePicker}
            testID={`${idPrefix}-modal-backdrop`}
          >
            <Pressable
              className="max-h-[85%] w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-surface"
              nativeID={`${idPrefix}-modal-card`}
              onPress={() => {}}
              testID={`${idPrefix}-modal-card`}
            >
              <View className="mb-2 flex-row items-center" nativeID={`${idPrefix}-modal-header`} testID={`${idPrefix}-modal-header`}>
                <Text
                  className="flex-1 text-base font-bold text-slate-900 dark:text-white"
                  nativeID={`${idPrefix}-modal-title`}
                  numberOfLines={1}
                  testID={`${idPrefix}-modal-title`}
                >
                  {label}
                </Text>
                {/* Cierre explícito: en iOS no hay botón de atrás, y con el
                  teclado abierto el backdrop puede quedar fuera de la vista. */}
                <Pressable
                  accessibilityLabel="Cerrar"
                  className="h-9 w-9 items-center justify-center rounded-full active:opacity-70 hover:bg-slate-100 dark:hover:bg-slate-800"
                  nativeID={`${idPrefix}-modal-close-button`}
                  onPress={closePicker}
                  testID={`${idPrefix}-modal-close-button`}
                >
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={20} />
                </Pressable>
              </View>

              <View
                className="mb-3 h-11 flex-row items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900/60"
                nativeID={`${idPrefix}-modal-search-box`}
                testID={`${idPrefix}-modal-search-box`}
              >
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="magnify" size={18} />
                <TextInput
                  // Sin esto el único nombre accesible del input sería el
                  // placeholder, y en iOS VoiceOver lee el placeholder como
                  // *valor*, no como nombre — el campo quedaría sin nombre. En
                  // web el placeholder sí calcula el nombre, pero es un nombre
                  // débil que desaparece apenas se empieza a escribir.
                  accessibilityLabel={`Filtrar ${label}`}
                  // Autofocus SOLO en web: abrir el modal con el teclado ya
                  // tapado tapa la lista, que es justo lo que hay que mirar.
                  // En nativo el foco se pide tocando el input.
                  autoFocus={isWeb}
                  // En iOS el autocorrect del teclado "corrige" lo que se está
                  // escribiendo y rompe el filtro a media palabra; en Android
                  // no hace falta pero no estorba.
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="flex-1 text-sm text-slate-900 outline-none dark:text-white"
                  nativeID={`${idPrefix}-modal-search-input`}
                  onChangeText={setQuery}
                  // El filtro ya está aplicado en vivo: la tecla de buscar
                  // sirve para bajar el teclado y ver el resultado completo.
                  onSubmitEditing={Keyboard.dismiss}
                  placeholder="Escribí para filtrar"
                  placeholderTextColor={colors.onSurfaceVariant}
                  returnKeyType="search"
                  testID={`${idPrefix}-modal-search-input`}
                  value={query}
                />
                {query ? (
                  <Pressable
                    accessibilityLabel="Limpiar filtro"
                    nativeID={`${idPrefix}-modal-search-clear-button`}
                    onPress={() => setQuery('')}
                    testID={`${idPrefix}-modal-search-clear-button`}
                  >
                    <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close-circle" size={16} />
                  </Pressable>
                ) : null}
              </View>

              {/* Contador de resultados. El filtro es en vivo, así que sin esto
                un usuario de lector de pantalla tipea "sur", la lista muta, y no
                se entera de nada: ni de que filtró, ni cuántos hay, ni de que
                la lista quedó vacía — y "sin coincidencias" es justamente un
                estado que hay que poder percibir. Va con accessibilityLiveRegion
                y SIEMPRE en el árbol (no condicional): si el nodo aparece ya
                renderizado, el lector no lo detecta como cambio. */}
              <Text
                accessibilityLiveRegion="polite"
                className="mb-2 text-xs text-slate-500 dark:text-slate-400"
                nativeID={`${idPrefix}-modal-results-count`}
                testID={`${idPrefix}-modal-results-count`}
              >
                {loading
                  ? 'Buscando opciones'
                  : filtered.length === 0
                    ? query
                      ? 'Sin coincidencias'
                      : 'Sin opciones para elegir'
                    : `${filtered.length} ${filtered.length === 1 ? 'opción' : 'opciones'}`}
              </Text>

              {/* keyboardShouldPersistTaps="handled" es LA pieza que hace que
                el primer toque sobre una opción la elija en vez de solo bajar
                el teclado: en Android el default del ScrollView es "never", y
                ese toque se lo come el teclado. Con "handled" el toque sigue
                hasta el Pressable de la fila y el teclado se queda.
                keyboardDismissMode="on-drag" complementa: al arrastrar la
                lista para scrollear, el teclado se baja y la lista recupera su
                alto completo. Es el mismo par que usan los forms con TextInput
                del repo (edit-profile-screen, auth-card-shell).
                flex-shrink para que la lista ceda cuando el teclado encoge el
                espacio y no quede cortada abajo — esto es efectivo en nativo; en
                web el ScrollView tiene overflow:auto con max-h-72 como tope
                duro, así que nunca crece y el flex-shrink no llega a actuar. */}
              <ScrollView
                className="max-h-72 flex-shrink"
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
                nativeID={`${idPrefix}-modal-list-scroll`}
                testID={`${idPrefix}-modal-list-scroll`}
              >
                {loading ? (
                  <View
                    className="items-center justify-center py-8"
                    nativeID={`${idPrefix}-modal-loading`}
                    testID={`${idPrefix}-modal-loading`}
                  >
                    <ActivityIndicator color={colors.primary} />
                  </View>
                ) : filtered.length === 0 ? (
                  <Text
                    className="py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                    nativeID={`${idPrefix}-modal-empty`}
                    testID={`${idPrefix}-modal-empty`}
                  >
                    {/* Dos vacíos distintos y dos mensajes distintos: con
                      filtro escrito es "no encontré", sin filtro es "no hay
                      nada para elegir" (el call site de la cascada explica
                      además por qué, con su propio mensaje). */}
                    {query ? emptyMessage : 'Sin opciones disponibles'}
                  </Text>
                ) : (
                  // role="listbox" en el contenedor: es el padre que ARIA
                  // exige para las opciones. No está en el union de roles de RN
                  // 0.81, pero el union de AccessibilityRole cierra en
                  // `| string` y react-native-web reenvía `role` tal cual al
                  // DOM, así que en web arma el HTML válido y en nativo se
                  // ignora sin ruido. Con esto los lectores de pantalla anuncian
                  // la posición ("3 de 87") solos, leyéndola del DOM.
                  <View
                    accessibilityRole="listbox"
                    className="gap-1.5"
                    nativeID={`${idPrefix}-modal-list`}
                    testID={`${idPrefix}-modal-list`}
                  >
                    {filtered.map((option) => {
                      const optionIds = `${idPrefix}-modal-option-${optionSlug(option.id)}`;
                      const isSelected = isSameId(option.id, value);
                      const meta = renderOptionMeta?.(option);

                      return (
                        <Pressable
                          // `option` y no `button`: por ARIA 1.2 `aria-selected`
                          // es un estado válido de option/row/tab/gridcell y NO
                          // de button, así que con role="button" el DOM queda
                          // `<div role="button" aria-selected>` — que es
                          // exactamente lo que marca axe con aria-allowed-attr.
                          // `option` sí existe en el union de RN 0.81 y RNW
                          // mapea `role`/`accessibilityRole` al mismo ariaRole.
                          accessibilityRole="option"
                          // react-native-web 0.21 no implementa
                          // `accessibilityState` (no aparece en su dist): en web
                          // el estado hay que pasarlo con el alias plano
                          // `aria-selected`, que RN 0.81 normaliza al mismo
                          // accessibilityState en nativo (View.js) — o sea que
                          // los dos hacen falta y no se contradicen.
                          accessibilityState={{ selected: isSelected }}
                          aria-selected={isSelected}
                          // Con metadata la fila tiene dos líneas y el check
                          // tiene que ir arriba; sin ella, items-center como en
                          // athlete-picker-modal, que si no deja el check
                          // desalineado del nombre.
                          className={`flex-row gap-2 rounded-xl border px-3 py-2.5 active:opacity-70 ${
                            meta ? 'items-start' : 'items-center'
                          } ${
                            isSelected
                              ? 'border-primary bg-primary/10'
                              : 'border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
                          }`}
                          // key por el id de la opción (no por su slug): el slug
                          // no es inyectivo, dos ids distintos podrían
                          // colisionar y React no avisaría de una key repetida
                          // que sí coincide.
                          key={option.id}
                          nativeID={optionIds}
                          onPress={() => chooseOption(option)}
                          testID={optionIds}
                        >
                          <View className="flex-1" nativeID={`${optionIds}-text`} testID={`${optionIds}-text`}>
                            <Text
                              className="text-sm font-semibold text-slate-900 dark:text-white"
                              nativeID={`${optionIds}-label`}
                              numberOfLines={2}
                              testID={`${optionIds}-label`}
                            >
                              {option.name}
                            </Text>
                            {meta ? (
                              <View className="mt-0.5" nativeID={`${optionIds}-meta`} testID={`${optionIds}-meta`}>
                                {meta}
                              </View>
                            ) : null}
                          </View>
                          {isSelected ? <MaterialCommunityIcons color={colors.primary} name="check-circle" size={18} /> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// El `slugify` de fields.jsx no está exportado y ese archivo no se toca (el
// componente es aditivo), así que se replica la normalización mínima: el id
// de cada opción tiene que ser único y válido como atributo `id` del DOM, que
// es lo que `nativeID` se convierte en react-native-web (CLAUDE.md,
// "Identificadores de componentes"). Un id crudo con espacios o acentos rompe
// los selectores con los que se inspecciona el preview. Es solo para el id:
// la búsqueda de la opción seleccionada nunca pasa por acá.
//
// Ojo: el slug NO es inyectivo ("Club Sur" y "club-sur" colisionan), así que en
// teoría dos nativeID podrían repetirse. Con los ids numéricos de sesión/equipo
///grupo de este dominio no se da, y la alternativa (exportar `slugify` de
// fields.jsx y tocar ese archivo) no compensa el diff. `fields.jsx#slugify`
// tiene la misma propiedad y el repo la acepta.
function optionSlug(id) {
  return (
    String(id ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'opcion'
  );
}
