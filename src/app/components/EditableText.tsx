import React, { createContext, useContext, useRef, useEffect, useCallback } from 'react';

// ============================================================
// EDIT CONTEXT
// ============================================================
export interface EditChange {
  from: string;
  to: string;
}

interface EditContextType {
  editable: boolean;
  edits: Record<string, EditChange>;
  overrides: Record<string, string>;
  onEdit: (key: string, originalValue: string, newValue: string) => void;
  register: (key: string, defaultValue: string) => void;
}

export const EditContext = createContext<EditContextType>({
  editable: false,
  edits: {},
  overrides: {},
  onEdit: () => {},
  register: () => {},
});

export function useEditContext() {
  return useContext(EditContext);
}

// ============================================================
// EDITABLE TEXT COMPONENT
// ============================================================
interface EditableTextProps {
  editKey: string;
  value: string;
  className?: string;
  style?: React.CSSProperties;
}

export function EditableText({ editKey, value, className, style }: EditableTextProps) {
  const { editable, edits, overrides, onEdit, register } = useEditContext();
  const ref = useRef<HTMLSpanElement>(null);
  const currentValue = edits[editKey]?.to ?? overrides[editKey] ?? value;
  // The effective default is the override (if any) or the hardcoded value
  const effectiveDefault = overrides[editKey] ?? value;

  // Register this key + default value on mount
  useEffect(() => {
    register(editKey, value);
  }, [editKey, value, register]);

  // Sync text content when value changes externally
  useEffect(() => {
    if (ref.current && !editable) {
      ref.current.textContent = currentValue;
    }
  }, [currentValue, editable]);

  // Set initial content when entering edit mode
  useEffect(() => {
    if (ref.current && editable) {
      ref.current.textContent = currentValue;
    }
  }, [editable]);

  const handleBlur = useCallback(() => {
    const newVal = ref.current?.textContent?.trim() || '';
    if (newVal !== effectiveDefault) {
      onEdit(editKey, value, newVal);
    } else if (newVal === effectiveDefault && edits[editKey]) {
      // Reverted to effective default — remove edit
      onEdit(editKey, value, value);
    }
  }, [editKey, value, effectiveDefault, onEdit, edits]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      ref.current?.blur();
    }
  }, []);

  if (!editable) {
    return <span className={className} style={style}>{currentValue}</span>;
  }

  return (
    <span
      ref={ref}
      className={`editable-text ${edits[editKey] ? 'editable-text--changed' : ''} ${className || ''}`}
      style={style}
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      spellCheck={false}
    />
  );
}

// ============================================================
// EXPORT FULL STATE AS JSON
// ============================================================
export function exportFullState(
  registry: Record<string, string>,
  edits: Record<string, EditChange>,
  overrides: Record<string, string> = {}
): string {
  const state: Record<string, string> = {};
  // Sort keys for readable output
  const keys = Object.keys(registry).sort();
  for (const key of keys) {
    state[key] = edits[key]?.to ?? overrides[key] ?? registry[key];
  }
  return JSON.stringify(state, null, 2);
}
// END OF FILE