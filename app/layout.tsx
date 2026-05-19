// Rebuild trigger 2
import './globals.css';
import { Inter, Noto_Sans_Lao } from 'next/font/google';
import { AuthProvider } from '@/components/AuthProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { GroupProvider } from '@/components/GroupProvider';
import LanguageProvider from '@/components/LanguageProvider';
import CurrencyProvider from '@/components/CurrencyProvider';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const notoSansLao = Noto_Sans_Lao({ subsets: ['lao'], variable: '--font-lao' });

export const metadata = {
  title: 'Samard Tracking AI',
  description: 'Invoice and finance management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${notoSansLao.variable}`} suppressHydrationWarning>
      <head>
        <style>{`
          body.lo {
            font-family: var(--font-lao), sans-serif;
          }
        `}</style>
      </head>
      <body className={`font-sans bg-slate-50 dark:bg-[#09090B] text-zinc-900 dark:text-zinc-300 antialiased`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <AuthProvider>
            <GroupProvider>
              <LanguageProvider>
                <CurrencyProvider>
                  <Toaster position="top-center" />
                  <div className="w-full max-w-md md:max-w-4xl mx-auto bg-slate-50 dark:bg-[#09090B] min-h-screen shadow-2xl relative overflow-x-hidden md:border-x border-zinc-200 dark:border-white/5">
                    {children}
                  </div>
                </CurrencyProvider>
              </LanguageProvider>
            </GroupProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
