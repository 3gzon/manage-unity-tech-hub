import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Providers } from '@/components/providers';
import './globals.css';

const stolzl = localFont({
  src: [
    { path: '../fonts/stolzl-regular.otf', weight: '400', style: 'normal' },
    { path: '../fonts/stolzl-medium.otf', weight: '500', style: 'normal' },
    { path: '../fonts/stolzl-bold.otf', weight: '700', style: 'normal' },
  ],
  variable: '--font-stolzl',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Unity Tech Hub',
  description: 'Management platform for Unity Tech Hub',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${stolzl.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
