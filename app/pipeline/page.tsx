'use client';

import { ArrowLeft, Kanban, Plus, DollarSign, User, Calendar, Trash2, Edit2, MoreVertical, X } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useGroup } from '@/components/GroupProvider';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/components/LanguageProvider';
import { motion, AnimatePresence } from 'motion/react';
import Dropdown from '@/components/Dropdown';

const STAGES = ['Lead', 'Contacted', 'Proposal', 'Won', 'Lost'];

const STAGE_COLORS: Record<string, string> = {
  'Lead': 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300',
  'Contacted': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  'Proposal': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  'Won': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  'Lost': 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
};

export default function PipelinePage() {
  const { user } = useAuth();
  const { activeGroupId } = useGroup();
  const { t } = useLanguage();
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    clientName: '',
    stage: 'Lead'
  });

  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);

  const [clients, setClients] = useState<any[]>([]);
  const [showClientList, setShowClientList] = useState(false);

  useEffect(() => {
    if (user) {
        fetchDeals();
        fetchClients();
    }
  }, [user, activeGroupId]);

  const fetchDeals = async () => {
    try {
      const q = query(collection(db, 'deals'), where('groupId', '==', activeGroupId || user?.uid));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDeals(data.sort((a: any, b: any) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
    } catch (e) {
      console.error(e);
      toast.error('Failed to load deals');
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const q = query(collection(db, 'clients'), where('groupId', '==', activeGroupId || user?.uid));
      const snap = await getDocs(q);
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Failed to fetch clients", e);
    }
  };

  const handleSelectClient = (client: any) => {
    setFormData(prev => ({ ...prev, clientName: client.name }));
    setShowClientList(false);
  };

  const handleSave = async () => {
    if (!formData.title) {
      toast.error('Deal title is required');
      return;
    }
    
    try {
      const docId = isEditing || Date.now().toString();
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount) || 0,
        groupId: activeGroupId || user?.uid,
        updatedAt: serverTimestamp(),
        ...(isEditing ? {} : { 
            createdAt: serverTimestamp(),
            createdBy: user?.displayName || user?.email 
        })
      };
      
      await setDoc(doc(db, 'deals', docId), payload, { merge: true });
      toast.success(isEditing ? 'Deal updated' : 'Deal added');
      setIsAdding(false);
      setIsEditing(null);
      setFormData({ title: '', amount: '', clientName: '', stage: 'Lead' });
      fetchDeals();
    } catch (e) {
      console.error(e);
      toast.error('Failed to save deal');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'deals', id));
      toast.success('Deal deleted');
      fetchDeals();
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete deal');
    }
  };

  const startEdit = (deal: any) => {
    setFormData({
        title: deal.title,
        amount: deal.amount.toString(),
        clientName: deal.clientName || '',
        stage: deal.stage
    });
    setIsEditing(deal.id);
    setIsAdding(true);
  };

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    setDraggedDealId(dealId);
    e.dataTransfer.effectAllowed = 'move';
    // Small delay to allow the drag image to be captured before hiding the element (optional visual tweak)
    setTimeout(() => {
        // e.target.classList.add('opacity-50');
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    if (!draggedDealId) return;

    // Optimistically update UI
    setDeals(prev => prev.map(deal => 
      deal.id === draggedDealId ? { ...deal, stage: targetStage } : deal
    ));

    try {
      await updateDoc(doc(db, 'deals', draggedDealId), { stage: targetStage, updatedAt: serverTimestamp() });
    } catch (error) {
      console.error(error);
      toast.error('Failed to move deal');
      fetchDeals(); // Revert on failure
    } finally {
      setDraggedDealId(null);
    }
  };

  // Calculate totals per stage
  const stageTotals = STAGES.reduce((acc, stage) => {
      acc[stage] = deals.filter(d => d.stage === stage).reduce((sum, d) => sum + (d.amount || 0), 0);
      return acc;
  }, {} as Record<string, number>);

  return (
    <main className="min-h-screen bg-[#F8F9FA] dark:bg-[#09090B] pb-28">
      <header className="px-5 py-4 flex items-center justify-between bg-white dark:bg-[#0C0C0E] border-b border-zinc-200 dark:border-white/5 relative z-40">
        <div className="flex items-center gap-3">
          <Link href="/more" className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-black/20 text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                <Kanban size={20} />
            </div>
            <h1 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">{t('pipeline' as any) || "Pipeline"}</h1>
          </div>
        </div>
      </header>
      
      <div className="max-w-[1400px] mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
                <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">{t('salesPipeline' as any) || "Sales Pipeline"}</h1>
                <p className="text-sm font-bold text-zinc-500 mt-1">{t('dragAndDrop' as any) || 'Drag and drop deals across stages'}</p>
            </div>
            
            <button 
              onClick={() => { setIsAdding(true); setIsEditing(null); setFormData({ title: '', amount: '', clientName: '', stage: 'Lead' }); }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-sm transition-all shadow-blue-500/20 w-full md:w-auto justify-center"
            >
              <Plus size={20} className="stroke-[3]" />
              <span className="inline">{t('addDeal'  as any) || 'Add Deal'}</span>
            </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white dark:bg-[#141417] p-4 rounded-3xl border border-zinc-200 dark:border-white/5 flex flex-col justify-center items-start shadow-sm">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">{t('totalPipeline' as any) || 'Total Pipeline'}</span>
                <span className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">${deals.reduce((sum, d) => sum + (d.amount || 0), 0).toLocaleString()}</span>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-500/5 p-4 rounded-3xl border border-emerald-200 dark:border-emerald-500/10 flex flex-col justify-center items-start shadow-sm">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500 mb-1">{t('totalWon' as any) || 'Total Won'}</span>
                <span className="text-2xl font-black tracking-tight text-emerald-700 dark:text-emerald-400">${stageTotals['Won']?.toLocaleString() || '0'}</span>
            </div>
            <div className="bg-rose-50 dark:bg-rose-500/5 p-4 rounded-3xl border border-rose-200 dark:border-rose-500/10 flex flex-col justify-center items-start shadow-sm">
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-500 mb-1">{t('totalLost' as any) || 'Total Lost'}</span>
                <span className="text-2xl font-black tracking-tight text-rose-700 dark:text-rose-400">${stageTotals['Lost']?.toLocaleString() || '0'}</span>
            </div>
        </div>

        <AnimatePresence>
          {isAdding && (
            <motion.div 
              initial={{ opacity: 0, height: 0, scale: 0.95 }}
              animate={{ opacity: 1, height: 'auto', scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#141417] p-6 rounded-[32px] border border-zinc-200 dark:border-white/5 shadow-sm mb-8 overflow-hidden relative"
            >
              <button 
                onClick={() => { setIsAdding(false); setIsEditing(null); }}
                className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-white/5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                <X size={16} />
              </button>
              
              <h3 className="text-lg font-black text-zinc-900 dark:text-white mb-6 pr-10">
                {isEditing ? t('editDeal' as any) : t('addNewDeal' as any)}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">{t('dealTitle' as any) || 'Deal Title'} <span className="text-rose-500">*</span></label>
                  <input 
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    placeholder="Website Redesign"
                    className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-2xl px-5 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-2 relative">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">{t('stage' as any) || 'Stage'}</label>
                  <Dropdown
                    value={formData.stage}
                    onChange={(val) => setFormData({...formData, stage: val})}
                    options={STAGES.map(s => ({ label: t(s as any), value: s }))}
                    buttonClassName="w-full bg-zinc-50 dark:bg-black/20 border-zinc-200 dark:border-white/10 rounded-2xl px-5 py-4 text-sm font-bold flex justify-between"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">{t('amount' as any) || 'Amount'}</label>
                  <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                          <DollarSign size={16} className="text-zinc-400" />
                      </div>
                      <input 
                        type="number"
                        value={formData.amount}
                        onChange={e => setFormData({...formData, amount: e.target.value})}
                        placeholder="5000"
                        className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-2xl pl-12 pr-5 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all"
                      />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1 flex items-center justify-between">
                    <span>{t('clientName' as any) || 'Client Name'}</span>
                    <button 
                      type="button" 
                      onClick={() => setShowClientList(true)}
                      className="flex items-center gap-1 text-blue-500 hover:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-0.5 rounded-full transition-colors"
                    >
                      <Plus size={10} strokeWidth={3} /> {t('select' as any) || 'Select'}
                    </button>
                  </label>
                  <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                          <User size={16} className="text-zinc-400" />
                      </div>
                      <input 
                        value={formData.clientName}
                        onChange={e => setFormData({...formData, clientName: e.target.value})}
                        placeholder="Acme Corp"
                        className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-2xl pl-12 pr-5 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all"
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
                </div>
              </div>
              <div className="mt-8 flex justify-end gap-3">
                <button 
                  onClick={() => setIsAdding(false)}
                  className="px-6 py-4 rounded-2xl font-black text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors uppercase tracking-widest text-[11px]"
                >
                  {t('cancel')}
                </button>
                <button 
                  onClick={handleSave}
                  className="px-8 py-4 rounded-2xl font-black bg-blue-600 hover:bg-blue-700 text-white shadow-[0_8px_16px_-6px_rgba(37,99,235,0.4)] transition-all transform hover:-translate-y-1 uppercase tracking-widest text-[11px]"
                >
                  {t('saveDeal' as any) || 'Save Deal'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
             <div className="flex gap-6 overflow-x-auto pb-8 snap-x">
                 {[1,2,3,4,5].map(i => (
                     <div key={i} className="min-w-[300px] sm:min-w-[320px] bg-zinc-200/50 dark:bg-white/5 h-[500px] rounded-[32px] animate-pulse snap-center"></div>
                 ))}
             </div>
        ) : (
            <div className="flex gap-6 overflow-x-auto pb-10 snap-x custom-scrollbar">
                {STAGES.map(stage => {
                    const stageDeals = deals.filter(d => d.stage === stage);
                    
                    return (
                        <div 
                            key={stage} 
                            className="min-w-[300px] w-[300px] sm:min-w-[340px] sm:w-[340px] flex flex-col bg-zinc-100/50 dark:bg-[#141417]/50 rounded-[32px] p-4 snap-center border border-zinc-200/50 dark:border-white/5"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, stage)}
                        >
                            <div className="flex justify-between items-center mb-5 px-2">
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${STAGE_COLORS[stage] || 'bg-zinc-200 text-zinc-700'}`}>
                                        {t(stage as any)}
                                    </span>
                                    <span className="text-xs font-bold text-zinc-400">{stageDeals.length}</span>
                                </div>
                                <span className="text-sm font-black text-zinc-900 dark:text-white">
                                    ${stageTotals[stage]?.toLocaleString() || '0'}
                                </span>
                            </div>

                            <div className="flex flex-col gap-4 min-h-[150px] h-full rounded-2xl transition-colors pb-4">
                                {stageDeals.map(deal => (
                                    <div
                                        key={deal.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, deal.id)}
                                        className="bg-white dark:bg-[#1C1C1F] p-5 rounded-3xl border border-zinc-200 dark:border-white/5 shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-300 dark:hover:border-blue-500/30 transition-all hover:shadow-md group relative"
                                    >
                                        <div className="absolute top-4 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white/90 dark:bg-[#1C1C1F]/90 backdrop-blur-md p-1 rounded-xl border border-zinc-100 dark:border-white/10 shadow-sm">
                                            <button onClick={() => startEdit(deal)} className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10">
                                                <Edit2 size={14} />
                                            </button>
                                            <button onClick={() => handleDelete(deal.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>

                                        <h4 className="font-black text-sm text-zinc-900 dark:text-white mb-3 pr-16 leading-tight">{deal.title}</h4>
                                        <div className="text-lg font-black text-zinc-900 dark:text-white mb-4">
                                            ${(deal.amount || 0).toLocaleString()}
                                        </div>
                                        
                                        <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-zinc-100 dark:border-white/5">
                                            {deal.clientName && (
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-500">
                                                    <User size={14} className="text-zinc-400" />
                                                    <span className="truncate">{deal.clientName}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-widest text-zinc-400">
                                                <span>{t('added' as any) || 'Added'}</span>
                                                <span>{deal.createdAt?.toDate ? deal.createdAt.toDate().toLocaleDateString() : 'New'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {stageDeals.length === 0 && (
                                    <div className="flex-1 flex items-center justify-center border-2 border-dashed border-zinc-200 dark:border-white/10 rounded-3xl m-1 opacity-50 min-h-[120px]">
                                        <span className="text-xs font-bold text-zinc-400">{t('dropDealsHere' as any) || 'Drop deals here'}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </div>
{/* Add custom scrollbar styling if needed, or rely on tailwind */}
<style dangerouslySetInnerHTML={{__html: `
.custom-scrollbar::-webkit-scrollbar {
  height: 8px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(161, 161, 170, 0.3);
  border-radius: 20px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.1);
}
`}} />
    </main>
  );
}
