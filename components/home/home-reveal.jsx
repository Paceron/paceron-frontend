import { View } from 'react-native';
import {
  Reveal,
  RevealContext,
  RevealProvider,
  resolveRevealStart,
} from '../shared/reveal.jsx';

export const HomeRevealContext = RevealContext;

export { resolveRevealStart };

export function HomeReveal(props) {
  return <Reveal {...props} />;
}

export function HomeRevealProvider({ children, phase, revealKey }) {
  return (
    <RevealProvider phase={phase} revealKey={revealKey}>
      {children}
    </RevealProvider>
  );
}

export function HomeRevealSlot({ children, delay = 0, idPrefix }) {
  return (
    <View className="flex-1 min-w-0" nativeID={`${idPrefix}-slot`} testID={`${idPrefix}-slot`}>
      <HomeReveal delay={delay} idPrefix={idPrefix}>
        {children}
      </HomeReveal>
    </View>
  );
}
