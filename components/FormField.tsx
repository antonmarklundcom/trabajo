'use client';

// The label + control + error wrapper the three public forms share
// (EmployerForm, LeadForm, ContactForm). Each used to carry its own copy with
// a bare <label> and no id on the control, so a screen reader announced every
// field unlabelled, tapping the label text did not focus the input, and the
// validation message was not tied to the field it described.
//
// The control is the first <input>, <select> or <textarea> among the children;
// it gets the generated id plus aria-invalid / aria-describedby / aria-required.
// Anything else passed alongside it (the description's character counter) is
// rendered untouched.
import { Children, cloneElement, isValidElement, useId, type ReactNode } from 'react';

type ControlProps = {
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  'aria-required'?: boolean;
};

const CONTROL_TAGS = new Set(['input', 'select', 'textarea']);

export default function FormField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const items = Children.toArray(children);
  const controlIndex = items.findIndex(
    (child) =>
      isValidElement(child) && typeof child.type === 'string' && CONTROL_TAGS.has(child.type),
  );

  const content = items.map((child, index) => {
    if (index !== controlIndex || !isValidElement<ControlProps>(child)) return child;
    return cloneElement(child, {
      id,
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error ? errorId : undefined,
      'aria-required': required ? true : undefined,
    });
  });

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink mb-1.5">
        {label}
        {required && (
          <span className="text-error ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {content}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
}
