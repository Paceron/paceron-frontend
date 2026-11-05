import { useEffect, useRef, useState } from 'react';
import { isWeb } from '../utils/platform.js';

// Pensado desde el día uno para reusarse en un futuro mecanismo de
// onboarding (pedido explícito, no es exclusivo de competencias) -- por eso
// vive en hooks/ y no adentro de components/team/competitions-tab.jsx.
//
// `measureInWindow`, nunca `measureLayout`, para el camino nativo -- ver
// CLAUDE.md "Quirks conocidos": measureLayout puede fallar en silencio bajo
// New Architecture/Fabric cuando se mide contra un ancestro lejano a través
// de un ScrollView, exactamente el caso de uso de este hook.
export function useScrollToHighlight(targetId, scrollViewRef) {
  const [highlightedId, setHighlightedId] = useState(null);
  const rowRefs = useRef({});

  const registerRow = (id) => (el) => {
    rowRefs.current[id] = el;
  };

  useEffect(() => {
    if (!targetId) return;
    const node = rowRefs.current[targetId];
    if (!node) return;

    if (isWeb) {
      node.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    } else if (scrollViewRef?.current) {
      node.measureInWindow((x, winY) => {
        scrollViewRef.current.measureInWindow((sx, scrollWinY) => {
          scrollViewRef.current.scrollTo({ y: winY - scrollWinY - 80, animated: true });
        });
      });
    }

    setHighlightedId(targetId);
    const timer = setTimeout(() => setHighlightedId(null), 4000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia targetId, no en cada re-render por otros motivos
  }, [targetId]);

  return { registerRow, highlightedId };
}
