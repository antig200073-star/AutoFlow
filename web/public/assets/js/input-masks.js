import { formatPhone, normalizePhone, normalizeEmail, textValue } from './input-rules.js';

const token = char => /[A-Za-z0-9]/.test(char);

// Mantém o cursor junto ao mesmo caractere ao inserir separadores.
export function maskedSelection(value, start, end, format) {
  const formatted = format(value);
  function position(offset) {
    if (offset === value.length) return formatted.length;
    let count = [...value.slice(0, offset)].filter(token).length;
    if (!count) return 0;
    for (let i = 0; i < formatted.length; i++) if (token(formatted[i]) && --count === 0) return i + 1;
    return formatted.length;
  }
  return { value: formatted, start: position(start), end: position(end) };
}

export function maskInput(input, format) {
  const result = maskedSelection(input.value, input.selectionStart ?? input.value.length, input.selectionEnd ?? input.value.length, format);
  input.value = result.value;
  input.setSelectionRange?.(result.start, result.end);
  // React aplica o estado controlado depois do evento.
  globalThis.requestAnimationFrame?.(() => {
    if (input.value === result.value && input.ownerDocument.activeElement === input) input.setSelectionRange?.(result.start, result.end);
  });
  return result.value;
}

export function maskKeyDown(event, format, onValue) {
  const input = event.currentTarget;
  if (event.ctrlKey || event.metaKey || event.altKey || input.selectionStart !== input.selectionEnd) return;
  let start = input.selectionStart, end = start;
  if (event.key === 'Backspace' && start > 0 && !token(input.value[start - 1])) {
    while (start > 0 && !token(input.value[start - 1])) start--;
    if (start > 0) start--;
  } else if (event.key === 'Delete' && end < input.value.length && !token(input.value[end])) {
    while (end < input.value.length && !token(input.value[end])) end++;
    if (end < input.value.length) end++;
  } else return;
  event.preventDefault();
  input.value = input.value.slice(0, start) + input.value.slice(end);
  input.setSelectionRange(start, start);
  onValue(maskInput(input, format));
}

export function bindInput(input, { format, validate, formatOnBlur = false }) {
  const check = () => {
    try { validate?.(input.value); input.setCustomValidity(''); }
    catch (error) { input.setCustomValidity(error.message); }
  };
  input.addEventListener('input', event => {
    if (event.isComposing) return;
    if (format && !formatOnBlur) maskInput(input, format);
    check();
  });
  input.addEventListener('blur', () => {
    if (format) maskInput(input, format);
    check();
  });
  if (format && !formatOnBlur) input.addEventListener('keydown', event => maskKeyDown(event, format, check));
  input.form?.addEventListener('reset', () => input.setCustomValidity(''));
}

export function initInputMasks(root = document) {
  for (const input of root.querySelectorAll('input[type="tel"]')) {
    input.inputMode = 'tel'; input.placeholder = '(11) 91234-5678';
    bindInput(input, { format: formatPhone, validate: normalizePhone });
  }
  for (const input of root.querySelectorAll('input[type="email"]')) {
    input.maxLength = 254; input.autocapitalize = 'none'; input.spellcheck = false;
    bindInput(input, { validate: normalizeEmail });
    input.addEventListener('blur', () => { input.value = input.value.trim().toLowerCase(); });
  }
  for (const input of root.querySelectorAll('input[name="nome"], #profile-name')) {
    input.maxLength = 150; input.minLength = 2;
    bindInput(input, { validate: value => textValue(value, 'Nome', 150, 2) });
  }
  for (const input of root.querySelectorAll('textarea[name="comentario"]')) {
    input.maxLength = 2000;
    bindInput(input, { validate: value => textValue(value, 'Comentário', 2000, 0, true) });
  }
  for (const input of root.querySelectorAll('input[type="search"], #workshop-search')) input.maxLength = 150;
}
