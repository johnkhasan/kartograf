import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { IconChevronDown } from './Icons';
import type { Lang } from '../types';

const LANGS: Array<{ id: Lang; name: string }> = [
  { id: 'uz', name: "O'zbekcha" },
  { id: 'en', name: 'English' },
];

export default function LangMenu() {
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="lang-menu" ref={ref}>
      <button
        className={'lang-trigger' + (open ? ' open' : '')}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Language: ${lang.toUpperCase()}`}
      >
        {lang.toUpperCase()}
        <IconChevronDown size={11} />
      </button>

      {open && (
        <ul className="lang-list" role="listbox">
          {LANGS.map((l) => (
            <li key={l.id}>
              <button
                role="option"
                aria-selected={lang === l.id}
                className={'lang-option' + (lang === l.id ? ' active' : '')}
                onClick={() => {
                  setLang(l.id);
                  setOpen(false);
                }}
              >
                <span className="lang-code">{l.id.toUpperCase()}</span>
                <span className="lang-name">{l.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
