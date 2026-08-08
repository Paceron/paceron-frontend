import { useEffect, useRef, useState } from 'react';
import { searchUsers } from '../services/user.js';

// Estado + búsqueda debounced para el autocompletar de EmailInviteForm
// (GET /users/search?q=, mínimo 3 caracteres, hasta 5 resultados). Vive
// en el screen dueño (no en EmailInviteForm) porque el panel de
// sugerencias se renderiza vía AnimatedDropdown montado en la raíz de
// la pantalla — no puede ser hijo de EmailInviteForm (React Native Web
// pone `position: relative` por default en TODOS los Views, así que un
// panel absoluto anidado ahí adentro nunca logra escapar visualmente de
// esa card, ver components/team/team-detail-screen.jsx#RunnerMenu para
// el mismo problema ya resuelto antes). `containerRef` es el View raíz
// de la pantalla (el mismo que usa el AnimatedDropdown para anclarse).
//
// Se probó primero con un Modal propio dentro de EmailInviteForm — mal
// llamado acá: Modal está pensado para tomar el foco (por eso funciona
// bien en el picker de InlinePicker, donde no hace falta seguir
// tipeando), y como este input necesita seguir enfocado mientras se
// escribe, terminaba en un ciclo de foco/blur (flicker, backspace que
// no registraba). AnimatedDropdown es un View posicionado común, sin
// manejo de foco — no tiene ese problema.
export function useEmailSuggestions(containerRef) {
  const [draft, setDraft] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const inputWrapperRef = useRef(null);

  useEffect(() => {
    const query = draft.trim();
    if (query.length < 3 || query === selectedEmail) {
      setSuggestions([]);
      setShowSuggestions(false);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const results = await searchUsers(query);
        if (cancelled) return;
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        if (!cancelled) { setSuggestions([]); setShowSuggestions(false); }
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [draft, selectedEmail]);

  useEffect(() => {
    if (!showSuggestions || !inputWrapperRef.current || !containerRef?.current) return;
    inputWrapperRef.current.measureLayout(containerRef.current, (x, y, width, height) => {
      setAnchor({ x, y, width, height });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSuggestions]);

  const handleChange = (text) => {
    setDraft(text);
    setSelectedEmail(null);
  };

  const handleFocus = () => {
    if (suggestions.length > 0) setShowSuggestions(true);
  };

  const selectSuggestion = (suggestion) => {
    setDraft(suggestion.email);
    setSelectedEmail(suggestion.email);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const close = () => setShowSuggestions(false);

  const resetDraft = () => {
    setDraft('');
    setSelectedEmail(null);
  };

  return {
    draft,
    suggestions,
    showSuggestions,
    anchor,
    inputWrapperRef,
    handleChange,
    handleFocus,
    selectSuggestion,
    close,
    resetDraft,
  };
}
