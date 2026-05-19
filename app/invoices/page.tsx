'use client';

import { ArrowLeft, FileText, Plus, Search, ArrowUpDown, Check, CheckSquare, Trash2, X, Eye, Edit2, LayoutGrid, List, History, Sparkles, Filter } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, writeBatch, doc, getDoc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { logActivity, ActivityAction, EntityType } from '@/lib/activity';
import { useAuth } from '@/components/AuthProvider';
import { useGroup } from '@/components/GroupProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { useCurrency } from '@/components/CurrencyProvider';
import BottomNav from '@/components/BottomNav';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import Dropdown from '@/components/Dropdown';
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

export default function InvoicesList() {
  const { user } = useAuth();
  const { activeGroupId } = useGroup();
  const { t } = useLanguage();
  const { formatAmount } = useCurrency();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  useEffect(() => {
    const savedViewMode = safeStorage.getItem('invoices_view_mode') as 'list' | 'grid';
    if (savedViewMode) setViewMode(savedViewMode);
  }, []);

  const toggleViewMode = () => {
    const newMode = viewMode === 'list' ? 'grid' : 'list';
    setViewMode(newMode);
    safeStorage.setItem('invoices_view_mode', newMode);
  };

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const action = params.get('action');
    if (id || action === 'new') {
      setEditId(id);
      setIsFormOpen(true);
    }
  }, []);

  const closeForm = () => {
    setIsFormOpen(false);
    setEditId(null);
    window.history.replaceState({}, '', window.location.pathname);
    fetchInvoices();
  };

  useEffect(() => {
    if (user) {
      fetchInvoices();
    }
  }, [user, activeGroupId]);

  const fetchInvoices = async () => {
    try {
      if (!user) return;
      const invoicesQuery = query(
        collection(db, 'invoices'),
        where('groupId', '==', activeGroupId ? activeGroupId : user.uid),
        orderBy('createdAt', 'desc')
      );
      const docSnap = await getDocs(invoicesQuery);
      setInvoices(docSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, 'invoices');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (dbId: string) => {
    setSelectedInvoices(prev => 
      prev.includes(dbId) ? prev.filter(id => id !== dbId) : [...prev, dbId]
    );
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!window.confirm(t('deleteWarning'))) return;
    try {
      const invoice = invoices.find(inv => inv.id === id);
      await deleteDoc(doc(db, 'invoices', id));
      
      if (user && invoice) {
        await logActivity({
          groupId: activeGroupId || user.uid,
          userId: user.uid,
          userName: user.displayName || user.email || 'User',
          action: ActivityAction.DELETE,
          entityType: EntityType.INVOICE,
          entityId: id,
          entityName: invoice.invoiceNumber,
          oldValue: invoice
        });
      }

      setInvoices(invoices.filter(inv => inv.id !== id));
      toast.success(t('deleteSuccess'));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'invoices');
      toast.error(t('deleteFailed'));
    }
  };

  const handleBulkMarkAsPaid = async () => {
    if (selectedInvoices.length === 0) return;
    setIsBulkActionLoading(true);
    try {
      const batch = writeBatch(db);
      selectedInvoices.forEach(id => {
        batch.update(doc(db, 'invoices', id), { status: 'Paid' });
      });
      await batch.commit();

      if (user) {
        for (const id of selectedInvoices) {
          const inv = invoices.find(i => i.id === id);
          if (inv) {
            await logActivity({
              groupId: activeGroupId || user.uid,
              userId: user.uid,
              userName: user.displayName || user.email || 'User',
              action: ActivityAction.STATUS_CHANGE,
              entityType: EntityType.INVOICE,
              entityId: id,
              entityName: inv.invoiceNumber,
              oldValue: { status: inv.status },
              newValue: { status: 'Paid' }
            });
          }
        }
      }
      
      // Update local state
      setInvoices(invoices.map(inv => 
        selectedInvoices.includes(inv.id) ? { ...inv, status: 'Paid' } : inv
      ));
      
      setSelectedInvoices([]);
      setIsSelectionMode(false);
      toast.success(t('saveSuccess' as any) || 'Success');
    } catch (e) {
      console.error(e);
      toast.error(t('saveFailed'));
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedInvoices.length === 0) return;
    if (!window.confirm(t('deleteWarning'))) return;
    
    setIsBulkActionLoading(true);
    try {
      const batch = writeBatch(db);
      selectedInvoices.forEach(id => {
        batch.delete(doc(db, 'invoices', id));
      });
      await batch.commit();
      
      // Update local state
      setInvoices(invoices.filter(inv => !selectedInvoices.includes(inv.id)));
      
      setSelectedInvoices([]);
      setIsSelectionMode(false);
      toast.success(t('deleteSuccess'));
    } catch (e) {
      console.error(e);
      toast.error(t('deleteFailed'));
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const handleSort = (field: 'date' | 'amount' | 'status') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setShowSortMenu(false);
  };

  const filteredInvoices = invoices.filter(inv => {
    const queryStr = searchQuery.toLowerCase();
    const invNumber = (inv.invoiceNumber || '').toLowerCase();
    const cName = (inv.clientName || '').toLowerCase();
    return invNumber.includes(queryStr) || cName.includes(queryStr);
  }).sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'date') {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      comparison = dateA - dateB;
    } else if (sortBy === 'amount') {
      comparison = (a.total || 0) - (b.total || 0);
    } else if (sortBy === 'status') {
      comparison = (a.status || '').localeCompare(b.status || '');
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  if (isFormOpen) {
    return <InvoiceForm editId={editId} onSave={closeForm} onCancel={closeForm} />;
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-[#09090B] pb-28">
      {/* Header */}
      <header className="px-5 py-6 space-y-4 bg-white dark:bg-[#0C0C0E] border-b border-zinc-200 dark:border-white/5 relative overflow-hidden">
        <div className="absolute top-[-100px] left-[-100px] w-64 h-64 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex justify-between items-center relative z-10">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-[14px] bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
               <FileText size={22} />
             </div>
             <div>
               <h1 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight leading-none">{t('invoices')}</h1>
               <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-1 flex items-center gap-1.5">
                 <Sparkles size={10} />
                 {filteredInvoices.length} {t('invoices')}
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
              placeholder={(t('searchInvoices' as any) || "Search invoices...") as string} 
              className="w-full bg-white dark:bg-[#141417] border border-zinc-200 dark:border-white/5 rounded-[20px] py-4 pl-12 pr-4 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                 setIsSelectionMode(!isSelectionMode);
                 setSelectedInvoices([]);
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
                    className="absolute right-0 top-[calc(100%+12px)] w-56 bg-white dark:bg-[#1C1C21] border border-zinc-200 dark:border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-50 overflow-hidden py-2"
                  >
                    <div className="px-4 py-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100 dark:border-white/5 mb-2">{t('sort' as any) || "Sort by"}</div>
                    <SortOption label={t('date')} field="date" currentSortBy={sortBy} currentOrder={sortOrder} onClick={() => handleSort('date')} />
                    <SortOption label={t('amount')} field="amount" currentSortBy={sortBy} currentOrder={sortOrder} onClick={() => handleSort('amount')} />
                    <SortOption label={t('status' as any) || 'Status'} field="status" currentSortBy={sortBy} currentOrder={sortOrder} onClick={() => handleSort('status')} />
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
             <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
             <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest animate-pulse">Loading Invoices...</p>
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
            {filteredInvoices.length === 0 ? (
               <div className="text-center py-24 flex flex-col items-center justify-center gap-4">
                 <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-white/5 flex items-center justify-center text-zinc-300 dark:text-zinc-700">
                    <FileText size={32} />
                 </div>
                 <div className="text-zinc-400 text-sm font-black uppercase tracking-widest opacity-50">{t('noInvoices')}</div>
               </div>
            ) : (
              filteredInvoices.map((inv) => (
                <motion.div key={inv.id} variants={itemVariants}>
                  <InvoiceRow 
                    id={inv.invoiceNumber} 
                    name={inv.clientName} 
                    amount={formatAmount(inv.total, inv.currency)} 
                    status={inv.status === 'Paid' ? t('paid') : inv.status === 'Sent' ? t('sent') : inv.status === 'Overdue' ? (t('overdue' as any) || 'Overdue') : t('pending')} 
                    statusColor={inv.status === 'Paid' ? 'text-emerald-500' : inv.status === 'Sent' ? 'text-indigo-500' : inv.status === 'Overdue' ? 'text-rose-500' : 'text-orange-500'} 
                    dotColor={inv.status === 'Paid' ? 'bg-emerald-500' : inv.status === 'Sent' ? 'bg-indigo-500' : inv.status === 'Overdue' ? 'bg-rose-500' : 'bg-orange-500'} 
                    iconColor={inv.status === 'Paid' ? 'text-emerald-500' : inv.status === 'Sent' ? 'text-indigo-500' : inv.status === 'Overdue' ? 'text-rose-500' : 'text-orange-500'} 
                    dbId={inv.id}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedInvoices.includes(inv.id)}
                    onToggle={() => toggleSelection(inv.id)}
                    onEdit={() => { setEditId(inv.id); setIsFormOpen(true); }}
                    onDelete={() => handleDeleteInvoice(inv.id)}
                    viewMode={viewMode}
                  />
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </div>

      <BottomNav />

      {/* Floating Bulk Action Bar */}
      {isSelectionMode && selectedInvoices.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-white dark:bg-[#1C1C21] border border-zinc-200 dark:border-white/10 rounded-full px-4 py-3 shadow-2xl z-50 flex items-center gap-3 w-max">
          <span className="text-sm font-bold text-zinc-900 dark:text-white px-2.5 whitespace-nowrap">{selectedInvoices.length} {(t('selected' as any) || "selected")}</span>
          <button 
            onClick={handleBulkMarkAsPaid} 
            disabled={isBulkActionLoading} 
            className="px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 text-sm font-bold flex items-center gap-2 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
          >
            {isBulkActionLoading ? <span className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></span> : <Check size={16} />} 
            {t('paid')}
          </button>
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

function InvoiceForm({ editId, onSave, onCancel }: { editId: string | null, onSave: () => void, onCancel: () => void }) {
  const { user } = useAuth();
  const { activeGroupId } = useGroup();
  const { t } = useLanguage();
  const { formatAmount, currency: globalCurrency } = useCurrency();
  
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`);
  const [clientName, setClientName] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState(globalCurrency);
  const [status, setStatus] = useState('Pending');
  
  const [items, setItems] = useState([{ name: '', qty: 1, rate: 0 }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false); 
  const [isLoading, setIsLoading] = useState(!!editId);

  const [clients, setClients] = useState<any[]>([]);
  const [showClientList, setShowClientList] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (editId) {
        try {
          const docSnap = await getDoc(doc(db, 'invoices', editId));
          if (docSnap.exists()) {
            const data = docSnap.data();
            setInvoiceNumber(data.invoiceNumber || '');
            setClientName(data.clientName || '');
            setClientAddress(data.clientAddress || '');
            setDate(data.date || '');
            setDueDate(data.dueDate || '');
            if (data.currency) setCurrency(data.currency);
            if (data.status) setStatus(data.status);
            if (data.items) setItems(data.items);
          }
        } catch (e) {
          console.error(e);
        } finally {
          setIsLoading(false);
          setIsLoaded(true);
        }
      } else {
        const savedData = safeStorage.getItem('invoice_draft');
        if (savedData) {
          try {
            const parsed = JSON.parse(savedData);
            if (parsed.invoiceNumber) setInvoiceNumber(parsed.invoiceNumber);
            if (parsed.clientName) setClientName(parsed.clientName);
            if (parsed.clientAddress) setClientAddress(parsed.clientAddress);
            if (parsed.date) setDate(parsed.date);
            if (parsed.dueDate) setDueDate(parsed.dueDate);
            if (parsed.currency) setCurrency(parsed.currency);
            if (parsed.status) setStatus(parsed.status);
            if (parsed.items && parsed.items.length > 0) setItems(parsed.items);
          } catch (e) {
            console.error("Failed to parse invoice draft", e);
          }
        }
        setIsLoaded(true);
      }
      fetchClients();
    };
    fetchData();
  }, [activeGroupId, editId]);

  const fetchClients = async () => {
    if (!activeGroupId) return;
    try {
      const q = query(collection(db, 'clients'), where('groupId', '==', activeGroupId));
      const snap = await getDocs(q);
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Failed to fetch clients", e);
    }
  };

  const handleSelectClient = (client: any) => {
    setClientName(client.name);
    setClientAddress(client.address || '');
    setShowClientList(false);
  };

  useEffect(() => {
    if (isLoaded && !editId) {
      const draftData = { invoiceNumber, clientName, clientAddress, date, dueDate, items, currency, status };
      safeStorage.setItem('invoice_draft', JSON.stringify(draftData));
    }
  }, [invoiceNumber, clientName, clientAddress, date, dueDate, items, isLoaded, editId, currency, status]);

  const subtotal = items.reduce((acc, item) => acc + (item.qty * item.rate), 0);
  const tax = 0;
  const total = subtotal + tax;

  const handleAddItem = () => {
    setItems([...items, { name: '', qty: 1, rate: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSave = async () => {
    if (!user || !clientName || items.length === 0) return;
    setIsSubmitting(true);
    
    try {
      const invoiceId = editId || `inv_${Date.now()}`;
      
      let oldData = null;
      if (editId) {
        const snap = await getDoc(doc(db, 'invoices', editId));
        if (snap.exists()) oldData = snap.data();
      }

      const payload: any = {
        invoiceNumber,
        userId: user.uid,
        groupId: activeGroupId || user.uid,
        clientName,
        clientAddress,
        date,
        dueDate,
        currency,
        subtotal,
        tax,
        total,
        status,
        items: items.map(i => ({ ...i, amount: i.qty * i.rate })),
        updatedAt: serverTimestamp(),
      };

      if (!editId) {
        payload.createdAt = serverTimestamp();
        payload.createdBy = user.displayName || user.email;
      } else {
        payload.editedBy = user.displayName || user.email;
      }
      
      await setDoc(doc(db, 'invoices', invoiceId), payload, { merge: true });

      await logActivity({
        groupId: activeGroupId || user.uid,
        userId: user.uid,
        userName: user.displayName || user.email || 'User',
        action: editId ? ActivityAction.UPDATE : ActivityAction.CREATE,
        entityType: EntityType.INVOICE,
        entityId: invoiceId,
        entityName: invoiceNumber,
        oldValue: oldData,
        newValue: payload
      });

      if (!editId) safeStorage.removeItem('invoice_draft');
      toast.success(editId ? t('invoiceUpdated' as any) : t('invoiceSaved'));
      onSave();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'invoices');
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
            {editId ? t('editInvoice' as any) : t('newInvoice')}
        </h1>
        <div className="w-8"></div>
      </header>

      <div className="px-5 py-4 space-y-6">
        <div className="bg-white dark:bg-[#141417] p-5 rounded-[20px] border border-zinc-200 dark:border-white/5 space-y-4">
          <div>
            <label className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider mb-1 block">{t('invoiceNumber')}</label>
            <input 
              type="text" 
              value={invoiceNumber} 
              onChange={e => setInvoiceNumber(e.target.value)}
              className="w-full bg-black/5 dark:bg-black/20 border border-zinc-300 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          
          <div className="relative">
            <label className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider mb-1 flex items-center justify-between">
              {t('clientName')}
              <button 
                type="button" 
                onClick={() => setShowClientList(true)}
                className="flex items-center gap-1 text-indigo-500 hover:text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-0.5 rounded-full transition-colors"
              >
                <Plus size={10} strokeWidth={3} /> {t('select' as any) || 'Select'}
              </button>
            </label>
            <input 
              type="text" 
              value={clientName} 
              onChange={e => setClientName(e.target.value)}
              className="w-full bg-black/5 dark:bg-black/20 border border-zinc-300 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="e.g. Acme Corp"
            />
            {showClientList && (
              <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                <div className="absolute inset-0 bg-zinc-950/40 dark:bg-black/80 backdrop-blur-sm" onClick={() => setShowClientList(false)}></div>
                <div className="relative bg-white dark:bg-[#141417] w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh] border border-zinc-200 dark:border-white/10">
                  <div className="p-4 border-b border-zinc-200 dark:border-white/10 flex justify-between items-center bg-zinc-50 dark:bg-white/5">
                    <h3 className="font-bold text-zinc-900 dark:text-white">{t('clients')}</h3>
                    <button onClick={() => setShowClientList(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="overflow-y-auto p-2">
                    {clients.length === 0 ? (
                      <div className="p-6 text-center text-sm text-zinc-500">{t('noClients' as any) || 'No clients found.'}</div>
                    ) : (
                      clients.map(client => (
                        <button 
                          key={client.id} 
                          type="button"
                          onClick={() => handleSelectClient(client)}
                          className="w-full text-left px-4 py-3 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-xl transition-colors flex flex-col"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-zinc-900 dark:text-white">{client.name}</span>
                            {client.company && <span className="text-[10px] font-bold text-zinc-400 bg-zinc-100 dark:bg-white/5 px-1.5 py-0.5 rounded">{client.company}</span>}
                          </div>
                          {client.email && <span className="text-[11px] text-zinc-500 mt-0.5">{client.email}</span>}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
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

          <div className="relative z-50">
            <label className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider mb-1 block">{t('currency')}</label>
            <Dropdown
              value={currency}
              onChange={(val) => setCurrency(val as any)}
              options={[
                { label: 'USD ($)', value: 'USD' },
                { label: 'LAK (₭)', value: 'LAK' },
                { label: 'THB (฿)', value: 'THB' },
              ]}
              buttonClassName="w-full bg-black/5 dark:bg-black/20 border-zinc-300 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:ring-indigo-500 font-normal"
            />
          </div>

          <div className="relative z-10">
            <label className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider mb-1 block">{t('status' as any) || 'Status'}</label>
            <Dropdown
              value={status}
              onChange={(val) => setStatus(val)}
              options={[
                { label: 'Pending', value: 'Pending' },
                { label: 'Sent', value: 'Sent' },
                { label: 'Paid', value: 'Paid' },
                { label: 'Overdue', value: 'Overdue' },
              ]}
              buttonClassName="w-full bg-black/5 dark:bg-black/20 border-zinc-300 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:ring-indigo-500 font-normal"
            />
          </div>

          <div>
            <label className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider mb-1 block">{t('address')}</label>
            <textarea 
              value={clientAddress} 
              onChange={e => setClientAddress(e.target.value)}
              rows={2}
              className="w-full bg-black/5 dark:bg-black/20 border border-zinc-300 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none"
              placeholder="Client Address"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-[#141417] p-5 rounded-[20px] border border-zinc-200 dark:border-white/5 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-[13px] font-bold text-zinc-900 dark:text-white tracking-wide uppercase">{t('items')}</h2>
          </div>
          
          {items.map((item, idx) => (
             <div key={idx} className="space-y-3 pb-4 border-b border-zinc-300 dark:border-white/10 relative">
               <input 
                 type="text" 
                 value={item.name} 
                 onChange={e => handleItemChange(idx, 'name', e.target.value)}
                 className="w-full bg-black/5 dark:bg-black/20 border border-zinc-300 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                 placeholder={t('description')}
               />
               <div className="grid grid-cols-2 gap-3">
                 <input 
                   type="number" 
                   value={item.qty} 
                   onChange={e => handleItemChange(idx, 'qty', parseInt(e.target.value) || 0)}
                   className="w-full bg-black/5 dark:bg-black/20 border border-zinc-300 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                   placeholder={t('quantity')}
                 />
                 <input 
                   type="number" 
                   value={item.rate} 
                   onChange={e => handleItemChange(idx, 'rate', parseFloat(e.target.value) || 0)}
                   className="w-full bg-black/5 dark:bg-black/20 border border-zinc-300 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                   placeholder={t('price')}
                 />
               </div>
               {items.length > 1 && (
                 <button onClick={() => handleRemoveItem(idx)} className="absolute -right-2 top-0 p-2 text-rose-500">
                   <Trash2 size={16} />
                 </button>
               )}
             </div>
          ))}

          <button onClick={handleAddItem} className="w-full py-2 flex items-center justify-center gap-2 text-indigo-400 text-sm font-semibold hover:bg-indigo-500/10 rounded-xl transition-colors">
            <Plus size={16} /> {t('add')} {t('items')}
          </button>
        </div>

        <div className="bg-white dark:bg-[#141417] p-5 rounded-[20px] border border-zinc-200 dark:border-white/5">
          <div className="flex justify-between text-[13px] mb-2">
            <span className="text-zinc-600 dark:text-zinc-400 font-medium">{t('subtotal')}</span>
            <span className="text-zinc-900 dark:text-white font-semibold">{formatAmount(subtotal)}</span>
          </div>
          <div className="flex justify-between text-[16px] mt-3 pt-3 border-t border-zinc-300 dark:border-white/10">
            <span className="text-zinc-900 dark:text-white font-bold">{t('total')}</span>
            <span className="text-emerald-500 font-bold">{formatAmount(total)}</span>
          </div>
        </div>

        <button 
          onClick={handleSave} 
          disabled={isSubmitting || !clientName || items.length === 0}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all tracking-wide"
        >
          {isSubmitting ? t('saving') : (editId ? t('save' as any) : t('newInvoice'))}
        </button>
      </div>
    </main>
  );
}

function InvoiceRow({ id, name, amount, status, statusColor, dotColor, iconColor, dbId, isSelectionMode, isSelected, onToggle, onEdit, onDelete, viewMode }: { id: string, name: string, amount: string, status: string, statusColor: string, dotColor: string, iconColor: string, dbId: string, isSelectionMode?: boolean, isSelected?: boolean, onToggle?: () => void, onEdit?: () => void, onDelete?: () => void, viewMode?: 'list' | 'grid' }) {
  if (viewMode === 'grid') {
    return (
      <div className={`p-4 rounded-3xl transition-all relative group overflow-hidden border ${isSelected ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30' : 'bg-white dark:bg-[#141417] border-zinc-200 dark:border-white/5 hover:border-indigo-300 dark:hover:border-indigo-500/30'}`}>
        <div 
          onClick={() => isSelectionMode ? (onToggle && onToggle()) : window.location.href = `/invoices/${dbId}`}
          className="cursor-pointer space-y-3"
        >
          <div className="flex justify-between items-start">
            <div className={`p-2.5 rounded-2xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/5`}>
              <FileText size={20} className={iconColor} />
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
            <div className="font-bold text-sm text-zinc-900 dark:text-white leading-tight truncate">{id}</div>
            <div className="text-[11px] text-zinc-500 mt-1 truncate">{name}</div>
          </div>
          <div className="flex justify-between items-end pt-2">
            <div className="text-lg font-black text-zinc-900 dark:text-white tracking-tight">
              {amount}
            </div>
            <div className={`text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 ${statusColor}`}>
              <span className={`w-1 h-1 rounded-full ${dotColor}`}></span>
              {status}
            </div>
          </div>
        </div>
        
        {!isSelectionMode && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Link href={`/history?type=invoice&id=${dbId}`} className="p-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors">
              <History size={14} />
            </Link>
            <button onClick={(e) => { e.stopPropagation(); onEdit && onEdit(); }} className="p-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors">
              <Edit2 size={14} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete && onDelete(); }} className="p-1.5 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    );
  }

  const content = (
    <>
      <div className="flex items-center gap-3.5 relative">
        {isSelectionMode && onToggle && (
          <button 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
            className={`w-5 h-5 rounded-[6px] border flex-shrink-0 flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'bg-transparent border-zinc-300 dark:border-white/20'}`}
          >
            {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
          </button>
        )}
        <div className={`p-2.5 rounded-[12px] bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/5 group-hover:scale-105 transition-transform ${isSelectionMode ? 'hidden sm:block' : ''}`}>
           <FileText size={20} className={iconColor} />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-[13px] text-zinc-900 dark:text-white leading-tight">{id}</div>
          <div className="text-[11px] text-zinc-500 mt-0.5 truncate">{name}</div>
        </div>
      </div>
      <div className="flex items-center gap-3 text-right">
        <div>
          <div className="font-bold text-[13px] text-zinc-900 dark:text-white leading-tight">{amount}</div>
          <div className={`text-[11px] font-bold uppercase tracking-wider mt-1 flex items-center justify-end gap-1.5 ${statusColor}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ring-2 ring-${dotColor.replace('bg-', '')}/20`}></span>
            {status}
          </div>
        </div>
        {!isSelectionMode && (
          <button 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit && onEdit(); }}
            className="p-2 rounded-lg bg-zinc-100 dark:bg-white/5 text-zinc-400 group-hover:text-indigo-500 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Edit2 size={18} />
          </button>
        )}
      </div>
    </>
  );
  return (
    <div className="relative group overflow-hidden">
      <div 
        onClick={() => isSelectionMode ? (onToggle && onToggle()) : window.location.href = `/invoices/${dbId}`}
        className={`flex items-center justify-between p-3 rounded-[14px] transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-500/5' : 'hover:bg-zinc-200 dark:hover:bg-white/5'}`}
      >
        {content}
      </div>

      {!isSelectionMode && (
        <div className="absolute right-0 top-0 bottom-0 flex items-center translate-x-full group-hover:translate-x-0 transition-transform z-20">
          <Link 
            href={`/invoices/${dbId}`}
            className="h-full px-4 bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-400 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-white/20"
            title="View"
          >
            <Eye size={16} />
          </Link>
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit && onEdit(); }}
            className="h-full px-4 bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-600"
            title="Edit"
          >
            <Edit2 size={16} />
          </button>
          <Link 
            href={`/history?type=invoice&id=${dbId}`}
            className="h-full px-4 bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-600"
            title="History"
          >
            <History size={16} />
          </Link>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete && onDelete(); }}
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
