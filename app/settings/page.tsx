'use client';

import { ArrowLeft, User, Mail, Moon, Sun, Monitor, LogOut, RefreshCw, ChevronRight, ShieldCheck, Sparkles, Globe, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useTheme } from 'next-themes';
import { useLanguage } from '@/components/LanguageProvider';
import { useCurrency, Currency, ExchangeRates } from '@/components/CurrencyProvider';
import { useEffect, useState } from 'react';
import WorkspaceManager from '@/components/WorkspaceManager';
import { useGroup } from '@/components/GroupProvider';
import { toast } from 'react-hot-toast';
import { Language } from '@/lib/translations';
import { motion } from 'motion/react';
import Dropdown from '@/components/Dropdown';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 260,
      damping: 20
    }
  }
};

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { currency, setCurrency, rates, setRates } = useCurrency();
  const [mounted, setMounted] = useState(false);

  const { activeGroup, updateGroupStartingBalance } = useGroup();
  const [startingBalance, setStartingBalance] = useState('');
  const [startingCurrency, setStartingCurrency] = useState<Currency>(currency || 'USD');
  const [savingBalance, setSavingBalance] = useState(false);

  useEffect(() => {
    if (activeGroup) {
      setStartingBalance(activeGroup.startingBalance?.toString() || '');
      setStartingCurrency((activeGroup.startingBalanceCurrency || currency || 'USD') as Currency);
    }
  }, [activeGroup, currency]);

  const handleSaveStartingBalance = async () => {
    if (!activeGroup) return;
    setSavingBalance(true);
    try {
      const balanceValue = parseFloat(startingBalance) || 0;
      const success = await updateGroupStartingBalance(activeGroup.id, balanceValue, startingCurrency);
      if (success) {
        toast.success(t('startingBalanceSaved' as any) || 'Starting balance saved!');
      } else {
        toast.error('Failed to save starting balance');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred');
    } finally {
      setSavingBalance(false);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleRateChange = (targetCurr: Currency, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      const newRates = { ...rates };
      
      if (targetCurr === 'USD') {
        newRates[currency] = numValue;
      } else {
        newRates[targetCurr] = rates[currency] / numValue;
      }
      
      setRates(newRates);
    }
  };

  const otherCurrencies = (['USD', 'LAK', 'THB'] as Currency[]).filter(c => c !== currency);

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-[#09090B] pb-28">
      {/* Header */}
      <header className="px-5 py-6 space-y-4 bg-white dark:bg-[#0C0C0E] border-b border-zinc-200 dark:border-white/5 relative overflow-hidden">
        <div className="absolute top-[-100px] right-[-100px] w-64 h-64 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex items-center gap-3 relative z-10">
          <Link href="/" className="w-10 h-10 border border-zinc-200 dark:border-white/5 bg-white dark:bg-[#141417] text-zinc-700 dark:text-zinc-300 rounded-2xl flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-white/10 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">{t('settings')}</h1>
        </div>
      </header>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="px-5 py-8 space-y-10"
      >
        {/* Profile Section */}
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="flex items-center gap-2 px-1">
             <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
             <h2 className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">Profile</h2>
          </div>
          
          <div className="bg-white dark:bg-[#0C0C0E] rounded-[32px] border border-zinc-200 dark:border-white/5 overflow-hidden shadow-sm relative group p-6">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <ShieldCheck size={80} className="text-zinc-400" />
            </div>
            
            <div className="flex items-center gap-6 relative z-10">
              {user?.photoURL ? (
                <div className="relative">
                  <img src={user.photoURL} alt="Profile" className="w-20 h-20 rounded-[28px] object-cover border border-zinc-200 dark:border-white/10" referrerPolicy="no-referrer" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-4 border-white dark:border-[#0C0C0E] flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                  </div>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-[28px] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 font-black text-2xl uppercase">
                  {user?.displayName?.charAt(0) || user?.email?.charAt(0) || <User size={32} />}
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <div className="text-xl font-black text-zinc-900 dark:text-white tracking-tight line-clamp-1">{user?.displayName || 'User'}</div>
                <div className="text-sm font-bold text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5 mt-1 truncate">
                  <Mail size={14} strokeWidth={2.5} />
                  {user?.email}
                </div>
              </div>
            </div>
            
            <button 
              onClick={signOut}
              className="mt-6 w-full py-4 bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white dark:text-rose-400 dark:hover:text-white font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all duration-300 flex justify-center items-center gap-2 border border-rose-500/20 shadow-sm"
            >
              <LogOut size={16} strokeWidth={2.5} />
              {t('signOut')}
            </button>
          </div>
        </motion.div>

        {/* Workspaces Section */}
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="flex items-center gap-2 px-1">
             <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
             <h2 className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">{t('workspace')}</h2>
          </div>
          <div className="bg-white dark:bg-[#0C0C0E] rounded-[32px] border border-zinc-200 dark:border-white/5 p-2 shadow-sm">
             <WorkspaceManager />
          </div>
        </motion.div>

        {/* Workspace Starting Balance Section */}
        {activeGroup && (
          <motion.div variants={itemVariants} className="space-y-4">
            <div className="flex items-center gap-2 px-1">
               <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
               <h2 className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">{t('startingBalance') || 'Starting Balance'}</h2>
            </div>
            
            <div className="bg-white dark:bg-[#0C0C0E] rounded-[32px] border border-zinc-200 dark:border-white/5 overflow-hidden shadow-sm p-6 space-y-4 relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-cyan-500"></div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-semibold">
                Set an initial balance for the active workspace (<span className="text-zinc-700 dark:text-zinc-200 font-bold">{activeGroup.name}</span>). This starting balance amount will be calculated into your total profit and income on the main dashboard.
              </p>
              
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="text-[10px] uppercase font-bold text-zinc-400 mb-1 block">Starting Balance Amount</label>
                  <input
                    type="number"
                    value={startingBalance}
                    onChange={(e) => setStartingBalance(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-black/5 dark:bg-black/20 border border-zinc-300 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors font-bold"
                  />
                </div>
                <div className="w-[124px] relative z-25">
                  <label className="text-[10px] uppercase font-bold text-zinc-400 mb-1 block">Currency</label>
                  <Dropdown
                    value={startingCurrency}
                    onChange={(val) => setStartingCurrency(val as Currency)}
                    options={[
                      { label: 'USD ($)', value: 'USD' },
                      { label: 'LAK (₭)', value: 'LAK' },
                      { label: 'THB (฿)', value: 'THB' },
                    ]}
                    buttonClassName="w-full bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveStartingBalance}
                disabled={savingBalance}
                className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-colors flex justify-center items-center shadow-lg shadow-cyan-500/10 cursor-pointer"
              >
                {savingBalance ? t('saving') : t('save')}
              </button>
            </div>
          </motion.div>
        )}

        {/* Preferences Section */}
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="flex items-center gap-2 px-1">
             <div className="w-2 h-2 rounded-full bg-amber-500"></div>
             <h2 className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">Preferences</h2>
          </div>
          
          <div className="bg-white dark:bg-[#0C0C0E] rounded-[32px] border border-zinc-200 dark:border-white/5 shadow-sm">
            {/* Theme Select */}
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl border border-zinc-200 dark:border-white/10 bg-indigo-500/5 flex items-center justify-center text-indigo-500">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <div className="font-black text-[15px] text-zinc-900 dark:text-white tracking-tight uppercase">{t('appearance')}</div>
                    <div className="text-[11px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">{theme === 'dark' ? 'Modern Dark' : 'Clean Light'}</div>
                  </div>
                </div>
              </div>

              {mounted && (
                <div className="grid grid-cols-2 gap-4">
                   {[
                     { mode: 'light', icon: Sun, label: 'Modern Light' },
                     { mode: 'dark', icon: Moon, label: 'Elegant Dark' }
                   ].map((item) => (
                     <button 
                      key={item.mode}
                      onClick={() => setTheme(item.mode)}
                      className={`py-4 rounded-2xl border flex flex-col items-center justify-center gap-3 transition-all duration-300 relative overflow-hidden group ${theme === item.mode ? 'bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-zinc-50 dark:bg-white/5 border-zinc-200 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/10 text-zinc-500'}`}
                     >
                       <item.icon size={22} className={`transition-transform duration-500 ${theme === item.mode ? 'scale-110' : 'group-hover:scale-110'}`} />
                       <span className={`text-[10px] font-black uppercase tracking-widest ${theme === item.mode ? 'text-white' : 'text-zinc-600 dark:text-zinc-400'}`}>{item.label}</span>
                       {theme === item.mode && (
                         <motion.div layoutId="setting-active" className="absolute top-0 right-0 p-2">
                           <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                         </motion.div>
                       )}
                     </button>
                   ))}
                </div>
              )}
            </div>
            
            {/* Language Selection */}
            <div className="border-t border-zinc-100 dark:border-white/5 p-6 flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl border border-zinc-200 dark:border-white/10 bg-emerald-500/5 flex items-center justify-center text-emerald-500 transition-transform group-hover:scale-110 duration-500">
                   <Globe size={20} />
                </div>
                <div>
                  <div className="font-black text-[15px] text-zinc-900 dark:text-white tracking-tight uppercase">{t('language')}</div>
                  <div className="text-[11px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">{language === 'en' ? 'English' : 'ພາສາລາວ'}</div>
                </div>
              </div>
              <div className="relative z-[90]">
                <Dropdown
                  value={language}
                  onChange={(val) => setLanguage(val as Language)}
                  options={[
                    { label: 'English', value: 'en' },
                    { label: 'ພາສາລາວ', value: 'lo' },
                  ]}
                  align="right"
                  buttonClassName="bg-zinc-100 dark:bg-white/5 border-zinc-200 dark:border-white/5 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white min-w-[7rem]"
                  menuClassName="w-32 left-[auto]"
                />
              </div>
            </div>

            {/* Currency Selection */}
            <div className="border-t border-zinc-100 dark:border-white/5 p-6 flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl border border-zinc-200 dark:border-white/10 bg-amber-500/5 flex items-center justify-center text-amber-500 transition-transform group-hover:scale-110 duration-500">
                   <Wallet size={20} />
                </div>
                <div>
                  <div className="font-black text-[15px] text-zinc-900 dark:text-white tracking-tight uppercase">{t('currency')}</div>
                  <div className="text-[11px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">{t('selectCurrency')}</div>
                </div>
              </div>
              <div className="relative z-[80]">
                <Dropdown
                  value={currency}
                  onChange={(val) => setCurrency(val as Currency)}
                  options={[
                    { label: 'USD ($)', value: 'USD' },
                    { label: 'LAK (₭)', value: 'LAK' },
                    { label: 'THB (฿)', value: 'THB' },
                  ]}
                  align="right"
                  buttonClassName="bg-zinc-100 dark:bg-white/5 border-zinc-200 dark:border-white/5 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white min-w-[7rem]"
                  menuClassName="w-32 left-[auto]"
                />
              </div>
            </div>

            {/* Exchange Rates */}
            <div className="border-t border-zinc-100 dark:border-white/5 p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl border border-zinc-200 dark:border-white/10 bg-blue-500/5 flex items-center justify-center text-blue-500">
                   <RefreshCw size={20} />
                </div>
                <div>
                  <div className="font-black text-[15px] text-zinc-900 dark:text-white tracking-tight uppercase">{t('exchangeRates')}</div>
                  <div className="text-[11px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">{t('baseCurrencyDesc')}</div>
                </div>
              </div>
              
              <div className="space-y-3">
                {otherCurrencies.map(other => (
                  <div key={other} className="flex items-center justify-between gap-4 bg-zinc-50 dark:bg-black/20 p-4 rounded-2xl border border-zinc-200 dark:border-white/5">
                    <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">
                      1 {other} = 
                    </span>
                    <div className="flex items-center gap-2">
                       <input 
                        type="number" 
                        value={Number((rates[currency] / rates[other]).toFixed(4))}
                        onChange={(e) => handleRateChange(other, e.target.value)}
                        className="w-32 bg-white dark:bg-[#0C0C0E] border border-zinc-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm font-black text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                      />
                      <span className="text-xs font-black text-zinc-900 dark:text-white">{currency}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Categories Management */}
            <Link href="/categories" className="border-t border-zinc-100 dark:border-white/5 p-6 flex items-center justify-between group hover:bg-zinc-50 dark:hover:bg-white/5 transition-all rounded-b-[32px]">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl border border-zinc-200 dark:border-white/10 bg-orange-500/5 flex items-center justify-center text-orange-500 group-hover:rotate-[30deg] transition-transform duration-500">
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                </div>
                <div>
                  <div className="font-black text-[15px] text-zinc-900 dark:text-white tracking-tight uppercase">{t('categories')}</div>
                  <div className="text-[11px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">{t('manageCategories')}</div>
                </div>
              </div>
              <ChevronRight size={20} className="text-zinc-300 group-hover:translate-x-1 transition-transform" strokeWidth={3} />
            </Link>

          </div>
        </motion.div>
      </motion.div>
    </main>
  );
}
