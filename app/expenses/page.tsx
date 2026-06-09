'use client';

import { ArrowLeft, ReceiptText, Plus, Search, Trash2, Edit2, Eye, ArrowUpDown, Check, CheckSquare, LayoutGrid, List, History, Sparkles, Filter, Download } from 'lucide-react';
import { getDownloadUrl } from '@/lib/utils';
import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy, deleteDoc, doc, setDoc, serverTimestamp, getDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { logActivity, ActivityAction, EntityType } from '@/lib/activity';
import { useAuth } from '@/components/AuthProvider';
import { useGroup } from '@/components/GroupProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { useCurrency } from '@/components/CurrencyProvider';
import BottomNav from '@/components/BottomNav';
import GoogleDriveUpload from '@/components/GoogleDriveUpload';
import { toast } from 'react-hot-toast';
import Dropdown from '@/components/Dropdown';
import { motion, AnimatePresence } from 'motion/react';
import { safeStorage } from '@/lib/storage';

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

export default function ExpensesList() {
  const { user } = useAuth();
  const { activeGroupId } = useGroup();
  const { t } = useLanguage();
  const { formatAmount } = useCurrency();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'name'>('date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedExpenses, setSelectedExpenses] = useState<string[]>([]);
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');

  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(expenses.map(e => e.category).filter(Boolean)));
  }, [expenses]);

  const uniqueCurrencies = useMemo(() => {
    return Array.from(new Set(expenses.map(e => e.currency).filter(Boolean)));
  }, [expenses]);
  
  useEffect(() => {
    const savedViewMode = safeStorage.getItem('expenses_view_mode') as 'list' | 'grid';
    if (savedViewMode) setViewMode(savedViewMode);
  }, []);

  const toggleViewMode = () => {
    const newMode = viewMode === 'list' ? 'grid' : 'list';
    setViewMode(newMode);
    safeStorage.setItem('expenses_view_mode', newMode);
  };
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  const [expenseToDelete, setExpenseToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchExpenses();
    }
  }, [user, activeGroupId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const action = params.get('action');
    if (id || action === 'new') {
      setEditId(id);
      setIsFormOpen(true);
    }
  }, []);

  const fetchExpenses = async () => {
    try {
      if (!user) return;
      const expenseQuery = query(
        collection(db, 'expenses'),
        where('groupId', '==', activeGroupId ? activeGroupId : user.uid),
        orderBy('createdAt', 'desc')
      );
      const docSnap = await getDocs(expenseQuery);
      setExpenses(docSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, 'expenses');
    } finally {
      setLoading(false);
    }
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setIsViewOpen(false);
    setEditId(null);
    setViewId(null);
    window.history.replaceState({}, '', window.location.pathname);
    fetchExpenses();
  };

  const toggleSelection = (id: string) => {
    setSelectedExpenses(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedExpenses.length === 0) return;
    if (!window.confirm(t('deleteWarning'))) return;
    
    setIsBulkActionLoading(true);
    try {
      const batch = writeBatch(db);
      selectedExpenses.forEach(id => {
        batch.delete(doc(db, 'expenses', id));
      });
      await batch.commit();

      if (user) {
        for (const id of selectedExpenses) {
          const exp = expenses.find(e => e.id === id);
          if (exp) {
            await logActivity({
              groupId: activeGroupId || user.uid,
              userId: user.uid,
              userName: user.displayName || user.email || 'User',
              action: ActivityAction.DELETE,
              entityType: EntityType.EXPENSE,
              entityId: id,
              entityName: exp.name,
              oldValue: exp
            });
          }
        }
      }
      
      setExpenses(expenses.filter(exp => !selectedExpenses.includes(exp.id)));
      setSelectedExpenses([]);
      setIsSelectionMode(false);
      toast.success(t('deleteSuccess'));
    } catch (e) {
      console.error(e);
      toast.error(t('deleteFailed'));
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const handleSort = (field: 'date' | 'amount' | 'name') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setShowSortMenu(false);
  };

  const filteredExpenses = expenses.filter(exp => {
    const queryStr = searchQuery.toLowerCase();
    const name = (exp.name || '').toLowerCase();
    const category = (exp.category || '').toLowerCase();
    const matchesSearch = name.includes(queryStr) || category.includes(queryStr);
    const matchesCategory = !categoryFilter || exp.category === categoryFilter;
    const matchesCurrency = !currencyFilter || exp.currency === currencyFilter;
    return matchesSearch && matchesCategory && matchesCurrency;
  }).sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'date') {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      comparison = dateA - dateB;
    } else if (sortBy === 'amount') {
      comparison = (a.amount || 0) - (b.amount || 0);
    } else if (sortBy === 'name') {
      comparison = (a.name || '').localeCompare(b.name || '');
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleDelete = async () => {
    if (!expenseToDelete) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'expenses', expenseToDelete.id));

      if (user && expenseToDelete) {
        await logActivity({
          groupId: activeGroupId || user.uid,
          userId: user.uid,
          userName: user.displayName || user.email || 'User',
          action: ActivityAction.DELETE,
          entityType: EntityType.EXPENSE,
          entityId: expenseToDelete.id,
          entityName: expenseToDelete.name,
          oldValue: expenseToDelete
        });
      }

      setExpenses(expenses.filter(e => e.id !== expenseToDelete.id));
      setExpenseToDelete(null);
      toast.success(t('deleteSuccess'));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'expenses');
      toast.error(t('deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  if (isFormOpen) {
    return <ExpenseForm editId={editId} onSave={closeForm} onCancel={closeForm} />;
  }

  if (isViewOpen) {
    return <ExpenseDetails id={viewId!} onClose={closeForm} onEdit={() => { setIsViewOpen(false); setIsFormOpen(true); setEditId(viewId); }} />;
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-[#09090B] pb-28">
      {/* Header */}
      <header className="px-5 py-6 space-y-4 bg-white dark:bg-[#0C0C0E] border-b border-zinc-200 dark:border-white/5 relative overflow-hidden">
        <div className="absolute top-[-100px] left-[-100px] w-64 h-64 bg-rose-500/5 dark:bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex justify-between items-center relative z-10">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-[14px] bg-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
               <ReceiptText size={22} />
             </div>
             <div>
               <h1 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight leading-none">{t('expense')}</h1>
               <div className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mt-1 flex items-center gap-1.5">
                 <Sparkles size={10} />
                 {filteredExpenses.length} {t('expense')}
               </div>
             </div>
          </div>
          <button 
            onClick={() => setIsFormOpen(true)}
            className="w-10 h-10 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-md group"
          >
            <Plus size={24} className="group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>
      </header>

      <div className="px-5 py-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={(t('searchExpenses' as any) || "Search expenses...") as string} 
              className="w-full bg-white dark:bg-[#141417] border border-zinc-200 dark:border-white/5 rounded-[20px] py-4 pl-12 pr-4 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                 setIsSelectionMode(!isSelectionMode);
                 setSelectedExpenses([]);
              }}
              className={`p-4 h-14 w-14 rounded-[20px] transition-all flex items-center justify-center shadow-sm ${isSelectionMode ? 'bg-indigo-600 text-white shadow-indigo-500/20' : 'bg-white dark:bg-[#141417] border border-zinc-200 dark:border-white/5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
            >
              <CheckSquare size={20} />
            </button>
            
            <div className="relative">
              <button 
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="px-6 py-4 h-14 bg-white dark:bg-[#141417] border border-zinc-200 dark:border-white/5 rounded-[20px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all flex items-center justify-center gap-3 text-sm font-black uppercase tracking-tighter shadow-sm"
              >
                <Filter size={18} />
                <span className="hidden sm:inline">{(t('sort' as any) || "Sort") as string}</span>
              </button>

              {showSortMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)}></div>
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="absolute right-0 top-[calc(100%+12px)] w-60 max-h-[70vh] overflow-y-auto bg-white dark:bg-[#1C1C21] border border-zinc-200 dark:border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-50 py-2"
                  >
                    <div className="px-4 py-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100 dark:border-white/5 mb-2">{t('sort' as any) || "Sort by"}</div>
                    <SortOption label={t('date')} field="date" currentSortBy={sortBy} currentOrder={sortOrder} onClick={() => handleSort('date')} />
                    <SortOption label={t('amount')} field="amount" currentSortBy={sortBy} currentOrder={sortOrder} onClick={() => handleSort('amount')} />
                    <SortOption label={t('description')} field="name" currentSortBy={sortBy} currentOrder={sortOrder} onClick={() => handleSort('name')} />

                    <div className="px-4 py-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest border-t border-b border-zinc-100 dark:border-white/5 mt-2 mb-2">{t('filterByCategory')}</div>
                    <button 
                      onClick={() => { setCategoryFilter(''); setShowSortMenu(false); }}
                      className={`w-full text-left px-4 py-2 text-xs flex justify-between hover:bg-zinc-200 dark:hover:bg-white/5 ${!categoryFilter ? 'text-indigo-400 font-medium' : 'text-zinc-600 dark:text-zinc-400'}`}
                    >
                      {t('allCategories' as any) || 'All Categories'}
                      {!categoryFilter && <Check size={12} />}
                    </button>
                    {uniqueCategories.map(cat => (
                      <button 
                        key={cat}
                        onClick={() => { setCategoryFilter(cat); setShowSortMenu(false); }}
                        className={`w-full text-left px-4 py-2 text-xs flex justify-between hover:bg-zinc-200 dark:hover:bg-white/5 ${categoryFilter === cat ? 'text-indigo-400 font-medium' : 'text-zinc-600 dark:text-zinc-400'}`}
                      >
                        {cat}
                        {categoryFilter === cat && <Check size={12} />}
                      </button>
                    ))}

                    <div className="px-4 py-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest border-t border-b border-zinc-100 dark:border-white/5 mt-2 mb-2">{t('filterByCurrency')}</div>
                    <button 
                      onClick={() => { setCurrencyFilter(''); setShowSortMenu(false); }}
                      className={`w-full text-left px-4 py-2 text-xs flex justify-between hover:bg-zinc-200 dark:hover:bg-white/5 ${!currencyFilter ? 'text-indigo-400 font-medium' : 'text-zinc-600 dark:text-zinc-400'}`}
                    >
                      {t('allCurrencies')}
                      {!currencyFilter && <Check size={12} />}
                    </button>
                    {uniqueCurrencies.map(curr => (
                      <button 
                        key={curr}
                        onClick={() => { setCurrencyFilter(curr); setShowSortMenu(false); }}
                        className={`w-full text-left px-4 py-2 text-xs flex justify-between hover:bg-zinc-200 dark:hover:bg-white/5 ${currencyFilter === curr ? 'text-indigo-400 font-medium' : 'text-zinc-600 dark:text-zinc-400'}`}
                      >
                        {curr}
                        {currencyFilter === curr && <Check size={12} />}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </div>

            <button 
              onClick={toggleViewMode}
              className="p-4 h-14 w-14 bg-white dark:bg-[#141417] border border-zinc-200 dark:border-white/5 rounded-[20px] text-zinc-500 hover:text-zinc-900 transition-all flex items-center justify-center shadow-sm"
            >
              {viewMode === 'list' ? <LayoutGrid size={20} /> : <List size={20} />}
            </button>
          </div>
        </div>

        {loading ? (
           <div className="flex flex-col items-center justify-center py-24 gap-4">
             <div className="w-10 h-10 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin"></div>
             <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest animate-pulse">Loading Expenses...</p>
           </div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className={viewMode === 'list' 
              ? "bg-white dark:bg-[#141417] rounded-[32px] p-2 border border-zinc-200 dark:border-white/5 shadow-sm space-y-1" 
              : "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6"
            }
          >
            {filteredExpenses.length === 0 ? (
               <div className="text-center py-24 flex flex-col items-center justify-center gap-4">
                 <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-white/5 flex items-center justify-center text-rose-300 dark:text-rose-700">
                    <ReceiptText size={32} />
                 </div>
                 <div className="text-zinc-400 text-sm font-black uppercase tracking-widest opacity-50">{t('noExpenses')}</div>
               </div>
            ) : (
              filteredExpenses.map((exp) => (
                <motion.div key={exp.id} variants={itemVariants}>
                  <ExpenseRow 
                    id={exp.id}
                    name={exp.name} 
                    amount={`-${formatAmount(exp.amount, exp.currency)}`} 
                    date={exp.date}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedExpenses.includes(exp.id)}
                    onToggle={() => toggleSelection(exp.id)}
                    onView={() => { setViewId(exp.id); setIsViewOpen(true); }}
                    onEdit={() => { setEditId(exp.id); setIsFormOpen(true); }}
                    onDelete={() => setExpenseToDelete(exp)}
                    viewMode={viewMode}
                  />
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/60 dark:bg-black/60 backdrop-blur-sm p-5">
          <div className="bg-white dark:bg-[#141417] border border-zinc-300 dark:border-white/10 rounded-[24px] p-6 w-full max-sm-sm">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">{t('deleteExpenseQuery')}</h3>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-6 leading-relaxed">{t('deleteWarning')}</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setExpenseToDelete(null)}
                disabled={deleting}
                className="flex-1 px-4 py-3 rounded-xl bg-zinc-100 dark:bg-white/5 hover:bg-zinc-300 dark:hover:bg-white/10 text-zinc-900 dark:text-white text-sm font-bold transition-colors disabled:opacity-50"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Trash2 size={16} />
                    {t('delete')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />

      {/* Floating Bulk Action Bar */}
      {isSelectionMode && selectedExpenses.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-white dark:bg-[#1C1C21] border border-zinc-200 dark:border-white/10 rounded-full px-4 py-3 shadow-2xl z-50 flex items-center gap-3 w-max">
          <span className="text-sm font-bold text-zinc-900 dark:text-white px-2.5 whitespace-nowrap">{selectedExpenses.length} {(t('selected' as any) || "selected")}</span>
          <button 
            onClick={handleBulkDelete} 
            disabled={isBulkActionLoading} 
            className="px-4 py-2 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-500 text-sm font-bold flex items-center gap-2 hover:bg-rose-500/20 transition-colors disabled:opacity-50"
          >
            {isBulkActionLoading ? <span className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></span> : <Trash2 size={16} />} 
            {t('delete')}
          </button>
        </div>
      )}
    </main>
  );
}

function SortOption({ label, field, currentSortBy, currentOrder, onClick }: { label: string, field: string, currentSortBy: string, currentOrder: string, onClick: () => void }) {
  const isActive = currentSortBy === field;
  return (
    <button 
      onClick={onClick}
      className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-zinc-200 dark:hover:bg-white/5 transition-colors ${isActive ? 'text-indigo-400 font-medium' : 'text-zinc-700 dark:text-zinc-300'}`}
    >
      {label}
      {isActive && (
        <span className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] uppercase font-bold tracking-wider">{currentOrder === 'asc' ? '↑' : '↓'}</span>
          <Check size={14} />
        </span>
      )}
    </button>
  );
}

function ExpenseDetails({ id, onClose, onEdit }: { id: string, onClose: () => void, onEdit: () => void }) {
  const { t } = useLanguage();
  const { formatAmount } = useCurrency();
  const [expense, setExpense] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExpense = async () => {
      try {
        const docRef = doc(db, 'expenses', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setExpense(docSnap.data());
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchExpense();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#09090B]">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!expense) return null;

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-[#09090B] pb-10">
      <header className="px-5 py-4 flex justify-between items-center bg-white/80 dark:bg-[#0C0C0E]/80 backdrop-blur-md sticky top-0 z-40 border-b border-zinc-200 dark:border-white/5">
        <button onClick={onClose} className="text-zinc-700 dark:text-zinc-300 p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-white/5 transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-[16px] font-bold text-zinc-900 dark:text-white tracking-tight">
          {t('expenseDetails')}
        </h1>
        <button onClick={onEdit} className="text-indigo-500 p-2 rounded-full hover:bg-indigo-500/10 transition-colors">
          <Edit2 size={20} />
        </button>
      </header>

      <div className="px-5 py-6 space-y-6">
        <div className="bg-white dark:bg-[#141417] rounded-[24px] border border-zinc-200 dark:border-white/5 overflow-hidden shadow-sm relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500"></div>
          
          <div className="p-8 text-center space-y-2 border-b border-zinc-100 dark:border-white/5">
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <ReceiptText size={32} className="text-rose-500" />
            </div>
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
              {formatAmount(expense.amount, expense.currency)}
            </h2>
            <p className="text-sm font-semibold text-zinc-500 uppercase tracking-widest">{expense.category}</p>
          </div>

          <div className="p-8 space-y-6">
            <div className="space-y-6">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t('description')}</p>
                <p className="text-sm font-semibold text-zinc-900 dark:text-white leading-relaxed">{expense.name}</p>
              </div>

              {expense.paymentMethod && (
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t('paymentMethod') || 'Payment Method'}</p>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                    {expense.paymentMethod === 'cash' ? (t('cash') || 'Cash') : (t('bankTransfer') || 'Bank Transfer')}
                  </p>
                </div>
              )}

              {expense.notes && (
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t('notes') || 'Notes'}</p>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white leading-relaxed whitespace-pre-wrap">{expense.notes}</p>
                </div>
              )}

              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t('date')}</p>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">{expense.date}</p>
                </div>
                {expense.updatedAt && (
                  <div className="text-right pl-4">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t('modifiedDate')}</p>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                      {expense.updatedAt?.toDate ? expense.updatedAt.toDate().toLocaleString() : new Date(expense.updatedAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t('createdBy')}</p>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">{expense.createdBy || 'User'}</p>
                </div>
                {expense.editedBy && (
                  <div className="text-right pl-4">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t('editedBy')}</p>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">{expense.editedBy}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t('id')}</p>
                  <p className="text-[10px] font-mono text-zinc-500 truncate pr-4">{id}</p>
                </div>
                <div className="text-right pl-4">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t('status')}</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-wider">
                    {t('completed')}
                  </span>
                </div>
              </div>
            </div>

            {expense.attachmentUrl && (
              <div className="pt-6 border-t border-zinc-100 dark:border-white/5">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">{t('attachment')}</p>
                <div className="bg-zinc-50 dark:bg-black/20 rounded-2xl p-4 flex items-center justify-between group/link border border-zinc-200 dark:border-white/5 transition-all hover:bg-zinc-100 dark:hover:bg-black/30">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500">
                      <ReceiptText size={18} />
                    </div>
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{t('download')}</span>
                  </div>
                  <a 
                    href={getDownloadUrl(expense.attachmentUrl)} 
                    download
                    className="p-2 bg-indigo-500 text-white rounded-lg transition-all hover:scale-110 active:scale-95"
                    title={t('download') as string}
                  >
                    <Download size={14} />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full bg-white dark:bg-[#141417] border border-zinc-200 dark:border-white/5 py-4 rounded-2xl text-zinc-900 dark:text-white font-bold text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-white/10"
        >
          {t('back')}
        </button>
      </div>
    </main>
  );
}

function ExpenseForm({ editId, onSave, onCancel }: { editId: string | null, onSave: () => void, onCancel: () => void }) {
  const { user } = useAuth();
  const { activeGroupId } = useGroup();
  const { t } = useLanguage();
  const { currency: globalCurrency } = useCurrency();
  
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [currency, setCurrency] = useState(globalCurrency);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bankTransfer'>('cash');
  const [notes, setNotes] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(!!editId);

  useEffect(() => {
    const fetchCats = async () => {
      if (!user) return;
      try {
        const q = query(collection(db, 'categories'), where('userId', '==', user.uid), where('type', '==', 'Expense'));
        const snap = await getDocs(q);
        const filtered = snap.docs.map(d => ({ id: d.id, ...d.data() } as any))
          .filter((c: any) => c.groupId === activeGroupId || !c.groupId);
        setCustomCategories(filtered);
        
        if (!editId && filtered.length > 0) {
          setCategory(filtered[0].name);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchCats();
  }, [activeGroupId, user, editId]);

  useEffect(() => {
    if (editId) {
      const fetchExpense = async () => {
        try {
          const docRef = doc(db, 'expenses', editId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setName(data.name || '');
            setAmount(data.amount?.toString() || '');
            setCategory(data.category || '');
            setDate(data.date || new Date().toISOString().split('T')[0]);
            if (data.currency) setCurrency(data.currency);
            if (data.paymentMethod) setPaymentMethod(data.paymentMethod);
            setNotes(data.notes || '');
            setAttachmentUrl(data.attachmentUrl || null);
          }
        } catch (error) {
          console.error("Error fetching expense:", error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchExpense();
    }
  }, [editId]);

  const handleSave = async () => {
    if (!user || !name || !amount) return;
    setIsSubmitting(true);
    
    try {
      const expenseId = editId || `exp_${Date.now()}`;
      
      let oldData = null;
      if (editId) {
        const snap = await getDoc(doc(db, 'expenses', editId));
        if (snap.exists()) oldData = snap.data();
      }

      const payload: any = {
        userId: user.uid,
        groupId: activeGroupId || user.uid,
        name,
        amount: parseFloat(amount),
        category,
        date,
        currency,
        paymentMethod,
        notes,
        attachmentUrl: attachmentUrl || null,
        updatedAt: serverTimestamp(),
      };

      if (!editId) {
        payload.createdAt = serverTimestamp();
        payload.createdBy = user.displayName || user.email;
      } else {
        payload.editedBy = user.displayName || user.email;
      }
      
      await setDoc(doc(db, 'expenses', expenseId), payload, { merge: true });

      await logActivity({
        groupId: activeGroupId || user.uid,
        userId: user.uid,
        userName: user.displayName || user.email || 'User',
        action: editId ? ActivityAction.UPDATE : ActivityAction.CREATE,
        entityType: EntityType.EXPENSE,
        entityId: expenseId,
        entityName: name,
        oldValue: oldData,
        newValue: payload
      });

      toast.success(editId ? t('expenseUpdated' as any) : t('expenseSaved'));
      onSave();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'expenses');
      toast.error(t('saveFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#09090B]">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-[#09090B] pb-10">
      <header className="px-5 py-4 flex justify-between items-center bg-white/80 dark:bg-[#0C0C0E]/80 backdrop-blur-md sticky top-0 z-40 border-b border-zinc-200 dark:border-white/5">
        <button onClick={onCancel} className="text-zinc-700 dark:text-zinc-300 p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-white/5 transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-[16px] font-bold text-zinc-900 dark:text-white tracking-tight">
          {editId ? t('editExpense' as any) : t('addExpense')}
        </h1>
        <div className="w-8"></div>
      </header>

      <div className="px-5 py-4 space-y-6">
        <div className="bg-white dark:bg-[#141417] p-5 rounded-[20px] border border-zinc-200 dark:border-white/5 space-y-4">
          <div>
            <label className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider mb-1 block">{t('description')}</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)}
              className="w-full bg-black/5 dark:bg-black/20 border border-zinc-300 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder={t('expensePlaceholder')}
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider mb-1 block">{t('amount')}</label>
              <input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(e.target.value)}
                className="w-full bg-black/5 dark:bg-black/20 border border-zinc-300 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder={`${currency} 0.00`}
              />
            </div>

            <div className="w-[124px] relative z-25">
              <label className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider mb-1 block">{t('currency')}</label>
              <Dropdown
                value={currency}
                onChange={(val) => setCurrency(val as any)}
                options={[
                  { label: 'USD ($)', value: 'USD' },
                  { label: 'LAK (₭)', value: 'LAK' },
                  { label: 'THB (฿)', value: 'THB' },
                ]}
                buttonClassName="w-full bg-black/5 dark:bg-black/20 border-zinc-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-zinc-900 dark:text-white focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="relative z-20">
            <label className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider mb-1 block">{t('category')}</label>
            <Dropdown
              value={category}
              onChange={(val) => setCategory(val)}
              options={
                customCategories.length === 0
                  ? []
                  : customCategories.map((cat) => ({ label: cat.name, value: cat.name }))
              }
              placeholder={t('selectCategory' as any) || 'Select Category'}
              buttonClassName="w-full bg-black/5 dark:bg-black/20 border-zinc-300 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:ring-indigo-500 font-normal"
            />
          </div>

          <div className="relative z-10">
            <label className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider mb-1 block">{t('paymentMethod')}</label>
            <Dropdown
              value={paymentMethod}
              onChange={(val) => setPaymentMethod(val as any)}
              options={[
                { label: t('cash') || 'Cash', value: 'cash' },
                { label: t('bankTransfer') || 'Bank Transfer', value: 'bankTransfer' },
              ]}
              buttonClassName="w-full bg-black/5 dark:bg-black/20 border-zinc-300 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:ring-indigo-500 font-normal"
            />
          </div>

          <div>
            <label className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider mb-1 block">{t('date')}</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)}
              className="w-full bg-black/5 dark:bg-black/20 border border-zinc-300 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider mb-1 block">{t('notes')}</label>
            <textarea 
              value={notes} 
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-black/5 dark:bg-black/20 border border-zinc-300 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
              placeholder={t('notesPlaceholder') || 'Add details...'}
              rows={3}
            />
          </div>

          <GoogleDriveUpload onUploadSuccess={(url) => setAttachmentUrl(url)} />
        </div>

        <button 
          onClick={handleSave} 
          disabled={isSubmitting || !name || !amount}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-colors tracking-wide"
        >
          {isSubmitting ? t('saving') : (editId ? t('save' as any) : t('saveExpense'))}
        </button>
      </div>
    </main>
  );
}

function ExpenseRow({ id, name, amount, date, onView, onEdit, onDelete, isSelectionMode, isSelected, onToggle, viewMode }: { id: string, name: string, amount: string, date: string, onView: () => void, onEdit: () => void, onDelete: () => void, isSelectionMode?: boolean, isSelected?: boolean, onToggle?: () => void, viewMode?: 'list' | 'grid' }) {
  if (viewMode === 'grid') {
    return (
      <div className={`p-4 rounded-3xl transition-all relative group overflow-hidden border ${isSelected ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30' : 'bg-white dark:bg-[#141417] border-zinc-200 dark:border-white/5 hover:border-indigo-300 dark:hover:border-indigo-500/30'}`}>
        <div 
          onClick={() => isSelectionMode ? (onToggle && onToggle()) : onView()}
          className="cursor-pointer space-y-3"
        >
          <div className="flex justify-between items-start">
            <div className={`p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20`}>
              <ReceiptText size={20} className="text-rose-500" />
            </div>
            {isSelectionMode && onToggle && (
              <button 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
                className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'bg-transparent border-zinc-300 dark:border-white/20'}`}
              >
                {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
              </button>
            )}
          </div>
          <div>
            <div className="font-bold text-sm text-zinc-900 dark:text-white leading-tight truncate">{name}</div>
            <div className="text-[11px] text-zinc-500 mt-1">{date}</div>
          </div>
          <div className="text-lg font-black text-rose-500 tracking-tight">
            {amount}
          </div>
        </div>
        
        {!isSelectionMode && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Link href={`/history?type=expense&id=${id}`} className="p-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors">
              <History size={14} />
            </Link>
            <button onClick={onEdit} className="p-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors">
              <Edit2 size={14} />
            </button>
            <button onClick={onDelete} className="p-1.5 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-between p-3 rounded-[14px] transition-colors group relative overflow-hidden ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-500/5' : 'hover:bg-zinc-200 dark:hover:bg-white/5'}`}>
      <div 
        onClick={() => {
          if (isSelectionMode) {
            onToggle && onToggle();
          } else {
            onView();
          }
        }}
        className={`flex items-center gap-3.5 relative z-10 w-full ${isSelectionMode ? 'cursor-pointer' : 'cursor-pointer'}`}
      >
        {isSelectionMode && onToggle && (
          <button 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
            className={`w-5 h-5 rounded-[6px] border flex-shrink-0 flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'bg-transparent border-zinc-300 dark:border-white/20'}`}
          >
            {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
          </button>
        )}
        <div className={`p-2.5 rounded-[12px] bg-rose-500/10 border border-rose-500/20 group-hover:scale-105 transition-transform ${isSelectionMode ? 'hidden sm:block' : ''}`}>
           <ReceiptText size={20} className="text-rose-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[13px] text-zinc-900 dark:text-white leading-tight truncate">{name}</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">{date}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`font-bold text-[13px] text-rose-500 leading-tight whitespace-nowrap transition-transform ${!isSelectionMode ? 'group-hover:-translate-x-20' : ''}`}>
            {amount}
          </div>
          {!isSelectionMode && (
            <div className="p-2 rounded-lg bg-zinc-100 dark:bg-white/5 text-zinc-400 group-hover:text-indigo-500 transition-all opacity-100 group-hover:opacity-0">
              <Eye size={18} />
            </div>
          )}
        </div>
      </div>
      
      {!isSelectionMode && (
        <div className="absolute right-0 top-0 bottom-0 flex items-center translate-x-full group-hover:translate-x-0 transition-transform z-20">
          <button 
            onClick={onView}
            className="h-full px-4 bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-400 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-white/20"
            title="View"
          >
            <Eye size={16} />
          </button>
          <button 
            onClick={onEdit}
            className="h-full px-4 bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-600"
            title="Edit"
          >
            <Edit2 size={16} />
          </button>
          <Link 
            href={`/history?type=expense&id=${id}`}
            className="h-full px-4 bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-600"
            title="History"
          >
            <History size={16} />
          </Link>
          <button 
            onClick={onDelete}
            className="h-full px-4 bg-rose-500 text-white flex items-center justify-center hover:bg-rose-600"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
