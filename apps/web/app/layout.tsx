import type { Metadata } from 'next';
import './styles.css';

export const metadata: Metadata = { title: 'Orbita', description: 'AECO operating workspace' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
