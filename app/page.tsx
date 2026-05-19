'use client';

import { Menu, Bell, TrendingUp, TrendingDown, FileText, FilePlus, ReceiptText, Wallet, Users, Package, BarChart2, Clock, MoreHorizontal, LogOut, Loader2, Eye, LayoutGrid, Bookmark, Sparkles, Kanban } from 'lucide-react';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/components/AuthProvider';
import { useGroup } from '@/components/GroupProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { useCurrency } from '@/components/CurrencyProvider';
import { useEffect, useState, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import ThemeToggle from '@/components/ThemeToggle';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { motion } from 'motion/react';
import Dropdown from '@/components/Dropdown';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#0ea5e9', '#d946ef', '#f43f5e', '#8b5cf6', '#64748b'];

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
      stiffness: 300,
      damping: 24
    }
  }
};

export default function Dashboard() {
  const { user, loading, signIn, signOut } = useAuth();
  const { language, t } = useLanguage();
  const { currency, setCurrency, formatAmount, convertAmount, rates } = useCurrency();
  const { activeGroupId } = useGroup();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [stats, setStats] = useState({ income: 0, expenses: 0, profit: 0, invoicesCount: 0 });
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [incomeCategoryData, setIncomeCategoryData] = useState<any[]>([]);
  const [categoryType, setCategoryType] = useState<'income' | 'expenses'>('expenses');

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t('goodMorning');
    if (hour < 18) return t('goodAfternoon');
    return t('goodEvening');
  }, [t]);

  useEffect(() => {
    if (user) {
      fetchDaData();
    }
  }, [user, activeGroupId, currency, rates]);

  const fetchDaData = async () => {
    try {
      if (!user) return;
      const groupIdToUse = activeGroupId || user.uid;

      const invoicesQuery = query(
        collection(db, 'invoices'),
        where('groupId', '==', groupIdToUse),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      let invoicesSnapshot;
      try {
        invoicesSnapshot = await getDocs(invoicesQuery);
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'invoices');
        return;
      }
      const invoicesList = invoicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInvoices(invoicesList);

      let totalIncome = 0;
      let totalExpenses = 0;
      
      const rawIncomes: any[] = [];
      const rawExpenses: any[] = [];

      const incomeQuery = query(collection(db, 'incomes'), where('groupId', '==', groupIdToUse));
      let incomeSnapshot;
      try {
        incomeSnapshot = await getDocs(incomeQuery);
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'incomes');
        return;
      }
      incomeSnapshot.forEach(doc => { 
        const data = doc.data();
        const amount = data.amount || 0;
        const recordCurrency = data.currency || 'USD';
        const convertedAmount = convertAmount(amount, recordCurrency, currency);
        totalIncome += convertedAmount; 
        rawIncomes.push({ ...data, amount: convertedAmount });
      });

      const expenseQuery = query(collection(db, 'expenses'), where('groupId', '==', groupIdToUse));
      let expenseSnapshot;
      try {
        expenseSnapshot = await getDocs(expenseQuery);
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'expenses');
        return;
      }
      expenseSnapshot.forEach(doc => { 
        const data = doc.data();
        const amount = data.amount || 0;
        const recordCurrency = data.currency || 'USD';
        const convertedAmount = convertAmount(amount, recordCurrency, currency);
        totalExpenses += convertedAmount; 
        rawExpenses.push({ ...data, amount: convertedAmount });
      });

      setStats({
        income: totalIncome,
        expenses: totalExpenses,
        profit: totalIncome - totalExpenses,
        invoicesCount: invoicesSnapshot.size
      });

      // Calculate Monthly Data
      const monthMap: Record<string, { name: string, income: number, expenses: number }> = {};
      
      // Initialize last 6 months
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthYear = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        monthMap[monthYear] = { name: monthYear, income: 0, expenses: 0 };
      }

      rawIncomes.forEach(inc => {
        if (inc.date) {
          const d = new Date(inc.date);
          const monthYear = d.toLocaleString('default', { month: 'short', year: '2-digit' });
          if (monthMap[monthYear]) {
            monthMap[monthYear].income += inc.amount || 0;
          }
        }
      });
      
      rawExpenses.forEach(exp => {
        if (exp.date) {
          const d = new Date(exp.date);
          const monthYear = d.toLocaleString('default', { month: 'short', year: '2-digit' });
          if (monthMap[monthYear]) {
            monthMap[monthYear].expenses += exp.amount || 0;
          }
        }
      });

      setMonthlyData(Object.values(monthMap));

      // Calculate Expense Category Data
      const expCatMap: Record<string, number> = {};
      rawExpenses.forEach(exp => {
        const cat = exp.category || 'Other';
        expCatMap[cat] = (expCatMap[cat] || 0) + (exp.amount || 0);
      });
      
      const expCatArray = Object.keys(expCatMap).map(key => ({
        name: key,
        value: expCatMap[key]
      })).sort((a, b) => b.value - a.value);
      
      setCategoryData(expCatArray);

      // Calculate Income Category Data
      const incCatMap: Record<string, number> = {};
      rawIncomes.forEach(inc => {
        const cat = inc.category || 'Other';
        incCatMap[cat] = (incCatMap[cat] || 0) + (inc.amount || 0);
      });
      
      const incCatArray = Object.keys(incCatMap).map(key => ({
        name: key,
        value: incCatMap[key]
      })).sort((a, b) => b.value - a.value);
      
      setIncomeCategoryData(incCatArray);

    } catch (e) {
      console.error("Dashboard data fetch error", e);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-[#09090B] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-[#09090B] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-6">
          <Wallet size={32} className="text-indigo-500" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2 tracking-tight">{t('appName')}</h1>
        <p className="text-zinc-600 dark:text-zinc-400 mb-8 mx-4">{t('appTagline')}</p>
        <button
          onClick={signIn}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3.5 px-8 rounded-full transition-colors flex items-center gap-2"
        >
          {t('signInWithGoogle')}
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-[#09090B] pb-28">
      {/* Header */}
      <header className="px-5 py-6 space-y-4 bg-white dark:bg-[#0C0C0E] border-b border-zinc-200 dark:border-white/5 relative overflow-hidden">
        {/* Background Accent */}
        <div className="absolute top-[-100px] right-[-100px] w-64 h-64 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex justify-between items-center relative z-10">
          <div className="flex items-center gap-3">
             {user.photoURL ? (
               <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full border-2 border-white dark:border-zinc-800 shadow-sm" referrerPolicy="no-referrer" />
             ) : (
               <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-white dark:border-zinc-800 shadow-sm flex items-center justify-center text-white font-bold">
                 {user.displayName?.charAt(0) || user.email?.charAt(0)}
               </div>
             )}
             <div>
               <div className="flex items-center gap-1.5">
                 <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-1">
                   <Sparkles size={10} />
                   {greeting}
                 </span>
               </div>
               <h1 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight leading-none mt-1">
                 {user.displayName?.split(' ')[0] || user.email?.split('@')[0]}
               </h1>
             </div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors p-2" onClick={signOut}>
              <LogOut size={22} strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="px-5 py-6 space-y-8"
      >
        {/* Business Overview */}
        <motion.section variants={itemVariants}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tighter flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
              {t('businessOverview')}
            </h2>
            <div className="relative z-20">
              <Dropdown
                value={currency}
                onChange={(val) => setCurrency(val as any)}
                options={[
                  { label: 'USD', value: 'USD' },
                  { label: 'LAK', value: 'LAK' },
                  { label: 'THB', value: 'THB' },
                ]}
                align="right"
                buttonClassName="bg-white dark:bg-[#1C1C1F] text-[10px] font-black text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-lg border border-zinc-200 dark:border-white/5 shadow-sm hover:border-indigo-500/30 uppercase tracking-widest min-w-[5rem]"
                menuClassName="w-32 min-w-0"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total Income */}
            <Link href="/income" className="bg-white dark:bg-[#141417] p-5 rounded-[24px] border border-zinc-200 dark:border-white/5 shadow-sm hover:border-indigo-500/50 dark:hover:border-indigo-500/30 transition-all group overflow-hidden relative">
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                <TrendingUp size={42} className="text-emerald-500" />
              </div>
              <div className="text-zinc-500 text-[10px] font-black uppercase tracking-widest relative z-10">{t('totalIncome')}</div>
              <div className="flex flex-col mt-2 relative z-10">
                <div className="text-lg font-black text-emerald-500 tracking-tighter">{formatAmount(stats.income)}</div>
                <div className="text-zinc-400 text-[10px] font-medium mt-1 uppercase tracking-wider">{t('allTime')}</div>
              </div>
            </Link>

            {/* Total Expense */}
            <Link href="/expenses" className="bg-white dark:bg-[#141417] p-5 rounded-[24px] border border-zinc-200 dark:border-white/5 shadow-sm hover:border-rose-500/50 dark:hover:border-rose-500/30 transition-all group overflow-hidden relative">
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                <TrendingDown size={42} className="text-rose-500" />
              </div>
              <div className="text-zinc-500 text-[10px] font-black uppercase tracking-widest relative z-10">{t('totalExpense')}</div>
              <div className="flex flex-col mt-2 relative z-10">
                <div className="text-lg font-black text-rose-500 tracking-tighter">{formatAmount(stats.expenses)}</div>
                <div className="text-zinc-400 text-[10px] font-medium mt-1 uppercase tracking-wider">{t('allTime')}</div>
              </div>
            </Link>

            {/* Net Profit */}
            <div className="bg-white dark:bg-[#141417] p-5 rounded-[24px] border border-zinc-200 dark:border-white/5 shadow-sm overflow-hidden relative">
              <div className="absolute top-0 right-0 p-3 opacity-10">
                {stats.profit >= 0 ? <TrendingUp size={42} className="text-indigo-500" /> : <TrendingDown size={42} className="text-rose-500" />}
              </div>
              <div className="text-zinc-500 text-[10px] font-black uppercase tracking-widest relative z-10">{t('netProfit')}</div>
              <div className="flex flex-col mt-2 relative z-10">
                <div className={`text-lg font-black tracking-tighter ${stats.profit >= 0 ? 'text-indigo-500' : 'text-rose-500'}`}>
                  {formatAmount(stats.profit)}
                </div>
                <div className="text-zinc-400 text-[10px] font-medium mt-1 uppercase tracking-wider">{t('allTime')}</div>
              </div>
            </div>

            {/* Invoices */}
            <Link href="/invoices" className="bg-white dark:bg-[#141417] p-5 rounded-[24px] border border-zinc-200 dark:border-white/5 shadow-sm hover:border-indigo-500/50 dark:hover:border-indigo-500/30 transition-all group overflow-hidden relative">
               <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                <FileText size={42} className="text-zinc-500" />
              </div>
              <div className="text-zinc-500 text-[10px] font-black uppercase tracking-widest relative z-10">{t('invoices')}</div>
              <div className="flex flex-col mt-2 relative z-10">
                <div className="text-lg font-black text-zinc-900 dark:text-white tracking-tighter">{stats.invoicesCount}</div>
                <div className="text-zinc-400 text-[10px] font-medium mt-1 uppercase tracking-wider">{t('allTime')}</div>
              </div>
            </Link>
          </div>
        </motion.section>

        {/* Quick Actions */}
        <motion.section variants={itemVariants}>
          <div className="flex justify-between items-end mb-5">
            <div>
              <h2 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tighter flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                {t('quickActions')}
              </h2>
            </div>
            <Link href="/more" className="text-indigo-500 text-xs font-bold uppercase tracking-widest hover:text-indigo-400 transition-colors">{t('seeAll')}</Link>
          </div>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-y-8">
            <Link href="/invoices?action=new">
              <QuickAction icon={<FilePlus className="text-emerald-500" size={24} />} label={t('invoice')} bg="bg-emerald-500/10 border border-emerald-500/10 shadow-sm" />
            </Link>
            <Link href="/expenses?action=new">
              <QuickAction icon={<ReceiptText className="text-rose-500" size={24} />} label={t('expense')} bg="bg-rose-500/10 border border-rose-500/10 shadow-sm" />
            </Link>
            <Link href="/income?action=new">
              <QuickAction icon={<Wallet className="text-indigo-500" size={24} />} label={t('income')} bg="bg-indigo-500/10 border border-indigo-500/10 shadow-sm" />
            </Link>
            <Link href="/clients">
              <QuickAction icon={<Users className="text-purple-500" size={24} />} label={t('clients')} bg="bg-purple-500/10 border border-purple-500/10 shadow-sm" />
            </Link>
            <Link href="/pipeline">
              <QuickAction icon={<Kanban className="text-blue-500" size={24} />} label={t('pipeline' as any) || "Pipeline"} bg="bg-blue-500/10 border border-blue-500/10 shadow-sm" />
            </Link>
            <Link href="/documents">
              <QuickAction icon={<FileText className="text-amber-500" size={24} />} label={t('documents' as any) || "Documents"} bg="bg-amber-500/10 border border-amber-500/10 shadow-sm" />
            </Link>

            <Link href="/categories">
              <QuickAction icon={<Bookmark className="text-orange-500" size={24} />} label={t('categories')} bg="bg-orange-500/10 border border-orange-500/10 shadow-sm" />
            </Link>
            <Link href="/reports">
              <QuickAction icon={<BarChart2 className="text-cyan-500" size={24} />} label={t('reports')} bg="bg-cyan-500/10 border border-cyan-500/10 shadow-sm" />
            </Link>
            <Link href="/history">
              <QuickAction icon={<Clock className="text-amber-500" size={24} />} label={t('history')} bg="bg-amber-500/10 border border-amber-500/10 shadow-sm" />
            </Link>
            <Link href="/more">
              <QuickAction icon={<LayoutGrid className="text-zinc-500 dark:text-zinc-400" size={24} />} label={t('more')} bg="bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 shadow-sm" />
            </Link>
          </div>
        </motion.section>

        {/* Charts */}
        {(monthlyData.length > 0 || categoryData.length > 0) && (
          <motion.section variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="flex flex-col h-full">
              <div className="h-10 flex flex-col justify-end mb-4">
                <h2 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tighter flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                  {t('incomeVsExpenses')}
                </h2>
              </div>
              <div className="bg-white dark:bg-[#141417] p-6 rounded-[32px] border border-zinc-200 dark:border-white/5 shadow-sm flex-1 min-h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="var(--tw-colors-zinc-200)" opacity={0.1} />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 'bold', fill: 'var(--tw-colors-zinc-400)' }} 
                      dy={10} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 'bold', fill: 'var(--tw-colors-zinc-400)' }} 
                      tickFormatter={(value) => formatAmount(value).replace('.00', '')} 
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', backgroundColor: 'var(--tw-colors-zinc-900)', color: 'var(--tw-colors-white)' }}
                      itemStyle={{ fontWeight: 'black', fontSize: '12px' }}
                      labelStyle={{ marginBottom: '4px', opacity: 0.5, fontSize: '10px', fontWeight: 'bold' }}
                    />
                    <Area type="monotone" dataKey="income" name={t('income')} stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorIncome)" />
                    <Area type="monotone" dataKey="expenses" name={t('expense')} stroke="#f43f5e" strokeWidth={4} fillOpacity={1} fill="url(#colorExpense)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {(categoryData.length > 0 || incomeCategoryData.length > 0) && (
              <div id="category-reports" className="scroll-mt-20 flex flex-col h-full">
                <div className="h-10 flex justify-between items-end mb-4">
                  <h2 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tighter flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                    {categoryType === 'expenses' ? t('expensesByCategory') : t('incomeByCategory')}
                  </h2>
                  <div className="flex bg-zinc-200 dark:bg-white/5 p-1 rounded-full border border-zinc-200 dark:border-white/5">
                    <button 
                      onClick={() => setCategoryType('expenses')}
                      className={`px-4 py-1 flex items-center justify-center text-[10px] font-black uppercase tracking-widest rounded-full transition-all ${categoryType === 'expenses' ? 'bg-white dark:bg-[#1C1C1F] text-indigo-500 shadow-sm scale-105' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                    >
                      {t('expenseShort')}
                    </button>
                    <button 
                      onClick={() => setCategoryType('income')}
                      className={`px-4 py-1 flex items-center justify-center text-[10px] font-black uppercase tracking-widest rounded-full transition-all ${categoryType === 'income' ? 'bg-white dark:bg-[#1C1C1F] text-indigo-500 shadow-sm scale-105' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                    >
                      {t('incomeShort')}
                    </button>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#141417] p-6 rounded-[32px] border border-zinc-200 dark:border-white/5 shadow-sm flex-1 min-h-[320px] flex flex-col sm:flex-row items-center justify-center">
                  {(categoryType === 'expenses' ? categoryData : incomeCategoryData).length === 0 ? (
                    <div className="text-zinc-500 text-sm font-bold opacity-50 uppercase tracking-widest">{categoryType === 'expenses' ? t('noExpenses') : t('noIncome')}</div>
                  ) : (
                    <>
                      <div className="w-full sm:w-[55%] h-[200px] sm:h-full relative flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={categoryType === 'expenses' ? categoryData : incomeCategoryData}
                              cx="50%"
                              cy="50%"
                              innerRadius={65}
                              outerRadius={85}
                              paddingAngle={8}
                              dataKey="value"
                              stroke="none"
                            >
                              {(categoryType === 'expenses' ? categoryData : incomeCategoryData).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', backgroundColor: 'var(--tw-colors-zinc-900)', color: 'var(--tw-colors-white)' }}
                              itemStyle={{ fontWeight: 'black', fontSize: '12px' }}
                              formatter={(value: any) => formatAmount(value)}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none flex flex-col items-center justify-center w-24">
                          <div className="text-[9px] md:text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none mb-1">{t('total')}</div>
                          <div className="text-sm md:text-lg font-black text-zinc-900 dark:text-white tracking-tighter truncate w-full px-1">
                            {formatAmount((categoryType === 'expenses' ? categoryData : incomeCategoryData).reduce((a, b) => a + b.value, 0)).replace('.00', '')}
                          </div>
                        </div>
                      </div>
                      <div className="w-full sm:w-[45%] pl-0 sm:pl-6 mt-4 sm:mt-0 flex flex-col justify-center gap-3 max-h-[160px] sm:max-h-full overflow-y-auto custom-scrollbar">
                        {(categoryType === 'expenses' ? categoryData : incomeCategoryData).map((entry, index) => (
                          <div key={entry.name} className="flex items-center gap-3">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                            <div className="min-w-0 flex-1 flex justify-between items-center">
                              <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-tight truncate pr-2">{entry.name}</span>
                              <span className="text-[11px] font-black text-zinc-900 dark:text-white tracking-widest">{formatAmount(entry.value).replace('.00', '')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </motion.section>
        )}

        {/* Recent Invoices */}
        <motion.section variants={itemVariants}>
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tighter flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
              {t('recentInvoices')}
            </h2>
            <Link href="/invoices" className="text-indigo-500 text-xs font-bold uppercase tracking-widest hover:text-indigo-400 transition-colors">
              {t('seeAll')}
            </Link>
          </div>

          <div className="bg-white dark:bg-[#141417] rounded-[32px] p-2 border border-zinc-200 dark:border-white/5 shadow-sm space-y-1 overflow-hidden">
            {invoices.length === 0 ? (
               <div className="text-center py-10 text-zinc-400 text-sm font-bold uppercase tracking-widest opacity-50">{t('noInvoices')}</div>
            ) : (
              invoices.map((inv) => (
                <InvoiceRow 
                  key={inv.id}
                  id={inv.invoiceNumber} 
                  name={inv.clientName} 
                  amount={formatAmount(inv.total)} 
                  status={inv.status === 'Paid' ? t('paid') : inv.status === 'Sent' ? t('sent') : t('pending')} 
                  statusColor={inv.status === 'Paid' ? 'text-emerald-500' : inv.status === 'Sent' ? 'text-indigo-500' : 'text-orange-500'} 
                  dotColor={inv.status === 'Paid' ? 'bg-emerald-500' : inv.status === 'Sent' ? 'bg-indigo-500' : 'bg-orange-500'} 
                  iconColor={inv.status === 'Paid' ? 'text-emerald-500' : inv.status === 'Sent' ? 'text-indigo-500' : 'text-orange-500'} 
                  dbId={inv.id}
                />
              ))
            )}
          </div>
        </motion.section>
      </motion.div>

      <BottomNav />
    </main>
  );
}

function QuickAction({ icon, label, bg }: { icon: React.ReactNode, label: string, bg: string }) {
  return (
    <motion.div 
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="flex flex-col items-center gap-3 group cursor-pointer"
    >
      <div className={`${bg} w-14 h-14 flex items-center justify-center rounded-[20px] transition-all duration-300 group-hover:rotate-6 group-hover:shadow-lg group-hover:shadow-indigo-500/10`}>
        {icon}
      </div>
      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest whitespace-nowrap group-hover:text-indigo-500 transition-colors px-1">
        {label}
      </span>
    </motion.div>
  );
}

function InvoiceRow({ id, name, amount, status, statusColor, dotColor, iconColor, dbId }: { id: string, name: string, amount: string, status: string, statusColor: string, dotColor: string, iconColor: string, dbId: string }) {
  return (
    <motion.div 
      whileHover={{ scale: 0.995 }}
      whileTap={{ scale: 0.98 }}
    >
      <Link href={`/invoices/${dbId}`} className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-white/[0.03] rounded-[24px] transition-all group">
        <div className="flex items-center gap-4 relative">
          <div className={`w-12 h-12 flex items-center justify-center rounded-[16px] bg-slate-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/20 transition-all duration-300`}>
             <FileText size={20} className={`${iconColor} transition-transform duration-300 group-hover:scale-110`} />
          </div>
          <div>
            <div className="font-black text-[14px] text-zinc-900 dark:text-white tracking-tight">{id}</div>
            <div className="text-[11px] font-bold text-zinc-400 mt-0.5 uppercase tracking-wide">{name}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="font-black text-[15px] text-zinc-900 dark:text-white tracking-tighter">{amount}</div>
            <div className={`text-[10px] font-black uppercase tracking-widest mt-1.5 flex items-center justify-end gap-1.5 ${statusColor}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${dotColor} shadow-[0_0_8px_rgba(0,0,0,0.1)] group-hover:animate-pulse`}></span>
              {status}
            </div>
          </div>
          <div className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-50 dark:bg-white/5 text-zinc-300 group-hover:text-indigo-500 group-hover:bg-indigo-500/10 transition-all duration-300">
            <Eye size={16} />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
