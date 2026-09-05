// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");
const globals = require('globals');

// Elementos visuales que deben llevar nativeID + testID (ver CLAUDE.md,
// sección "Identificadores de componentes"). nativeID es el que aporta
// valor hoy (id real del DOM en web, útil para debugging/preview);
// testID queda preparado para cuando existan tests de render.
const REQUIRES_IDS = new Set([
  'View',
  'Text',
  'Pressable',
  'TextInput',
  'Image',
  'ScrollView',
  'TouchableOpacity',
  'TouchableWithoutFeedback',
  'TouchableHighlight',
  'FlatList',
  'SectionList',
  'Modal',
  'SafeAreaView',
]);

function elementName(node) {
  if (node.name.type === 'JSXIdentifier') return node.name.name;
  if (node.name.type === 'JSXMemberExpression') {
    // Animated.View, Animated.Text, etc. — solo nos interesa la parte final.
    return node.name.property.name;
  }
  return null;
}

const requireNativeIdRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Requires nativeID and testID on visual RN components (View, Text, Pressable, etc.)',
    },
    schema: [],
    messages: {
      missing: '{{name}} debe tener {{attrs}} (ver CLAUDE.md, "Identificadores de componentes").',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const name = elementName(node);
        if (!name || !REQUIRES_IDS.has(name)) return;

        // Si hay spread ({...props}), asumimos que los ids pueden venir
        // por ahí — no forzamos los atributos explícitos en ese caso.
        const hasSpread = node.attributes.some((attr) => attr.type === 'JSXSpreadAttribute');
        if (hasSpread) return;

        const attrNames = new Set(
          node.attributes
            .filter((attr) => attr.type === 'JSXAttribute')
            .map((attr) => attr.name.name)
        );

        const missing = [];
        if (!attrNames.has('nativeID')) missing.push('nativeID');
        if (!attrNames.has('testID')) missing.push('testID');

        if (missing.length > 0) {
          context.report({ node, messageId: 'missing', data: { name, attrs: missing.join(' y ') } });
        }
      },
    };
  },
};

// SelectField (web, <select> nativo) y PickerField (mobile, modal) nunca
// deben importarse directo fuera de fields.jsx/responsive-select-field.jsx
// — el ternario `isWeb ? <SelectField/> : <PickerField/>` a mano es
// exactamente la duplicación que ResponsiveSelectField (components/forms/
// responsive-select-field.jsx) existe para evitar, y quedarse con uno solo
// de los dos (sin ternario) rompe el comportamiento correcto en la otra
// plataforma. Ver CLAUDE.md.
const SELECT_GUARD_EXEMPT_FILES = ['forms/fields.jsx', 'forms/responsive-select-field.jsx'];

const noDirectSelectFieldRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Forbids importing SelectField/PickerField directly outside forms/fields.jsx and responsive-select-field.jsx',
    },
    schema: [],
    messages: {
      useResponsive: 'Importar {{name}} directo está prohibido acá — usá ResponsiveSelectField (components/forms/responsive-select-field.jsx) para que resuelva bien por plataforma.',
    },
  },
  create(context) {
    const filename = (context.filename ?? context.getFilename()).replace(/\\/g, '/');
    if (SELECT_GUARD_EXEMPT_FILES.some((f) => filename.endsWith(f))) return {};

    return {
      ImportDeclaration(node) {
        if (!/forms\/fields(\.jsx?)?$/.test(node.source.value)) return;
        for (const spec of node.specifiers) {
          if (spec.type === 'ImportSpecifier' && (spec.imported.name === 'SelectField' || spec.imported.name === 'PickerField')) {
            context.report({ node: spec, messageId: 'useResponsive', data: { name: spec.imported.name } });
          }
        }
      },
    };
  },
};

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    plugins: {
      local: { rules: { 'require-native-id': requireNativeIdRule, 'no-direct-select-field': noDirectSelectFieldRule } },
    },
    rules: {
      'local/require-native-id': 'error',
      'local/no-direct-select-field': 'error',
    },
  },
  {
    files: ['__tests__/**/*.js', '**/__mocks__/**/*.js'],
    languageOptions: {
      globals: { ...globals.jest, ...globals.node },
    },
  },
]);
