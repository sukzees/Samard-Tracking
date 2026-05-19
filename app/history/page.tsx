'use client';

import { ArrowLeft, History, Clock, FileText, ReceiptText, Wallet, User, Plus, Edit2, Trash2, ShieldAlert, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { useGroup } from '@/components/GroupProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { useCurrency } from '@/components/CurrencyProvider';
import BottomNav from '@/components/BottomNav';
import { motion, AnimatePresence } from 'motion/react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { y: 10, opacity: 0 },
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

export default function HistoryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { activeGroupId } = useGroup();
  const { t } = useLanguage();
  const { formatAmount } = useCurrency();
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      const params = new URLSearchParams(window.location.search);
      const type = params.get('type') || undefined;
      const id = params.get('id') || undefined;
      fetchActivities(type, id);
    }
  }, [user, activeGroupId]);

  const fetchActivities = async (type?: string, id?: string) => {
    try {
      let q = query(
        collection(db, 'activities'),
        where('groupId', '==', activeGroupId || user?.uid),
        orderBy('timestamp', 'desc'),
        limit(50)
      );

      if (type && id) {
        q = query(
          collection(db, 'activities'),
          where('groupId', '==', activeGroupId || user?.uid),
          where('entityType', '==', type),
          where('entityId', '==', id),
          orderBy('timestamp', 'desc'),
          limit(50)
        );
      } else if (type) {
        q = query(
          collection(db, 'activities'),
          where('groupId', '==', activeGroupId || user?.uid),
          where('entityType', '==', type),
          orderBy('timestamp', 'desc'),
          limit(50)
        );
      }

      const snap = await getDocs(q);
      setActivities(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'activities');
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create': return <Plus size={12} strokeWidth={3} />;
      case 'update': return <Edit2 size={12} strokeWidth={3} />;
      case 'delete': return <Trash2 size={12} strokeWidth={3} />;
      case 'status_change': return <ShieldAlert size={12} strokeWidth={3} />;
      default: return <Clock size={12} strokeWidth={3} />;
    }
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'invoice': return <FileText size={20} className="text-emerald-500" />;
      case 'expense': return <ReceiptText size={20} className="text-rose-500" />;
      case 'income': return <Wallet size={20} className="text-indigo-500" />;
      case 'client': return <User size={20} className="text-blue-500" />;
      default: return <History size={20} className="text-zinc-500" />;
    }
  };

  const formatMessage = (activity: any) => {
    const actionMap: any = {
      create: t('created'),
      update: t('updated'),
      delete: t('deleted'),
      status_change: t('statusChanged'),
    };

    const typeMap: any = {
      invoice: t('invoice'),
      expense: t('expense'),
      income: t('income'),
      client: t('clients'),
    };

    const action = actionMap[activity.action] || activity.action;
    const type = typeMap[activity.entityType] || activity.entityType;
    
    return (
      <div className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
        <span className="font-black text-zinc-900 dark:text-white uppercase tracking-tight">{activity.userName}</span>
        {' '}<span className="opacity-70 font-medium">{action.toLowerCase()}</span>{' '}
        <span className="font-black text-zinc-900 dark:text-white uppercase tracking-tight">{type}</span>
        <div className="text-sm font-bold text-indigo-500 dark:text-indigo-400 truncate mt-0.5">
          {activity.entityName}
        </div>
      </div>
    );
  };

  const renderDetails = (activity: any) => {
    if (activity.action === 'create') {
      return (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-4 pt-4 border-t border-zinc-100 dark:border-white/5"
        >
          <div className="p-4 bg-slate-50 dark:bg-black/20 rounded-2xl border border-zinc-200 dark:border-white/5 space-y-3">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{t('details')}</p>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(activity.newValue || {}).map(([key, value]: [string, any]) => {
                if (['userId', 'groupId', 'id', 'createdAt', 'updatedAt', 'items'].includes(key)) return null;
                if (value === null || value === undefined) return null;
                const isMonetary = ['amount', 'total', 'subtotal', 'rate', 'price', 'tax'].includes(key.toLowerCase());
                const displayValue = isMonetary && typeof value === 'number' 
                  ? formatAmount(value)
                  : (typeof value === 'object' ? JSON.stringify(value) : String(value));
                  
                return (
                  <div key={key} className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest truncate">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                      {displayValue}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      );
    }

    if (activity.action === 'update' || activity.action === 'status_change') {
      const oldVal = activity.oldValue || {};
      const newVal = activity.newValue || {};
      const changedKeys = Object.keys(newVal).filter(key => {
        if (['userId', 'groupId', 'id', 'createdAt', 'updatedAt', 'items'].includes(key)) return false;
        return JSON.stringify(oldVal[key]) !== JSON.stringify(newVal[key]);
      });

      if (changedKeys.length === 0) return null;

      return (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-4 pt-4 border-t border-zinc-100 dark:border-white/5"
        >
          <div className="p-4 bg-slate-50 dark:bg-black/20 rounded-2xl border border-zinc-200 dark:border-white/5 space-y-4">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{t('changes')}</p>
            <div className="space-y-4">
              {changedKeys.map(key => {
                const isMonetary = ['amount', 'total', 'subtotal', 'rate', 'price', 'tax'].includes(key.toLowerCase());
                const oldDisplay = isMonetary && typeof oldVal[key] === 'number' 
                  ? formatAmount(oldVal[key]) 
                  : String(oldVal[key] || 'None');
                const newDisplay = isMonetary && typeof newVal[key] === 'number' 
                  ? formatAmount(newVal[key]) 
                  : String(newVal[key]);

                return (
                  <div key={key} className="space-y-1.5">
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <div className="flex items-center gap-3">
                      <div className="px-3 py-1.5 bg-rose-500/5 dark:bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/10 line-through text-[11px] font-bold">
                        {oldDisplay}
                      </div>
                      <div className="w-5 h-px bg-zinc-300 dark:bg-white/10" />
                      <div className="px-3 py-1.5 bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/10 text-[11px] font-black">
                        {newDisplay}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      );
    }

    return null;
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-[#09090B] pb-28">
      {/* Header */}
      <header className="px-5 py-6 space-y-4 bg-white dark:bg-[#0C0C0E] border-b border-zinc-200 dark:border-white/5 relative overflow-hidden">
        <div className="absolute top-[-100px] left-[-100px] w-64 h-64 bg-zinc-500/5 dark:bg-zinc-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex items-center gap-3 relative z-10">
          <button 
            onClick={() => router.back()} 
            className="w-10 h-10 border border-zinc-200 dark:border-white/5 bg-white dark:bg-[#141417] text-zinc-700 dark:text-zinc-300 rounded-2xl flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-white/10 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight leading-none">{t('history')}</h1>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1 flex items-center gap-1.5">
              <Sparkles size={10} />
              Recent Activities
            </div>
          </div>
        </div>
      </header>

      <div className="p-5 space-y-6 max-w-4xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
             <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
             <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest animate-pulse">Loading History...</p>
           </div>
        ) : activities.length === 0 ? (
          <div className="bg-white dark:bg-[#0C0C0E] p-12 rounded-[40px] border border-zinc-200 dark:border-white/5 text-center shadow-sm">
            <div className="w-20 h-20 bg-zinc-50 dark:bg-white/5 rounded-full flex items-center justify-center text-zinc-300 dark:text-zinc-700 mx-auto mb-6">
              <History size={40} strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white mb-2 uppercase tracking-tight">{t('noHistory')}</h2>
            <p className="text-zinc-500 text-sm max-w-xs mx-auto font-medium">
              Changes you make to your invoices, expenses, and clients will appear here.
            </p>
          </div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-4"
          >
            {activities.map((activity) => (
              <motion.div 
                key={activity.id} 
                variants={itemVariants}
                onClick={() => setExpandedId(expandedId === activity.id ? null : activity.id)}
                className={`group bg-white dark:bg-[#0C0C0E] p-5 rounded-[32px] border transition-all cursor-pointer shadow-sm relative overflow-hidden ${
                  expandedId === activity.id ? 'border-indigo-500 ring-4 ring-indigo-500/5' : 'border-zinc-200 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/10'
                }`}
              >
                <div className="flex items-start gap-5 relative z-10">
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/5 flex items-center justify-center transition-transform group-hover:scale-110 duration-500">
                      {getEntityIcon(activity.entityType)}
                    </div>
                    <div className={`absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center border-4 border-white dark:border-[#0C0C0E] shadow-sm transform transition-transform group-hover:rotate-12 duration-500 ${
                      activity.action === 'create' ? 'bg-emerald-500 text-white' :
                      activity.action === 'delete' ? 'bg-rose-500 text-white' :
                      activity.action === 'status_change' ? 'bg-amber-500 text-white' :
                      'bg-indigo-500 text-white'
                    }`}>
                      {getActionIcon(activity.action)}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0 py-0.5">
                    <div className="flex justify-between items-start gap-2 mb-1">
                      {formatMessage(activity)}
                      <div className="text-zinc-300 dark:text-zinc-700 transition-colors group-hover:text-indigo-500">
                         {expandedId === activity.id ? <ChevronUp size={18} strokeWidth={3} /> : <ChevronDown size={18} strokeWidth={3} />}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[9px] text-zinc-400 font-black uppercase tracking-[0.1em]">
                      <Clock size={10} strokeWidth={3} />
                      {activity.timestamp?.toDate ? activity.timestamp.toDate().toLocaleString() : new Date(activity.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedId === activity.id && renderDetails(activity)}
                </AnimatePresence>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
