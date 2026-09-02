import { useId } from 'react';

interface EditableComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  disabled?: boolean;
  className?: string;
}

/**
 * A dropdown that's also a free-text field: suggestions come from
 * `options` (via native <datalist>), but the user can always type
 * something not on the list and it's accepted as-is — no dead end
 * when an administrative unit has been renamed, split, or just isn't
 * in the data yet. Degrades gracefully to a plain text input when
 * `options` is empty (e.g. Block/Union before the official list lands).
 */
export default function EditableCombobox({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
}: EditableComboboxProps) {
  const listId = useId();

  return (
    <>
      <input
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={className ?? 'w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400'}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}
