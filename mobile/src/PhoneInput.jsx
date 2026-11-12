import { useEffect, useRef } from 'react';
import { formatPhone, normalizePhone } from '../../web/public/assets/js/input-rules.js';
import { maskInput, maskKeyDown } from '../../web/public/assets/js/input-masks.js';

const validate = input => {
  try { normalizePhone(input.value); input.setCustomValidity(''); }
  catch (error) { input.setCustomValidity(error.message); }
};

export default function PhoneInput({ value, onValueChange, ...props }) {
  const field = useRef(null);
  useEffect(() => { if (field.current) validate(field.current); }, [value]);
  return <input {...props} ref={field} type="tel" inputMode="tel" placeholder="(11) 91234-5678"
    value={formatPhone(value)}
    onChange={event => {
      if (event.nativeEvent.isComposing) { onValueChange(event.target.value); return; }
      const formatted = maskInput(event.currentTarget, formatPhone);
      validate(event.currentTarget); onValueChange(formatted);
    }}
    onKeyDown={event => maskKeyDown(event, formatPhone, formatted => {
      validate(event.currentTarget); onValueChange(formatted);
    })}
    onBlur={event => validate(event.currentTarget)} />;
}
