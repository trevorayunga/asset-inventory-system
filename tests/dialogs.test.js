/** @jest-environment jsdom */
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import {
  confirmDialog, openModal, readFormValues, setFormError, setSaving, showFieldErrors,
} from '../js/dialogs.js';
import { polyfillDialog } from './helpers/mockApi.js';

beforeEach(() => polyfillDialog());
afterEach(() => { document.body.innerHTML = ''; });

const content = (html = '<p>Body</p>') => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
};

describe('openModal', () => {
  test('builds an accessible dialog with a title, optional subtitle and close button', () => {
    openModal({ title: 'Edit <item>', subtitle: 'Dell · LAP-001', content: content() });
    const dialog = document.querySelector('dialog');
    expect(dialog.getAttribute('aria-labelledby')).toBe('modal-title');
    expect(dialog.querySelector('h2').textContent).toBe('Edit <item>');
    expect(dialog.querySelector('h2 b, h2 item')).toBeNull();
    expect(dialog.querySelector('.muted').textContent).toBe('Dell · LAP-001');
    expect(dialog.querySelector('[data-close]').getAttribute('aria-label')).toBe('Close dialog');
    expect(dialog.open).toBe(true);
  });
  test('without a subtitle there is no subtitle line', () => {
    openModal({ title: 'T', content: content() });
    expect(document.querySelector('dialog .muted')).toBeNull();
  });
  test('closing removes the dialog, returns focus to the opener and runs onClose', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const onClose = jest.fn();
    openModal({ title: 'T', content: content(), onClose });
    document.querySelector('[data-close]').click();
    expect(document.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  test('a click on the backdrop closes it, a click inside does not', () => {
    openModal({ title: 'T', content: content() });
    const dialog = document.querySelector('dialog');
    dialog.querySelector('p').click();
    expect(document.querySelector('dialog')).not.toBeNull();
    dialog.click();
    expect(document.querySelector('dialog')).toBeNull();
  });
});

describe('confirmDialog', () => {
  test('resolves true when confirmed', async () => {
    const result = confirmDialog({ title: 'Delete', message: 'Sure <b>?</b>', confirmLabel: 'Delete item' });
    const dialog = document.querySelector('dialog');
    expect(dialog.querySelector('.modal-text').textContent).toBe('Sure <b>?</b>');
    expect(dialog.querySelector('[data-confirm]').textContent).toBe('Delete item');
    dialog.querySelector('[data-confirm]').click();
    expect(await result).toBe(true);
  });
  test('resolves false on Cancel, the close button and the backdrop; Cancel is focused first', async () => {
    for (const close of [
      (d) => d.querySelector('[data-cancel]').click(),
      (d) => d.querySelector('[data-close]').click(),
      (d) => d.click(),
    ]) {
      const result = confirmDialog({ title: 'T', message: 'M' });
      const dialog = document.querySelector('dialog');
      expect(dialog.querySelector('[data-cancel]').hasAttribute('autofocus')).toBe(true);
      close(dialog);
      expect(await result).toBe(false);
    }
  });
});

describe('form helpers', () => {
  const build = () => {
    const form = document.createElement('form');
    form.innerHTML = `
      <p data-form-error hidden></p>
      <div data-field="name"><input name="name" value="Dell"><p class="field-error" hidden></p></div>
      <div data-field="kind"><select name="kind"><option value="a">A</option><option value="b" selected>B</option></select><p class="field-error" hidden></p></div>
      <button type="submit" data-label="Save">Save</button>`;
    return form;
  };
  test('readFormValues reads every named control, including selected options', () => {
    expect(readFormValues(build())).toEqual({ name: 'Dell', kind: 'b' });
  });
  test('showFieldErrors shows an escaped message and flags the input; empty errors clear them', () => {
    const form = build();
    showFieldErrors(form, { name: 'Bad <name>' });
    const message = form.querySelector('[data-field="name"] .field-error');
    expect(message.hidden).toBe(false);
    expect(message.textContent).toContain('Bad <name>');
    expect(message.querySelector('name')).toBeNull();
    expect(form.querySelector('[name="name"]').getAttribute('aria-invalid')).toBe('true');
    expect(form.querySelector('[name="kind"]').hasAttribute('aria-invalid')).toBe(false);
    showFieldErrors(form, {});
    expect(message.hidden).toBe(true);
    expect(form.querySelector('[name="name"]').hasAttribute('aria-invalid')).toBe(false);
  });
  test('setFormError shows or hides the banner', () => {
    const form = build();
    setFormError(form, 'Could not save');
    const box = form.querySelector('[data-form-error]');
    expect(box.hidden).toBe(false);
    expect(box.textContent).toBe('Could not save');
    setFormError(form, '');
    expect(box.hidden).toBe(true);
  });
  test('setSaving disables the button and restores its label', () => {
    const form = build();
    const button = form.querySelector('[type="submit"]');
    setSaving(form, true);
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe('Saving…');
    setSaving(form, false);
    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe('Save');
  });
});
