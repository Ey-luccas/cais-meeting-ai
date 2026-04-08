import type { Metadata } from 'next';
import { Manrope, Space_Grotesk } from 'next/font/google';

import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk'
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope'
});

export const metadata: Metadata = {
  title: 'CAIS Meeting AI',
  description: 'Plataforma de reuniões com IA para transcrição, análise e execução operacional.'
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} ${manrope.variable} font-body antialiased`}>
        {children}
      </body>
    </html>
  );
}
