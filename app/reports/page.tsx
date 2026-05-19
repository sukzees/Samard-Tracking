'use client';

import { ArrowLeft, BarChart3, TrendingUp, TrendingDown, PieChart, Calendar, Loader2, Download, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/LanguageProvider';
import { useAuth } from '@/components/AuthProvider';
import { useGroup } from '@/components/GroupProvider';
import { useCurrency } from '@/components/CurrencyProvider';
import { useEffect, useState, useMemo } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart as RePieChart, Pie, Cell, BarChart, Bar, Legend 
} from 'recharts';
import BottomNav from '@/components/BottomNav';
import { motion } from 'motion/react';

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

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#0ea5e9', '#d946ef', '#f43f5e', '#8b5cf6', '#64748b'];

type TimeRange = 'thisMonth' | 'lastMonth' | 'thisYear' | 'allTime';

export default function ReportsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { activeGroupId } = useGroup();
  const { currency, formatAmount, convertAmount, rates } = useCurrency();
  
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('allTime');
  const [incomeData, setIncomeData] = useState<any[]>([]);
  const [expenseData, setExpenseData] = useState<any[]>([]);
  
  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, activeGroupId, currency, rates]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const groupIdToUse = activeGroupId || user?.uid;
      if (!groupIdToUse) return;

      const incQuery = query(collection(db, 'incomes'), where('groupId', '==', groupIdToUse));
      const expQuery = query(collection(db, 'expenses'), where('groupId', '==', groupIdToUse));

      const [incSnap, expSnap] = await Promise.all([
        getDocs(incQuery).catch(e => { handleFirestoreError(e, OperationType.LIST, 'incomes'); return { docs: [] } as any; }),
        getDocs(expQuery).catch(e => { handleFirestoreError(e, OperationType.LIST, 'expenses'); return { docs: [] } as any; })
      ]);

      const incs = incSnap.docs.map((doc: any) => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data, 
          originalAmount: data.amount,
          amount: convertAmount(data.amount || 0, data.currency || 'USD', currency)
        };
      });
      
      const exps = expSnap.docs.map((doc: any) => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data, 
          originalAmount: data.amount,
          amount: convertAmount(data.amount || 0, data.currency || 'USD', currency)
        };
      });

      setIncomeData(incs);
      setExpenseData(exps);
    } catch (error) {
      console.error("Error fetching reports data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const filterFn = (item: any) => {
      if (timeRange === 'allTime') return true;
      if (!item.date) return false;
      const itemDate = new Date(item.date);
      
      switch (timeRange) {
        case 'thisMonth':
          return itemDate >= startOfMonth;
        case 'lastMonth':
          return itemDate >= startOfLastMonth && itemDate <= endOfLastMonth;
        case 'thisYear':
          return itemDate >= startOfYear;
        default:
          return true;
      }
    };

    return {
      income: incomeData.filter(filterFn),
      expenses: expenseData.filter(filterFn)
    };
  }, [incomeData, expenseData, timeRange]);

  const stats = useMemo(() => {
    const totalIncome = filteredData.income.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalExpenses = filteredData.expenses.reduce((sum, item) => sum + (item.amount || 0), 0);
    return {
      revenue: totalIncome,
      expenses: totalExpenses,
      profit: totalIncome - totalExpenses,
      margin: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0
    };
  }, [filteredData]);

  const monthlyChartData = useMemo(() => {
    const monthMap: Record<string, { name: string, income: number, expenses: number }> = {};
    const monthsToShow = timeRange === 'thisYear' ? 12 : 6;
    
    for (let i = monthsToShow - 1; i >= 0; i--) {
      const d = new Date();
      if (timeRange === 'thisYear') {
        d.setMonth(i);
      } else {
        d.setMonth(d.getMonth() - i);
      }
      const label = d.toLocaleString('default', { month: 'short' });
      const year = d.getFullYear().toString().slice(-2);
      const key = `${label} ${year}`;
      monthMap[key] = { name: label, income: 0, expenses: 0 };
    }

    filteredData.income.forEach(item => {
      if (item.date) {
        const d = new Date(item.date);
        const label = d.toLocaleString('default', { month: 'short' });
        const year = d.getFullYear().toString().slice(-2);
        const key = `${label} ${year}`;
        if (monthMap[key]) monthMap[key].income += item.amount || 0;
      }
    });

    filteredData.expenses.forEach(item => {
      if (item.date) {
        const d = new Date(item.date);
        const label = d.toLocaleString('default', { month: 'short' });
        const year = d.getFullYear().toString().slice(-2);
        const key = `${label} ${year}`;
        if (monthMap[key]) monthMap[key].expenses += item.amount || 0;
      }
    });

    return Object.values(monthMap);
  }, [filteredData, timeRange]);

  const categoryChartData = useMemo(() => {
    const catMap: Record<string, number> = {};
    filteredData.expenses.forEach(item => {
      const cat = item.category || 'Other';
      catMap[cat] = (catMap[cat] || 0) + (item.amount || 0);
    });
    return Object.keys(catMap).map(name => ({ name, value: catMap[name] }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-[#09090B] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] animate-pulse">Calculating Reports...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-[#09090B] pb-28">
      {/* Header */}
      <header className="px-5 py-6 space-y-4 bg-white dark:bg-[#0C0C0E] border-b border-zinc-200 dark:border-white/5 relative overflow-hidden">
        <div className="absolute top-[-100px] right-[-100px] w-64 h-64 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-2xl bg-indigo-500 border border-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
               <BarChart3 size={20} strokeWidth={2.5} />
             </div>
             <div>
               <h1 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight leading-none">{t('reports')}</h1>
               <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-1 flex items-center gap-1.5">
                 <Sparkles size={10} />
                 Business Intelligence
               </div>
             </div>
          </div>
          <button className="w-10 h-10 border border-zinc-200 dark:border-white/5 bg-white dark:bg-[#141417] text-zinc-700 dark:text-zinc-300 rounded-2xl flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-white/10 transition-colors">
            <Download size={20} strokeWidth={2.5} />
          </button>
        </div>
      </header>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="p-5 space-y-8"
      >
        {/* Time Range Filter */}
        <motion.div variants={itemVariants} className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
          {(['allTime', 'thisMonth', 'lastMonth', 'thisYear'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${
                timeRange === range 
                  ? 'bg-zinc-900 border-zinc-900 dark:bg-white dark:border-white text-white dark:text-black shadow-lg' 
                  : 'bg-white dark:bg-[#0C0C0E] border-zinc-200 dark:border-white/5 text-zinc-500'
              }`}
            >
              {t(range as any)}
            </button>
          ))}
        </motion.div>

        {/* Stats Grid */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard 
            title={t('revenue')} 
            value={formatAmount(stats.revenue)} 
            icon={<TrendingUp size={20} strokeWidth={2.5} />} 
            color="text-emerald-500" 
            bg="bg-emerald-500/5 dark:bg-emerald-500/10" 
          />
          <StatCard 
            title={t('expense')} 
            value={formatAmount(stats.expenses)} 
            icon={<TrendingDown size={20} strokeWidth={2.5} />} 
            color="text-rose-500" 
            bg="bg-rose-500/5 dark:bg-rose-500/10" 
          />
          <StatCard 
            title={t('profit')} 
            value={formatAmount(stats.profit)} 
            icon={<BarChart3 size={20} strokeWidth={2.5} />} 
            color="text-indigo-500" 
            bg="bg-indigo-500/5 dark:bg-indigo-500/10" 
            subtitle={`${stats.margin.toFixed(1)}% margin`}
          />
        </motion.div>

        {/* Main Chart */}
        <motion.div variants={itemVariants} className="bg-white dark:bg-[#0C0C0E] p-8 rounded-[40px] shadow-sm border border-zinc-200 dark:border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-700 pointer-events-none">
             <TrendingUp size={160} strokeWidth={1} />
          </div>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10 relative z-10">
            <div>
              <h2 className="text-[11px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-1">{t('incomeVsExpenses')}</h2>
              <div className="text-xl font-black text-zinc-900 dark:text-white tracking-tight uppercase">Cash Flow Analysis</div>
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/20"></div>
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('income')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-lg shadow-rose-500/20"></div>
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('expense')}</span>
              </div>
            </div>
          </div>
          
          <div className="h-[350px] w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyChartData}>
                <defs>
                  <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="currentColor" className="text-zinc-100 dark:text-zinc-800" />
                <XAxis 
                   dataKey="name" 
                   axisLine={false} 
                   tickLine={false} 
                   tick={{ fontSize: 9, fill: 'currentColor', className: 'text-zinc-400 font-black uppercase' }} 
                   dy={15}
                />
                <YAxis 
                   axisLine={false} 
                   tickLine={false} 
                   tick={{ fontSize: 9, fill: 'currentColor', className: 'text-zinc-400 font-black' }} 
                   tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(1)}k` : value}
                />
                <Tooltip 
                  cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }}
                  contentStyle={{ 
                    borderRadius: '24px', 
                    border: '1px solid rgba(0,0,0,0.05)', 
                    boxShadow: '0 20px 40px rgba(0,0,0,0.1)', 
                    backgroundColor: 'rgba(255,255,255,0.95)', 
                    backdropFilter: 'blur(12px)',
                    padding: '16px'
                  }}
                  itemStyle={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', padding: '4px 0' }}
                  labelStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '8px', color: '#94a3b8' }}
                />
                <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorInc)" animationDuration={1500} />
                <Area type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={4} fillOpacity={1} fill="url(#colorExp)" animationDuration={1500} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Secondary Charts */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Category Breakdown */}
          <div className="bg-white dark:bg-[#0C0C0E] p-8 rounded-[40px] shadow-sm border border-zinc-200 dark:border-white/5 space-y-8">
            <div>
              <h2 className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1">{t('topCategories')}</h2>
              <div className="text-lg font-black text-zinc-900 dark:text-white tracking-tight uppercase">Spending Distribution</div>
            </div>
            
            <div className="h-[280px] w-full relative flex items-center justify-center">
              {categoryChartData.length > 0 ? (
                <div className="w-full h-full flex flex-col items-center">
                  <ResponsiveContainer width="100%" height="70%">
                    <RePieChart>
                      <Pie
                        data={categoryChartData}
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={8}
                        dataKey="value"
                        stroke="none"
                        animationDuration={1000}
                      >
                        {categoryChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RePieChart>
                  </ResponsiveContainer>
                  
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-auto w-full pt-4">
                    {categoryChartData.slice(0, 4).map((item, index) => (
                      <div key={item.name} className="flex items-center gap-3 bg-zinc-50 dark:bg-black/20 p-2 rounded-xl">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                        <div className="flex-1 min-w-0">
                           <div className="text-[9px] font-black text-zinc-400 uppercase tracking-widest truncate">{item.name}</div>
                           <div className="text-[11px] font-black text-zinc-900 dark:text-white">{formatAmount(item.value)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 text-zinc-400">
                   <div className="w-16 h-16 rounded-full bg-zinc-50 dark:bg-white/5 flex items-center justify-center opacity-30">
                     <PieChart size={32} />
                   </div>
                   <span className="text-[10px] font-black uppercase tracking-widest">{t('noExpenses')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Growth Comparison */}
          <div className="bg-white dark:bg-[#0C0C0E] p-8 rounded-[40px] shadow-sm border border-zinc-200 dark:border-white/5 space-y-8">
            <div>
              <h2 className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1">{t('growth')}</h2>
              <div className="text-lg font-black text-zinc-900 dark:text-white tracking-tight uppercase">Performance Overview</div>
            </div>
            
            <div className="h-[280px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData.slice(-4)}>
                  <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="currentColor" className="text-zinc-100 dark:text-zinc-800" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fill: 'currentColor', className: 'text-zinc-400 font-black uppercase' }} 
                    dy={12}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fill: 'currentColor', className: 'text-zinc-400 font-black' }} 
                  />
                  <Tooltip 
                    cursor={{ fill: 'currentColor', className: 'text-zinc-50 dark:text-white/5' }}
                    contentStyle={{ 
                      borderRadius: '24px', 
                      border: 'none', 
                      boxShadow: '0 20px 40px rgba(0,0,0,0.1)', 
                      backgroundColor: 'rgba(255,255,255,0.95)',
                      padding: '16px'
                    }}
                  />
                  <Bar dataKey="income" fill="#10b981" radius={[12, 12, 0, 0]} barSize={24} />
                  <Bar dataKey="expenses" fill="#f43f5e" radius={[12, 12, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      </motion.div>
      <BottomNav />
    </main>
  );
}

function StatCard({ title, value, icon, color, bg, subtitle }: { title: string, value: string, icon: React.ReactNode, color: string, bg: string, subtitle?: string }) {
  return (
    <div className="group bg-white dark:bg-[#0C0C0E] p-6 rounded-[32px] border border-zinc-200 dark:border-white/5 flex flex-col gap-3 shadow-sm hover:translate-y-[-4px] transition-all duration-300">
      <div className="flex justify-between items-center">
        <div className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] leading-none">{title}</div>
        <div className={`w-10 h-10 rounded-2xl ${bg} ${color} flex items-center justify-center shadow-lg transition-transform group-hover:rotate-12 duration-500`}>
          {icon}
        </div>
      </div>
      <div>
        <div className={`text-2xl font-black tracking-tight text-zinc-900 dark:text-white`}>{value}</div>
        {subtitle && <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1 opacity-70">{subtitle}</div>}
      </div>
    </div>
  );
}
