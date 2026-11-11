import { defaultHtmlPreset, setPluginConfig } from '@_sh/strapi-plugin-ckeditor';

// Story editor toolbar: a "Code" button first, so pasting a story's HTML is
// one click (Code → paste → Code again to see it). It's CKEditor's Source
// view, renamed. The rest of the toolbar is the plugin's default HTML preset.
// Must run in the admin's register step (before bootstrap).
export function configureEditor() {
  const base = defaultHtmlPreset.editorConfig as any;
  const rest = (base.toolbar as any[]).filter((i) => String(i).toLowerCase() !== 'sourceediting');
  setPluginConfig({
    presets: [
      {
        ...defaultHtmlPreset,
        editorConfig: {
          ...base,
          toolbar: { items: ['sourceEditing', '|', ...rest], shouldNotGroupWhenFull: false },
          translations: [...(base.translations ?? []), { en: { dictionary: { Source: 'Code' } } }],
        },
      },
    ],
  });
}
