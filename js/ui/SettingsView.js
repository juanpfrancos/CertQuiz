// Settings + danger zone.
import { h } from './dom.js';

/** m: {settings}; a: {saveSettings(patch), clearHistory(), resetApp()} */
export function renderSettings({ settings }, a) {
  const themeOpt = (value, label) => h('label', { class: 'seg__opt' },
    h('input', { type: 'radio', name: 'theme', value, checked: settings.theme === value, class: 'sr-only', testid: `theme-toggle-${value}`,
      onchange: () => a.saveSettings({ theme: value }) }),
    h('span', { text: label }));

  return h('div', { class: 'page settings' },
    h('header', { class: 'page__head' },
      h('p', { class: 'eyebrow', text: 'Preferencias' }),
      h('h1', { class: 'page__title', tabindex: '-1', text: 'Ajustes' })),
    h('section', { class: 'card stack', 'aria-labelledby': 'pref-title' },
      h('h2', { id: 'pref-title', class: 'card__title', text: 'General' }),
      h('fieldset', { class: 'field' },
        h('legend', { class: 'field__label', text: 'Tema' }),
        h('div', { class: 'seg seg--radio' }, themeOpt('system', 'Sistema'), themeOpt('light', 'Claro'), themeOpt('dark', 'Oscuro'))),
      h('div', { class: 'field field--inline' },
        h('label', { htmlFor: 'set-count', class: 'field__label', text: 'Cantidad de preguntas por defecto' }),
        h('input', { type: 'number', id: 'set-count', min: '1', max: '1000', value: String(settings.defaultCount), testid: 'settings-default-count',
          onchange: (e) => { const v = Math.max(1, Math.floor(Number(e.target.value) || 50)); e.target.value = String(v); a.saveSettings({ defaultCount: v }); } })),
      h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: settings.showTimer, testid: 'settings-show-timer', onchange: (e) => a.saveSettings({ showTimer: e.target.checked }) }),
        h('span', { text: 'Mostrar temporizador durante el test' })),
      h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: settings.shuffleOptions, testid: 'settings-shuffle-default', onchange: (e) => a.saveSettings({ shuffleOptions: e.target.checked }) }),
        h('span', { text: 'Orden aleatorio de opciones por defecto' })),
      h('div', { class: 'field field--inline' },
        h('label', { htmlFor: 'set-threshold', class: 'field__label', text: 'Aciertos consecutivos para salir de «falladas»' }),
        h('select', { id: 'set-threshold', testid: 'settings-exit-threshold', onchange: (e) => a.saveSettings({ exitThreshold: Number(e.target.value) }) },
          h('option', { value: '1', text: '1', selected: Number(settings.exitThreshold) === 1 }),
          h('option', { value: '2', text: '2', selected: Number(settings.exitThreshold) === 2 })))),
    h('section', { class: 'card danger', 'aria-labelledby': 'danger-title', testid: 'danger-zone' },
      h('h2', { id: 'danger-title', class: 'card__title', text: '⚠ Peligro' }),
      h('div', { class: 'danger__row' },
        h('div', {}, h('strong', { text: 'Borrar solo historial' }),
          h('p', { class: 'muted small', text: 'Elimina intentos, estadísticas y el test en curso. Conserva ajustes, bancos subidos y favoritas.' })),
        h('button', { type: 'button', class: 'btn btn--ghost btn--danger-outline', testid: 'danger-clear-history-btn', text: 'Borrar historial', onclick: a.clearHistory })),
      h('div', { class: 'danger__row' },
        h('div', {}, h('strong', { text: 'Restablecer aplicación' }),
          h('p', { class: 'muted small', text: 'Borra todos los datos locales, cachés y el service worker. Exporta tu progreso antes si quieres conservarlo.' })),
        h('button', { type: 'button', class: 'btn btn--danger', testid: 'danger-zone-reset-btn', text: 'Restablecer aplicación', onclick: a.resetApp }))));
}
