import type { ReactNode } from 'react';
import Brand from './Brand';

/** Full-screen card used for sign-in, setup and error states. */
export default function Gate({ label, title, children }: { label: string; title?: string; children?: ReactNode }) {
  return (
    <div className="gate">
      <div className="stripe" />
      <div className="gate-box">
        <Brand />
        <span className="label">{label}</span>
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  );
}
