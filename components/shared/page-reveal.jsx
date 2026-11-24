import { Reveal, RevealProvider } from './reveal.jsx';
import { usePageReveal } from '../../hooks/use-page-reveal.js';

export function PageReveal({ children, idPrefix = 'page-reveal' }) {
  const { phase, revealKey } = usePageReveal({ initialPhase: 'load' });

  return (
    <RevealProvider phase={phase} revealKey={revealKey}>
      <Reveal fill idPrefix={idPrefix}>
        {children}
      </Reveal>
    </RevealProvider>
  );
}
