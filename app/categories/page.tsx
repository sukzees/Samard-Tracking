'use client';

import { ArrowLeft, Plus, Trash2, Edit2, Check, Sparkles, Bookmark, TrendingUp, TrendingDown, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { useGroup } from '@/components/GroupProvider';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/components/LanguageProvider';
import { motion, AnimatePresence } from 'motion/react';
import BottomNav from '@/components/BottomNav';

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

export default function CategoriesManager() {
  const router = useRouter();
  const { user } = useAuth();
  const { activeGroupId } = useGroup();
  const { t, language } = useLanguage();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNameLo, setEditNameLo] = useState('');
  const [editType, setEditType] = useState('Expense');
  
  const [isAdding, setIsAdding] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      if (!user) return;
      const q1 = query(collection(db, 'categories'), where('userId', '==', user.uid));
      const q2 = query(collection(db, 'categories'), where('groupId', '==', activeGroupId || user.uid));
      
      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      
      const catsMap = new Map();
      [...snap1.docs, ...snap2.docs].forEach(d => {
        catsMap.set(d.id, { id: d.id, ...d.data() });
      });
      
      const allCats = Array.from(catsMap.values());
      const filtered = allCats.filter((c: any) => {
        return (c.type === 'Expense' || c.type === 'Income') && (c.groupId === activeGroupId || !c.groupId || (activeGroupId === user.uid && c.groupId === user.uid));
      });
      
      setCategories(filtered.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'categories');
    } finally {
      setLoading(false);
    }
  }, [user, activeGroupId]);

  useEffect(() => {
    if (user) {
      fetchCategories();
    }
  }, [user, activeGroupId, fetchCategories]);

  const handleSave = async (id: string | null) => {
    if (!editName.trim()) {
      toast.error(t('categoryName'));
      return;
    }
    try {
      const catId = id || `cat_${Date.now()}`;
      const payload: any = {
        name: editName,
        nameLo: editNameLo,
        type: editType,
        userId: user?.uid,
        groupId: activeGroupId || user?.uid,
        updatedAt: serverTimestamp(),
      };

      if (!id) {
        payload.createdAt = serverTimestamp();
        payload.createdBy = user?.displayName || user?.email;
      } else {
        payload.editedBy = user?.displayName || user?.email;
      }

      await setDoc(doc(db, 'categories', catId), payload, { merge: true });
      
      toast.success(id ? t('categoryUpdated' as any) : t('categoryAdded' as any));
      setIsEditing(null);
      setIsAdding(false);
      fetchCategories();
    } catch (e) {
      toast.error(t('saveFailed'));
      handleFirestoreError(e, OperationType.WRITE, 'categories');
    }
  };

  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  
  const handleDelete = async (id: string) => {
    try {
      setConfirmingDelete(null);
      await deleteDoc(doc(db, 'categories', id));
      toast.success(t('categoryDeleted' as any));
      fetchCategories();
    } catch (e) {
      toast.error(t('deleteFailed'));
      handleFirestoreError(e, OperationType.DELETE, `categories/${id}`);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-[#09090B] pb-28">
      {/* Header */}
      <header className="px-5 py-6 space-y-4 bg-white dark:bg-[#0C0C0E] border-b border-zinc-200 dark:border-white/5 relative overflow-hidden">
        <div className="absolute top-[-100px] right-[-100px] w-64 h-64 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-2xl bg-indigo-500 border border-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
               <Bookmark size={20} strokeWidth={2.5} />
             </div>
             <div>
               <h1 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight leading-none">{t('categories')}</h1>
               <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-1 flex items-center gap-1.5 label-sparkle">
                 <Sparkles size={10} />
                 Taxonomy engine
               </div>
             </div>
          </div>
          <button onClick={() => { setIsAdding(true); setEditName(''); setEditNameLo(''); setEditType('Expense'); setIsEditing(null); }} className="w-10 h-10 bg-indigo-500 dark:bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all">
            <Plus size={20} strokeWidth={2.5} />
          </button>
        </div>
      </header>

      <div className="p-5 space-y-8">
        <AnimatePresence>
          {(isAdding || isEditing) && (
            <motion.div 
              initial={{ height: 0, opacity: 0, scale: 0.95 }}
              animate={{ height: 'auto', opacity: 1, scale: 1 }}
              exit={{ height: 0, opacity: 0, scale: 0.95 }}
              className="overflow-hidden mb-6"
            >
              <div className="bg-white dark:bg-[#0C0C0E] p-8 rounded-[40px] border-2 border-indigo-500/20 dark:border-indigo-500/30 space-y-8 shadow-2xl shadow-indigo-500/10 relative">
                <button 
                  onClick={() => { setIsAdding(false); setIsEditing(null); }}
                  className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
                
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                    {isAdding ? <Plus size={24} strokeWidth={2.5} /> : <Edit2 size={24} strokeWidth={2.5} />}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">
                      {isAdding ? t('addCategory' as any) || "Add Category" : t('edit')}
                    </h2>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Classification Management</p>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">{t('categoryName')} (EN)</label>
                    <input 
                      value={editName} 
                      onChange={e => setEditName(e.target.value)} 
                      placeholder="e.g. Marketing" 
                      className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-[20px] px-5 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all" 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">{t('categoryName')} (LO)</label>
                    <input 
                      value={editNameLo} 
                      onChange={e => setEditNameLo(e.target.value)} 
                      placeholder="ຕົວຢ່າງ: ການຕະຫຼາດ" 
                      className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-[20px] px-5 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all" 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">{t('type')}</label>
                    <div className="grid grid-cols-2 gap-4">
                       <button 
                         onClick={() => setEditType('Expense')}
                         className={`py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest border-2 transition-all flex items-center justify-center gap-2 ${editType === 'Expense' ? 'bg-rose-500/10 border-rose-500 text-rose-500 shadow-lg shadow-rose-500/5' : 'bg-zinc-50 dark:bg-white/5 border-transparent text-zinc-400'}`}
                       >
                         <TrendingDown size={14} strokeWidth={2.5} />
                         {t('expense')}
                       </button>
                       <button 
                         onClick={() => setEditType('Income')}
                         className={`py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest border-2 transition-all flex items-center justify-center gap-2 ${editType === 'Income' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500 shadow-lg shadow-emerald-500/5' : 'bg-zinc-50 dark:bg-white/5 border-transparent text-zinc-400'}`}
                       >
                         <TrendingUp size={14} strokeWidth={2.5} />
                         {t('income')}
                       </button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => handleSave(isEditing)}
                    className="flex-1 py-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-[24px] text-xs font-black uppercase tracking-widest shadow-xl shadow-zinc-900/10 dark:shadow-white/5 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Check size={18} strokeWidth={3} />
                    {t('save')}
                  </button>
                  <button 
                    onClick={() => { setIsAdding(false); setIsEditing(null); }}
                    className="flex-1 py-4 bg-zinc-100 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 rounded-[24px] text-xs font-black uppercase tracking-widest active:scale-95 transition-all"
                  >
                    {t('cancel')}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest animate-pulse">Mapping categories...</p>
          </div>
        ) : categories.length === 0 && !isAdding ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-[#0C0C0E] p-16 rounded-[40px] border border-zinc-200 dark:border-white/5 text-center space-y-6"
          >
             <div className="w-24 h-24 bg-zinc-50 dark:bg-white/5 rounded-[40px] flex items-center justify-center mx-auto text-zinc-300">
               <Bookmark size={48} strokeWidth={1.5} />
             </div>
             <div>
               <h3 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight">{t('noCategories')}</h3>
               <p className="text-xs text-zinc-500 font-medium mt-1">Organize your finances efficiently.</p>
             </div>
             <button onClick={() => { setIsAdding(true); setEditName(''); setEditType('Expense'); }} className="bg-indigo-500 hover:bg-indigo-400 text-white px-8 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/20 transition-all">
               + Create Category
             </button>
          </motion.div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {categories.map(cat => (
              <motion.div 
                variants={itemVariants}
                key={cat.id} 
                className="group bg-white dark:bg-[#0C0C0E] p-6 rounded-[32px] border border-zinc-200 dark:border-white/5 relative overflow-hidden transition-all hover:translate-y-[-4px] hover:shadow-xl hover:shadow-indigo-500/5"
              >
                <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity duration-700 pointer-events-none group-hover:scale-150 transform transition-transform duration-1000">
                  <Bookmark size={120} strokeWidth={1} />
                </div>

                <div className="flex flex-col gap-6 relative z-10">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-black text-lg text-zinc-900 dark:text-white tracking-tight leading-tight group-hover:text-indigo-500 transition-colors uppercase">
                        {(language === 'lo' && cat.nameLo) ? cat.nameLo : cat.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${cat.type === 'Expense' ? 'bg-rose-500' : cat.type === 'Income' ? 'bg-emerald-500' : 'bg-amber-500'} shadow-lg group-hover:animate-pulse`}></div>
                        <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${cat.type === 'Expense' ? 'text-rose-500' : cat.type === 'Income' ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {cat.type === 'Expense' ? t('expense') : cat.type === 'Income' ? t('income') : t('documents')}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 bg-zinc-50 dark:bg-white/5 p-1 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setIsEditing(cat.id); setEditName(cat.name); setEditNameLo(cat.nameLo || ''); setEditType(cat.type); setIsAdding(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-400 hover:text-indigo-500 hover:bg-indigo-500/10 transition-all">
                        <Edit2 size={18} strokeWidth={2.5} />
                      </button>
                      <button onClick={() => setConfirmingDelete(cat.id)} className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all">
                        <Trash2 size={18} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {confirmingDelete === cat.id && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-rose-500/10 p-5 rounded-3xl border border-rose-500/20 text-center space-y-4"
                      >
                         <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Delete this category?</p>
                         <div className="flex gap-2">
                           <button onClick={() => handleDelete(cat.id)} className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-500/20">YES, REMOVE</button>
                           <button onClick={() => setConfirmingDelete(null)} className="flex-1 py-2.5 bg-white dark:bg-white/10 text-zinc-700 dark:text-white rounded-xl text-[10px] font-black uppercase tracking-widest">CANCEL</button>
                         </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex justify-between items-center text-[9px] font-black text-zinc-400 uppercase tracking-widest opacity-60">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-zinc-300"></div>
                      Taxonomy Block
                    </div>
                    {cat.createdAt?.toDate ? cat.createdAt.toDate().toLocaleDateString() : 'System'}
                  </div>
                </div>

                {/* Hover Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
