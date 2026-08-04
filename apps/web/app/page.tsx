'use client';
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';
export default function Home() {
  const [theme, setTheme] = useState<Theme>('system');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return (
    <main>
      <header>
        <strong>ORBITA</strong>
        <select
          value={theme}
          onChange={(event) => setTheme(event.target.value as Theme)}
          aria-label="Theme"
        >
          <option value="system">System theme</option>
          <option value="light">Light theme</option>
          <option value="dark">Dark theme</option>
        </select>
      </header>
      <section>
        <p>Foundation is running.</p>
        <h1>India-first AECO workspace</h1>
        <p>
          Web, native mobile, API, role baseline, and configurable themes share one TypeScript
          foundation.
        </p>
      </section>
    </main>
  );
}
