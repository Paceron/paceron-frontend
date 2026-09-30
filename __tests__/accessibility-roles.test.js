import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DELEGATE = path.join(
  ROOT,
  'node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/uimanager/ReactAccessibilityDelegate.java',
);

// La lista de roles que acepta el delegate nativo de Android. Sale de leer el
// `switch` de `setAccessibilityRole`, que es el que lanza
// `IllegalArgumentException("Invalid accessibility role value: …")` para todo
// valor que no esté en un `case`. Es la lista de TalkBack —el propio archivo lo
// dice en su comentario— y es MUCHO más corta que el union de TypeScript de RN,
// que cierra en `| string` y por eso deja compilar valores que después revientan.
//
// Existe este test por un crash real: `SearchablePickerField` pasaba
// `accessibilityRole="listbox"` y `="option"`, que compilan sin quejarse y
// mataron la app entera al abrir la cascada en Android. Un FATAL EXCEPTION
// nativo, sin pantalla roja, invisible para cualquier gate de JS.
const nativeSwitch = (() => {
  const source = fs.readFileSync(DELEGATE, 'utf8');
  const marker = 'Invalid accessibility role value: " + role';
  const end = source.indexOf(marker);
  if (end === -1) throw new Error('No se encontró el switch de roles en ReactAccessibilityDelegate.java');
  return source.slice(Math.max(0, end - 5000), end);
})();

const ANDROID_ROLES = new Set(
  [...nativeSwitch.matchAll(/\bcase\s+([A-Z_]+)\b/g)].map((match) => match[1].toLowerCase()),
);

const WEB_ONLY_ROLES = ['listbox', 'option', 'gridcell', 'row', 'columnheader', 'rowheader', 'treeitem'];

function collectSourceFiles() {
  const out = [];
  for (const dir of ['components', 'app']) {
    const walk = (current) => {
      if (!fs.existsSync(current)) return;
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(jsx?|tsx?)$/.test(entry.name)) out.push(full);
      }
    };
    walk(path.join(ROOT, dir));
  }
  return out;
}

function collectRoles(file) {
  const source = fs.readFileSync(file, 'utf8');
  return [...source.matchAll(/accessibilityRole="([^"]+)"/g)].map((match) => ({
    role: match[1],
    line: source.slice(0, match.index).split('\n').length,
  }));
}

describe('roles de accesibilidad nativos', () => {
  test('la lista de Android se extrajo bien (sanity del parser)', () => {
    // Si el source de RN cambia de layout y el regex deja de matchear, este test
    // falla en vez de dejar pasar todo en verde con una lista vacía.
    expect(ANDROID_ROLES.size).toBeGreaterThan(30);
    expect(ANDROID_ROLES.has('button')).toBe(true);
    expect(ANDROID_ROLES.has('combobox')).toBe(true);
    expect(ANDROID_ROLES.has('checkbox')).toBe(true);
  });

  test('los roles de web-only están realmente ausentes de Android', () => {
    // El supuesto del que depende el resto: si algún día Android los acepta, la
    // recomendación de pasarlos al prop `role` deja de ser necesaria.
    for (const role of WEB_ONLY_ROLES) {
      expect({ role, accepted: ANDROID_ROLES.has(role) }).toEqual({ role, accepted: false });
    }
  });

  test('ningún accessibilityRole del repo crashea en Android', () => {
    const offenders = [];

    for (const file of collectSourceFiles()) {
      for (const { role, line } of collectRoles(file)) {
        if (ANDROID_ROLES.has(role.toLowerCase())) continue;
        offenders.push(
          `${path.relative(ROOT, file)}:${line} accessibilityRole="${role}" — Android lo rechaza con `
          + 'IllegalArgumentException; si es un rol de web, pasalo con el prop crudo `role`',
        );
      }
    }

    expect(offenders).toEqual([]);
  });
});
