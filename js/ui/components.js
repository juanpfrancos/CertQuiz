// Toasts and modal dialogs (native <dialog>: focus containment + Esc to close).
import { h } from './dom.js';

let toastRegion;

export function toast(message, { type = 'info', duration = 4500, action } = {}) {
  toastRegion ||= document.getElementById('toasts');
  const icon = { success: '✔', error: '✘', warning: '⚠', info: 'ℹ' }[type] || 'ℹ';
  const el = h('div', { class: `toast toast--${type}`, role: type === 'error' ? 'alert' : 'status', testid: 'toast' },
    h('span', { class: 'toast__icon', 'aria-hidden': 'true', text: icon }),
    h('span', { class: 'toast__msg', text: message }),
    action && h('button', { class: 'btn btn--sm btn--ghost', type: 'button', text: action.label, onclick: () => { action.onClick(); dismiss(); } }),
    h('button', { class: 'toast__close', type: 'button', 'aria-label': 'Cerrar aviso', text: '×', onclick: () => dismiss() }));
  toastRegion.append(el);
  let timer = duration ? setTimeout(dismiss, duration) : null;
  function dismiss() {
    clearTimeout(timer);
    timer = null;
    el.classList.add('toast--out');
    setTimeout(() => el.remove(), 180);
  }
  return dismiss;
}

export const isModalOpen = () => Boolean(document.querySelector('dialog[open]'));

/**
 * actions: [{label, variant, testid, onClick(close) -> false keeps it open, disabled}]
 */
export function openModal({ title, body, actions = [], testid = 'modal', onClose, wide = false }) {
  const previous = document.activeElement;
  const titleId = `dlg-${Math.random().toString(36).slice(2, 8)}`;
  const buttons = actions.map((a) => h('button', {
    type: 'button', class: `btn ${a.variant ? `btn--${a.variant}` : ''}`, testid: a.testid, text: a.label, disabled: a.disabled,
    onclick: async () => {
      const keep = a.onClick ? await a.onClick(close) : undefined;
      if (keep !== false) close();
    },
  }));
  const dialog = h('dialog', { class: `modal ${wide ? 'modal--wide' : ''}`, 'aria-labelledby': titleId, testid },
    h('div', { class: 'modal__head' },
      h('h2', { id: titleId, class: 'modal__title', text: title }),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Cerrar', testid: `${testid}-close`, text: '×', onclick: () => close() })),
    h('div', { class: 'modal__body' }, typeof body === 'string' ? h('p', { text: body }) : body),
    buttons.length ? h('div', { class: 'modal__actions' }, buttons) : null);
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    if (dialog.open) dialog.close();
    dialog.remove();
    onClose?.();
    if (previous && document.contains(previous)) previous.focus();
  }
  dialog.addEventListener('close', close);
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  document.body.append(dialog);
  dialog.showModal();
  (buttons.find((b) => !b.disabled) || dialog.querySelector('button'))?.focus();
  return { close, dialog, buttons };
}

export function confirmDialog({ title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = false, testid = 'confirm-modal' }) {
  return new Promise((resolve) => {
    let result = false;
    openModal({
      title, body: message, testid,
      onClose: () => resolve(result),
      actions: [
        { label: cancelLabel, variant: 'ghost', testid: `${testid}-cancel` },
        { label: confirmLabel, variant: danger ? 'danger' : 'primary', testid: `${testid}-confirm`, onClick: () => { result = true; } },
      ],
    });
  });
}
