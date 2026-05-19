'use client';

import { ArrowLeft, Plus, Trash2, Edit2, Check, Sparkles, Bookmark, FileText, X, Tags } from 'lucide-react';
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

export default function DocumentCategoriesManager() {
  const router = useRouter();
  const { user } = useAuth();
  const { activeGroupId } = useGroup();
  const { t, language } = useLanguage();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNameLo, setEditNameLo] = useState('');
  
  const [isAdding, setIsAdding] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      if (!user) return;
      const q = query(
        collection(db, 'categories'), 
        where('groupId', '==', activeGroupId || user.uid),
        where('type', '==', 'Document')
      );
      
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      setCategories(docs.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')));
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
      const catId = id || `cat_doc_${Date.now()}`;
      const payload: any = {
        name: editName,
        nameLo: editNameLo,
        type: 'Document',
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
        <div className="absolute top-[-100px] right-[-100px] w-64 h-64 bg-amber-500/5 dark:bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
             <Link href="/documents" className="w-10 h-10 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-all">
                <ArrowLeft size={18} />
             </Link>
             <div>
               <h1 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight leading-none">{t('documentCategories' as any) || 'Document Categories'}</h1>
               <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mt-1 flex items-center gap-1.5">
                 <Sparkles size={10} />
                 {t('fileOrganization' as any) || 'File Organization'}
               </div>
             </div>
          </div>
          <button onClick={() => { setIsAdding(true); setEditName(''); setEditNameLo(''); setIsEditing(null); }} className="w-10 h-10 bg-amber-500 dark:bg-amber-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all">
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
              <div className="bg-white dark:bg-[#0C0C0E] p-8 rounded-[40px] border-2 border-amber-500/20 dark:border-amber-500/30 space-y-8 shadow-2xl shadow-amber-500/10 relative">
                <button 
                  onClick={() => { setIsAdding(false); setIsEditing(null); }}
                  className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
                
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                    {isAdding ? <Plus size={24} strokeWidth={2.5} /> : <Edit2 size={24} strokeWidth={2.5} />}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">
                      {isAdding ? t('addCategory' as any) || "Add Category" : t('edit')}
                    </h2>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">{t('documentCategory' as any) || 'Document Category'}</p>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">{t('categoryName')} (EN)</label>
                    <input 
                      value={editName} 
                      onChange={e => setEditName(e.target.value)} 
                      placeholder="e.g. Invoices" 
                      className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-[20px] px-5 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-amber-500/5 focus:border-amber-500 transition-all" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">{t('categoryName')} (LO)</label>
                    <input 
                      value={editNameLo} 
                      onChange={e => setEditNameLo(e.target.value)} 
                      placeholder="ຕົວຢ່າງ: ໃບເກັບເງິນ" 
                      className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-[20px] px-5 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-amber-500/5 focus:border-amber-500 transition-all" 
                    />
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
            <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest animate-pulse">Syncing categories...</p>
          </div>
        ) : categories.length === 0 && !isAdding ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-[#0C0C0E] p-16 rounded-[40px] border border-zinc-200 dark:border-white/5 text-center space-y-6"
          >
             <div className="w-24 h-24 bg-zinc-50 dark:bg-white/5 rounded-[40px] flex items-center justify-center mx-auto text-zinc-300">
               <Tags size={48} strokeWidth={1.5} />
             </div>
             <div>
               <h3 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight">{t('noCategories')}</h3>
               <p className="text-xs text-zinc-500 font-medium mt-1">Organize your documents efficiently.</p>
             </div>
             <button onClick={() => { setIsAdding(true); setEditName(''); }} className="bg-amber-500 hover:bg-amber-400 text-white px-8 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-amber-500/20 transition-all">
               + {t('addCategory' as any) || 'Create Category'}
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
                className="group bg-white dark:bg-[#0C0C0E] p-6 rounded-[32px] border border-zinc-200 dark:border-white/5 relative overflow-hidden transition-all hover:translate-y-[-4px] hover:shadow-xl hover:shadow-amber-500/5"
              >
                <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity duration-700 pointer-events-none group-hover:scale-150 transform transition-transform duration-1000">
                  <FileText size={120} strokeWidth={1} />
                </div>

                <div className="flex flex-col gap-6 relative z-10">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-black text-lg text-zinc-900 dark:text-white tracking-tight leading-tight group-hover:text-amber-500 transition-colors uppercase">
                        {(language === 'lo' && cat.nameLo) ? cat.nameLo : cat.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-lg group-hover:animate-pulse"></div>
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-500">
                          {t('documents')}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 bg-zinc-50 dark:bg-white/5 p-1 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setIsEditing(cat.id); setEditName(cat.name); setEditNameLo(cat.nameLo || ''); setIsAdding(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-400 hover:text-amber-500 hover:bg-amber-500/10 transition-all">
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
                         <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">{t('deleteConfirm' as any) || 'Delete this category?'}</p>
                         <div className="flex gap-2">
                           <button onClick={() => handleDelete(cat.id)} className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-500/20">{t('confirm' as any) || 'YES'}</button>
                           <button onClick={() => setConfirmingDelete(null)} className="flex-1 py-2.5 bg-white dark:bg-white/10 text-zinc-700 dark:text-white rounded-xl text-[10px] font-black uppercase tracking-widest">{t('cancel')}</button>
                         </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex justify-between items-center text-[9px] font-black text-zinc-400 uppercase tracking-widest opacity-60">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-zinc-300"></div>
                      Document Type
                    </div>
                    {cat.createdAt?.toDate ? cat.createdAt.toDate().toLocaleDateString() : 'System'}
                  </div>
                </div>

                {/* Hover Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
