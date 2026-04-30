import type { Metadata } from 'next';
import { Manrope, Space_Grotesk } from 'next/font/google';

import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope'
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk'
});

export const metadata: Metadata = {
  title: 'Cais Teams',
  description:
    'Plataforma colaborativa de projetos e reuniões com IA para equipes organizarem decisões, tarefas e execução.'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${manrope.variable} ${spaceGrotesk.variable} font-body text-[#0B2239]`}>
        {children}
      </body>
    </html>
  );
}
