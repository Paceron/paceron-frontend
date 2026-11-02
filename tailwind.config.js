module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}', './routes/**/*.{js,jsx}', './providers/**/*.{js,jsx}', './store/**/*.{js,jsx}', './services/**/*.{js,jsx}', './data/**/*.{js,jsx}', './utils/**/*.{js,jsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#8cc63e',
        ink: '#020617',
        surface: '#0f172a',
        'surface-2': '#1e293b',
        'surface-3': '#334155',
        paper: '#cbd5e1',
        'primary-tint': '#dcec9e',
        'primary-tint-subtle': '#eef3dc',
        'on-primary-tint': '#3c6b12',
      },
      spacing: {
        'container-margin': '1rem',
        gutter: '1rem',
        'section-gap': '1.5rem',
        'card-padding': '1.25rem',
        'drawer-width': '80%',
      },
      // Espejo de Z_INDEX de theme/tokens.js — ese objeto es para estilos en
      // JS, Tailwind no lo lee, así que la escala vive duplicada acá. Tiene que
      // existir como token y no como `z-[70]` arbitrario: las clases
      // arbitrarias dependen de que el escaneo de NativeWind las vea, y su CSS
      // se cachea — un valor nuevo puede no entrar hasta limpiar la caché de
      // Metro, con el tooltip invisible y sin ningún error visible.
      // `tooltip` va arriba de todo porque es la única capa que puede aparecer
      // sobre contenido que ya está en su propia superficie (dentro de un Modal,
      // que es z-50).
      // `toast` está por encima de 9999 a propósito: react-native-web le
      // pone zIndex 9999 hardcodeado al Modal (ModalAnimation.js:79) y el
      // contenedor de react-native-toast-message es `position: absolute` SIN
      // z-index, así que el toast quedaba debajo de cualquier modal abierto.
      // El toast tiene que ganarle porque informa el resultado de una acción
      // que se dispara DENTRO de un modal.
      zIndex: {
        toast: 10000,
        tooltip: 70,
        drawer: 60,
        drawerBackdrop: 55,
        modal: 50,
        dropdown: 40,
        header: 30,
        sidebar: 20,
      },
    },
  },
  plugins: [],
};
