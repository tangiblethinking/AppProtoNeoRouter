import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useEditContext } from './EditableText';

// ============================================================
// EDITABLE IMAGE COMPONENT
// ============================================================
interface EditableImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  editKey: string;
  src: string;
}

export function EditableImage({ editKey, src, style, className, ...rest }: EditableImageProps) {
  const { editable, edits, overrides, onEdit, register } = useEditContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const resolvedSrc = edits[editKey]?.to ?? overrides[editKey] ?? src;
  const effectiveDefault = overrides[editKey] ?? src;

  // Register this image key on mount
  useEffect(() => {
    register(editKey, src);
  }, [editKey, src, register]);

  const openDialog = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setInputValue(resolvedSrc);
    setDialogOpen(true);
  }, [resolvedSrc]);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setInputValue('');
  }, []);

  const handleSave = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed && trimmed !== effectiveDefault) {
      onEdit(editKey, effectiveDefault, trimmed);
    } else if (trimmed === effectiveDefault && edits[editKey]) {
      // Reverted to effective default — remove edit
      onEdit(editKey, effectiveDefault, effectiveDefault);
    }
    closeDialog();
  }, [inputValue, effectiveDefault, editKey, src, onEdit, edits, closeDialog]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeDialog();
    }
  }, [handleSave, closeDialog]);

  // Focus input when dialog opens
  useEffect(() => {
    if (dialogOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [dialogOpen]);

  // Render the dialog via portal so it's fully outside the card DOM
  const dialog = dialogOpen
    ? createPortal(
        <div className="ei-dialog-overlay" onClick={closeDialog}>
          <div className="ei-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ei-dialog-header">
              <span className="material-icons-outlined" style={{ fontSize: 20, color: 'var(--clr-teal)' }}>image</span>
              <span>Change Image URL</span>
              <button className="ei-dialog-close" onClick={closeDialog} type="button">
                <span className="material-icons-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
            <div className="ei-dialog-preview">
              <img src={inputValue || resolvedSrc} alt="Preview" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
            <input
              ref={inputRef}
              type="text"
              className="ei-dialog-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste image URL here..."
              spellCheck={false}
            />
            <div className="ei-dialog-actions">
              <button className="btn btn-text" onClick={closeDialog} type="button">Cancel</button>
              <button className="btn btn-filled" onClick={handleSave} type="button">Save</button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <img
        src={resolvedSrc}
        className={className}
        style={style}
        onContextMenu={!editable ? (e) => e.preventDefault() : undefined}
        {...rest}
      />
      {editable && (
        <button
          className={`ei-pencil ${edits[editKey] ? 'ei-pencil--changed' : ''}`}
          onClick={openDialog}
          title="Change image URL"
          type="button"
        >
          <span className="material-icons-outlined" style={{ fontSize: 16 }}>edit</span>
        </button>
      )}
      {dialog}
    </>
  );
}