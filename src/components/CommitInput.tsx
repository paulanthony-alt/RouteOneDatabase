import { useEffect, useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string;
  /** Called on blur or Enter, only if the text changed. */
  onCommit: (value: string) => void;
};

/**
 * Text input that keeps its own draft and saves on blur / Enter, instead of
 * writing to the database on every keystroke.
 */
export default function CommitInput({ value, onCommit, onBlur, onKeyDown, ...rest }: Props) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);

  const commit = () => {
    if (draft !== value) onCommit(draft);
  };

  return (
    <input
      {...rest}
      value={draft}
      onFocus={() => setFocused(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => { setFocused(false); commit(); onBlur?.(e); }}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } onKeyDown?.(e); }}
    />
  );
}
