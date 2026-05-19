'use client';

import { ArrowLeft, Plus, Trash2, Edit2, Phone, Mail, MapPin, User, Search, History, Sparkles, X, Check, Users, LayoutGrid, List } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { logActivity, ActivityAction, EntityType } from '@/lib/activity';
import { useAuth } from '@/components/AuthProvider';
import { useGroup } from '@/components/GroupProvider';
import { safeStorage } from '@/lib/storage';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/components/LanguageProvider';
import { motion, AnimatePresence } from 'motion/react';
import BottomNav from '@/components/BottomNav';
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

export default function ClientsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { activeGroupId } = useGroup();
  const { t } = useLanguage();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  
  useEffect(() => {
    const savedViewMode = safeStorage.getItem('clients_view_mode') as 'list' | 'grid';
    if (savedViewMode) setViewMode(savedViewMode);
  }, []);

  const toggleViewMode = () => {
    const newMode = viewMode === 'list' ? 'grid' : 'list';
    setViewMode(newMode);
    safeStorage.setItem('clients_view_mode', newMode);
  };
  
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    address: '',
    clientGroup: ''
  });

  useEffect(() => {
    if (user) {
      fetchClients();
    }
  }, [user, activeGroupId]);

  const fetchClients = async () => {
    try {
      const q = query(collection(db, 'clients'), where('groupId', '==', activeGroupId || user?.uid));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setClients(data);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'clients');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (id: string | null) => {
    if (!formData.name.trim()) {
      toast.error(t('clientName'));
      return;
    }
    
    try {
      const clientId = id || `client_${Date.now()}`;
      
      let oldData = null;
      if (id) {
        const snap = await getDoc(doc(db, 'clients', id));
        if (snap.exists()) oldData = snap.data();
      }

      const payload: any = {
        ...formData,
        groupId: activeGroupId || user?.uid,
        updatedAt: serverTimestamp(),
      };

      if (!id) {
        payload.createdAt = serverTimestamp();
        payload.createdBy = user?.displayName || user?.email;
      } else {
        payload.editedBy = user?.displayName || user?.email;
      }

      await setDoc(doc(db, 'clients', clientId), payload, { merge: true });

      if (user) {
        await logActivity({
          groupId: activeGroupId || user.uid,
          userId: user.uid,
          userName: user.displayName || user.email || 'User',
          action: id ? ActivityAction.UPDATE : ActivityAction.CREATE,
          entityType: EntityType.CLIENT,
          entityId: clientId,
          entityName: formData.name,
          oldValue: oldData,
          newValue: payload
        });
      }
      
      toast.success(id ? t('clientUpdated' as any) : t('clientAdded' as any));
      setIsEditing(null);
      setIsAdding(false);
      setFormData({ name: '', company: '', email: '', phone: '', address: '', clientGroup: '' });
      fetchClients();
    } catch (e) {
      toast.error(t('saveFailed'));
      handleFirestoreError(e, OperationType.WRITE, 'clients');
    }
  };

  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  
  const handleDelete = async (id: string) => {
    try {
      setConfirmingDelete(null);
      const client = clients.find(c => c.id === id);
      await deleteDoc(doc(db, 'clients', id));

      if (user && client) {
        await logActivity({
          groupId: activeGroupId || user.uid,
          userId: user.uid,
          userName: user.displayName || user.email || 'User',
          action: ActivityAction.DELETE,
          entityType: EntityType.CLIENT,
          entityId: id,
          entityName: client.name,
          oldValue: client
        });
      }

      toast.success(t('clientDeleted' as any));
      fetchClients();
    } catch (e) {
      toast.error(t('deleteFailed'));
      handleFirestoreError(e, OperationType.DELETE, `clients/${id}`);
    }
  };

  const startEdit = (client: any) => {
    setIsEditing(client.id);
    setIsAdding(false);
    setFormData({
      name: client.name,
      company: client.company || '',
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
      clientGroup: client.clientGroup || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startAdd = () => {
    setIsAdding(true);
    setIsEditing(null);
    setFormData({ name: '', company: '', email: '', phone: '', address: '', clientGroup: '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (client.email && client.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (client.phone && client.phone.includes(searchQuery));
    const matchesGroup = filterGroup === 'all' || (filterGroup === 'ungrouped' ? !client.clientGroup : client.clientGroup === filterGroup);
    return matchesSearch && matchesGroup;
  }).sort((a, b) => a.name.localeCompare(b.name));

  const availableGroups = Array.from(new Set(clients.map(c => c.clientGroup).filter(Boolean))) as string[];

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-[#09090B] pb-28">
      {/* Header */}
      <header className="px-5 py-6 space-y-4 bg-white dark:bg-[#0C0C0E] border-b border-zinc-200 dark:border-white/5 relative overflow-hidden">
        <div className="absolute top-[-100px] right-[-100px] w-64 h-64 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-2xl bg-indigo-500 border border-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
               <Users size={20} strokeWidth={2.5} />
             </div>
             <div>
               <h1 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight leading-none">{t('clients')}</h1>
               <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-1 flex items-center gap-1.5 label-sparkle">
                 <Sparkles size={10} />
                 Customer Relationship
               </div>
             </div>
          </div>
          <button onClick={startAdd} className="w-10 h-10 bg-indigo-500 dark:bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all">
            <Plus size={20} strokeWidth={2.5} />
          </button>
        </div>
      </header>

      <div className="p-5 space-y-6">
        {/* Search Bar & Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative group flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-indigo-500 transition-colors">
              <Search size={18} strokeWidth={2.5} />
            </div>
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchClients' as any) || "Search clients..."}
              className="w-full bg-white dark:bg-[#0C0C0E] border border-zinc-200 dark:border-white/5 rounded-[24px] pl-12 pr-4 py-4 text-sm font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-sm"
            />
          </div>
          <div className="flex gap-4 sm:w-auto">
            <div className="relative z-20 flex-1 sm:w-48">
              <Dropdown
                value={filterGroup}
                onChange={(val) => setFilterGroup(val)}
                options={[
                  { label: 'All Groups', value: 'all' },
                  ...availableGroups.map(g => ({ label: g, value: g })),
                  { label: 'Ungrouped', value: 'ungrouped' }
                ]}
                buttonClassName="w-full h-full bg-white dark:bg-[#0C0C0E] border-zinc-200 dark:border-white/5 rounded-[24px] px-5 py-4 text-sm font-bold text-zinc-900 dark:text-white"
              />
            </div>
            <button 
              onClick={toggleViewMode}
              className="p-4 aspect-square bg-white dark:bg-[#0C0C0E] border border-zinc-200 dark:border-white/5 rounded-[24px] text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-all shadow-sm flex items-center justify-center shrink-0"
            >
              {viewMode === 'list' ? <LayoutGrid size={20} /> : <List size={20} />}
            </button>
          </div>
        </div>

        {/* Action Form */}
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
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center text-white">
                    {isAdding ? <Plus size={24} strokeWidth={2.5} /> : <Edit2 size={24} strokeWidth={2.5} />}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">
                      {isAdding ? t('addClient') : t('edit')}
                    </h2>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Client Information</p>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">{t('clientName')}</label>
                      <input 
                        value={formData.name} 
                        onChange={e => setFormData({...formData, name: e.target.value})} 
                        placeholder="John Doe" 
                        className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-[20px] px-5 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">{t('company' as any) || 'Company'}</label>
                      <input 
                        value={formData.company} 
                        onChange={e => setFormData({...formData, company: e.target.value})} 
                        placeholder="Acme Corp" 
                        className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-[20px] px-5 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all" 
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">{t('email')}</label>
                      <input 
                        value={formData.email} 
                        onChange={e => setFormData({...formData, email: e.target.value})} 
                        placeholder="john@example.com" 
                        className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-[20px] px-5 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">{t('phone')}</label>
                      <input 
                        value={formData.phone} 
                        onChange={e => setFormData({...formData, phone: e.target.value})} 
                        placeholder="+856 20..." 
                        className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-[20px] px-5 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">{t('address')}</label>
                    <textarea 
                      value={formData.address} 
                      onChange={e => setFormData({...formData, address: e.target.value})} 
                      placeholder="123 Street, Vientiane" 
                      rows={3}
                      className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-[20px] px-5 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 translation-all resize-none" 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Client Group (Optional)</label>
                    <input 
                      list="client-groups"
                      value={formData.clientGroup} 
                      onChange={e => setFormData({...formData, clientGroup: e.target.value})} 
                      placeholder="e.g. VIP Clients, Prospects" 
                      className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-[20px] px-5 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all" 
                    />
                    <datalist id="client-groups">
                      {Array.from(new Set(clients.map(c => c.clientGroup).filter(Boolean))).map(group => (
                        <option key={group} value={group} />
                      ))}
                    </datalist>
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
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest animate-pulse">Syncing clients...</p>
          </div>
        ) : clients.length === 0 && !isAdding ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-[#0C0C0E] p-16 rounded-[40px] border border-zinc-200 dark:border-white/5 text-center space-y-6"
          >
             <div className="w-24 h-24 bg-zinc-50 dark:bg-white/5 rounded-[40px] flex items-center justify-center mx-auto text-zinc-300">
               <Users size={48} strokeWidth={1.5} />
             </div>
             <div>
               <h3 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight">{t('noClients')}</h3>
               <p className="text-xs text-zinc-500 font-medium mt-1">Start growing your network today.</p>
             </div>
             <button onClick={startAdd} className="bg-indigo-500 hover:bg-indigo-400 text-white px-8 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/20 transition-all">
               + {t('addClient')}
             </button>
          </motion.div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className={viewMode === 'list' 
              ? "bg-white dark:bg-[#141417] rounded-[32px] p-2 border border-zinc-200 dark:border-white/5 shadow-sm space-y-1" 
              : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            }
          >
            {filteredClients.length === 0 && searchQuery && (
              <div className="col-span-full bg-white dark:bg-[#0C0C0E] p-16 rounded-[32px] border border-zinc-200 dark:border-white/5 text-center">
                <Search size={40} className="mx-auto text-zinc-200 dark:text-zinc-800 mb-4" />
                <p className="text-sm font-black text-zinc-400 uppercase tracking-widest">No clients match your search</p>
              </div>
            )}
            
            {filteredClients.map(client => (
              <motion.div 
                variants={itemVariants}
                key={client.id} 
              >
                <ClientRow 
                  client={client}
                  viewMode={viewMode}
                  onEdit={() => startEdit(client)}
                  onDelete={() => setConfirmingDelete(client.id)}
                  confirmingDelete={confirmingDelete === client.id}
                  cancelDelete={() => setConfirmingDelete(null)}
                  confirmDelete={() => handleDelete(client.id)}
                  t={t}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}

function ClientRow({ client, viewMode, onEdit, onDelete, confirmingDelete, cancelDelete, confirmDelete, t }: { client: any, viewMode: 'list' | 'grid', onEdit: () => void, onDelete: () => void, confirmingDelete: boolean, cancelDelete: () => void, confirmDelete: () => void, t: any }) {
  if (viewMode === 'list') {
    return (
      <div className="group flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-white/5 border-b last:border-0 border-zinc-100 dark:border-white/5 transition-colors cursor-pointer relative overflow-hidden bg-white dark:bg-[#141417] rounded-none first:rounded-t-[30px] last:rounded-b-[30px]" onClick={onEdit}>
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-[16px] bg-slate-50 dark:bg-black/40 flex-shrink-0 flex items-center justify-center text-indigo-500 font-black text-lg border-2 border-zinc-100 dark:border-white/5 shadow-inner">
            {client.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-sm text-zinc-900 dark:text-white tracking-tight leading-tight truncate px-1">{client.name}</h3>
            {client.company && (
              <div className="text-[11px] font-bold text-zinc-500 mt-0.5 truncate px-1">{client.company}</div>
            )}
            {client.email && (
              <div className="text-[11px] text-zinc-500 mt-0.5 truncate px-1">{client.email}</div>
            )}
            {client.clientGroup && (
               <div className="inline-flex items-center mt-1 mx-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                 {client.clientGroup}
               </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end gap-1 text-[11px] font-bold text-zinc-400">
             {client.phone && <div className="flex items-center justify-end gap-1.5"><Phone size={10} /> {client.phone}</div>}
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0">
            <Link href={`/history?type=client&id=${client.id}`} onClick={e => e.stopPropagation()} className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-indigo-500 hover:bg-indigo-500/10 transition-all bg-white dark:bg-black/20 shadow-sm border border-zinc-200 dark:border-white/5">
              <History size={14} strokeWidth={2.5} />
            </Link>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all bg-white dark:bg-black/20 shadow-sm border border-zinc-200 dark:border-white/5">
              <Trash2 size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>
        
        <AnimatePresence>
          {confirmingDelete && (
             <motion.div 
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: 20 }}
               className="absolute inset-y-0 right-0 bg-red-500/20 backdrop-blur-md px-4 flex items-center gap-2 border-l border-red-500/20"
               onClick={e => e.stopPropagation()}
             >
               <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest mr-2">{t('delete')}?</span>
               <button onClick={cancelDelete} className="px-3 py-1.5 bg-white dark:bg-black/40 text-zinc-700 dark:text-white rounded-lg text-[10px] font-black uppercase tracking-widest">NO</button>
               <button onClick={confirmDelete} className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md">YES</button>
             </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="group bg-white dark:bg-[#0C0C0E] p-6 rounded-[32px] border border-zinc-200 dark:border-white/5 relative overflow-hidden transition-all hover:translate-y-[-4px] hover:shadow-xl hover:shadow-indigo-500/5 h-full flex flex-col justify-between">
      <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity duration-700 pointer-events-none group-hover:scale-150 transform transition-transform duration-1000">
        <Users size={120} strokeWidth={1} />
      </div>

      <div className="flex flex-col gap-6 relative z-10 flex-grow">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-[20px] bg-slate-50 dark:bg-black/40 flex items-center justify-center text-indigo-500 font-black text-xl border-2 border-zinc-100 dark:border-white/5 shadow-inner transition-transform group-hover:rotate-6 duration-500">
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-black text-lg text-zinc-900 dark:text-white tracking-tight leading-tight">{client.name}</h3>
              {client.company && (
                  <div className="text-xs font-bold text-zinc-500 mt-0.5">{client.company}</div>
              )}
              {client.clientGroup && (
                  <div className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-500 text-[10px] font-black uppercase tracking-widest border border-indigo-500/20">
                    {client.clientGroup}
                  </div>
              )}
              {client.email && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wide mt-1 truncate max-w-[160px]">
                  <Mail size={12} strokeWidth={2.5} />
                  {client.email}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1 bg-zinc-50 dark:bg-white/5 p-1 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onEdit} className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-indigo-500 hover:bg-indigo-500/10 transition-all cursor-pointer">
              <Edit2 size={16} strokeWidth={2.5} />
            </button>
            <Link href={`/history?type=client&id=${client.id}`} className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-indigo-500 hover:bg-indigo-500/10 transition-all cursor-pointer">
              <History size={16} strokeWidth={2.5} />
            </Link>
            <button onClick={onDelete} className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer">
              <Trash2 size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {(client.phone || client.address) && (
          <div className="space-y-3">
            {client.phone && (
              <div className="flex items-center gap-3 bg-zinc-50 dark:bg-black/20 p-3 rounded-2xl">
                <div className="w-8 h-8 rounded-xl bg-white dark:bg-white/5 flex items-center justify-center text-zinc-400 shadow-sm">
                  <Phone size={14} strokeWidth={2.5} />
                </div>
                <span className="text-xs font-black text-zinc-700 dark:text-zinc-300 tracking-wider">{client.phone}</span>
              </div>
            )}
            {client.address && (
              <div className="flex items-start gap-3 bg-zinc-50 dark:bg-black/20 p-3 rounded-2xl">
                <div className="w-8 h-8 rounded-xl bg-white dark:bg-white/5 flex items-center justify-center text-zinc-400 flex-shrink-0 shadow-sm">
                  <MapPin size={14} strokeWidth={2.5} />
                </div>
                <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">{client.address}</span>
              </div>
            )}
          </div>
        )}

        <AnimatePresence>
          {confirmingDelete && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20 text-center space-y-3 mt-4"
            >
               <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">{t('delete')} this client?</p>
               <div className="flex gap-2">
                 <button onClick={confirmDelete} className="flex-1 py-2 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-500/20">YES</button>
                 <button onClick={cancelDelete} className="flex-1 py-2 bg-white dark:bg-white/10 text-zinc-700 dark:text-white rounded-xl text-[10px] font-black uppercase tracking-widest">NO</button>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <div className="flex justify-between items-center text-[9px] font-black text-zinc-400 uppercase tracking-widest opacity-60 mt-6 pt-4 border-t border-zinc-100 dark:border-white/5">
        <div className="flex items-center gap-1.5 truncate pr-4">
          <div className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600"></div>
          {client.createdBy && `Added by ${client.createdBy}`}
        </div>
        {client.updatedAt && (client.updatedAt.toDate ? client.updatedAt.toDate().toLocaleDateString() : new Date(client.updatedAt).toLocaleDateString())}
      </div>

      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
    </div>
  );
}
