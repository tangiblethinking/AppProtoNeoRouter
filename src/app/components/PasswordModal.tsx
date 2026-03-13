import React, { useState, useRef, useEffect } from 'react';

interface PasswordModalProps {
  open: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

const WRONG_GIF = 'https://media.tenor.com/tVAgNJ6-mVAAAAAM/you-didn%27t-say-the-magic-word-jurassic-park.gif';
const PASSWORD = 'hi';

export function PasswordModal({ open, onSuccess, onClose }: PasswordModalProps) {
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue('');
      setWrong(false);
      setShake(false);
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value === PASSWORD) {
      onSuccess();
    } else {
      setWrong(true);
      setShake(true);
      setValue('');
      setTimeout(() => setShake(false), 500);
    }
  };

  if (!open) return null;

  return (
    <div className="pw-modal-scrim" onClick={onClose}>
      <div
        className={`pw-modal${shake ? ' pw-shake' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="pw-modal-close" onClick={onClose} aria-label="Close">
          <span className="material-icons">close</span>
        </button>

        <div className="pw-modal-icon">
          <span className="material-icons-outlined">lock</span>
        </div>

        {wrong && (
          <div className="pw-modal-gif">
            <img src={WRONG_GIF} alt="You didn't say the magic word" />
          </div>
        )}

        <h3 className="pw-modal-title">Enter Password</h3>
        <p className="pw-modal-subtitle">Authentication required to enable edit mode.</p>

        <form onSubmit={handleSubmit} className="pw-modal-form">
          <div className={`text-field-container no-icon${wrong ? ' pw-error' : ''}`}>
            <input
              ref={inputRef}
              type="password"
              className="text-field-input"
              placeholder="Password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoComplete="off"
            />
          </div>
          {wrong && (
            <span className="pw-modal-error-text">Incorrect password. Try again.</span>
          )}
          <button type="submit" className="pw-modal-submit">
            <span className="material-icons" style={{ fontSize: 18 }}>login</span>
            Authenticate
          </button>
        </form>
      </div>
    </div>
  );
}
