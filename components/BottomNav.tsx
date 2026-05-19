'use client';

import { Home, FileText, Plus, ReceiptText, Wallet, Users, FilePlus, X, BarChart3, History, Settings, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useLanguage } from './LanguageProvider';
import { motion, AnimatePresence } from 'motion/react';

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const { t } = useLanguage();

  const navItems = [
    { href: '/', icon: Home, label: t('home') },
    { href: '/expenses', icon: ReceiptText, label: t('expenseShort') },
    { href: '/income', icon: Wallet, label: t('incomeShort') },
    { href: '/reports', icon: BarChart3, label: t('reports') },
    { href: '/history', icon: History, label: t('history') },
    { href: '/settings', icon: Settings, label: t('settings') },
  ];

  return (
    <>
      <AnimatePresence>
        {showMenu && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-zinc-950/40 dark:bg-black/80 backdrop-blur-[8px] transition-all"
            onClick={() => setShowMenu(false)}
          />
        )}
      </AnimatePresence>
      
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-[70] px-4 pb-4 md:pb-6">
        <div className="relative">
          {/* Main Nav Bar */}
          <motion.div 
             initial={{ y: 20, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             className="bg-white/90 dark:bg-[#141417]/90 backdrop-blur-2xl border border-zinc-200 dark:border-white/5 flex justify-between items-center rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] px-3 py-2"
          >
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
              return (
                <NavItem 
                  key={item.href} 
                  href={item.href} 
                  icon={<item.icon size={20} />} 
                  label={item.label} 
                  active={isActive} 
                />
              )
            })}
            
            <div className="w-px h-8 bg-zinc-200 dark:bg-white/5 mx-1" />
            
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className={`relative z-10 w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-500 overflow-hidden ${showMenu ? 'bg-rose-500 text-white rotate-45 scale-90' : 'bg-zinc-900 dark:bg-white text-white dark:text-black shadow-lg shadow-zinc-950/20 dark:shadow-white/10'}`}
            >
              <Plus size={24} strokeWidth={2.5} />
            </button>
          </motion.div>

          {/* Floating Actions Menu */}
          <AnimatePresence>
            {showMenu && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                className="absolute bottom-[calc(100%+16px)] right-0 flex flex-col gap-3 items-end w-full"
              >
                <div className="flex flex-col gap-3 items-end pr-2">
                  <MenuAction 
                    onClick={() => { 
                      window.location.href = '/invoices?action=new';
                    }} 
                    icon={<FilePlus size={20} />} 
                    label={t('invoice')} 
                    color="text-emerald-500" 
                    bg="bg-emerald-500/10" 
                  />
                  <MenuAction 
                    onClick={() => { 
                      window.location.href = '/expenses?action=new';
                    }} 
                    icon={<ReceiptText size={20} />} 
                    label={t('expense')} 
                    color="text-rose-500" 
                    bg="bg-rose-500/10" 
                  />
                  <MenuAction 
                    onClick={() => { 
                      window.location.href = '/income?action=new';
                    }} 
                    icon={<Wallet size={20} />} 
                    label={t('income')} 
                    color="text-indigo-500" 
                    bg="bg-indigo-500/10" 
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

function MenuAction({ onClick, icon, label, color, bg }: { onClick: () => void; icon: React.ReactNode; label: string; color: string; bg: string }) {
  return (
    <button 
      onClick={onClick} 
      className="flex items-center gap-3 group"
    >
      <span className="text-[11px] font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 dark:bg-zinc-900/80 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-white/5 backdrop-blur-md shadow-sm">{label}</span>
      <div className={`w-12 h-12 rounded-2xl border border-zinc-200 dark:border-white/10 ${bg} ${color} flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-lg bg-white dark:bg-[#1C1C21]`}>
        {icon}
      </div>
    </button>
  );
}

function NavItem({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link 
      href={href} 
      className={`relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 ${active ? 'text-indigo-500' : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:scale-110'}`}
    >
      {active && (
        <motion.div 
          layoutId="activeTab"
          className="absolute inset-0 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-2xl"
          transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
        />
      )}
      <div className="relative z-10 flex flex-col items-center gap-1">
        {icon}
      </div>
    </Link>
  );
}
