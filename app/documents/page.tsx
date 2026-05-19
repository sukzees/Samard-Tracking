'use client';

import { ArrowLeft, FileText, Plus, Trash2, Search, ExternalLink, Tags, User, X, LayoutGrid, List, Eye, Edit2, Download } from 'lucide-react';
import { getDownloadUrl } from '@/lib/utils';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useGroup } from '@/components/GroupProvider';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/components/LanguageProvider';
import { motion, AnimatePresence } from 'motion/react';
import Dropdown from '@/components/Dropdown';
import GoogleDriveUpload from '@/components/GoogleDriveUpload';

export default function DocumentsPage() {
  const { user } = useAuth();
  const { activeGroupId } = useGroup();
  const { t, language } = useLanguage();
  const [documents, setDocuments] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [isAdding, setIsAdding] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [showClientList, setShowClientList] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    category: 'General',
    clientName: ''
  });

  const fetchClients = useCallback(async () => {
    try {
      const q = query(collection(db, 'clients'), where('groupId', '==', activeGroupId || user?.uid));
      const snap = await getDocs(q);
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Failed to fetch clients", e);
    }
  }, [activeGroupId, user?.uid]);

  const fetchCategories = useCallback(async () => {
    try {
      const q = query(
        collection(db, 'categories'), 
        where('groupId', '==', activeGroupId || user?.uid),
        where('type', '==', 'Document')
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ name: d.data().name, nameLo: d.data().nameLo }));
      if (docs.length > 0) {
        setCategories(docs.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      } else {
        setCategories([
          { name: 'General', nameLo: 'ທົ່ວໄປ' },
          { name: 'Contract', nameLo: 'ສັນຍາ' },
          { name: 'Proposal', nameLo: 'ສະເໜີລາຄາ' },
          { name: 'Invoice', nameLo: 'ໃບເກັບເງິນ' },
          { name: 'Report', nameLo: 'ລາຍງານ' },
          { name: 'Other', nameLo: 'ອື່ນໆ' }
        ]);
      }
    } catch (e) {
      console.error('Error fetching categories:', e);
    }
  }, [activeGroupId, user?.uid]);

  const fetchDocuments = useCallback(async () => {
    try {
      const q = query(collection(db, 'documents'), where('groupId', '==', activeGroupId || user?.uid));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDocuments(data.sort((a: any, b: any) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
    } catch (e) {
      console.error(e);
      toast.error(t('failedLoadDocs' as any) || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [activeGroupId, user?.uid, t]);

  const handleSelectClient = (client: any) => {
    setFormData(prev => ({ ...prev, clientName: client.name }));
    setShowClientList(false);
  };

  useEffect(() => {
    if (user) {
      fetchDocuments();
      fetchCategories();
      fetchClients();
    }
  }, [user, activeGroupId, fetchDocuments, fetchCategories, fetchClients]);

  const handleSave = async () => {
    if (!formData.name) {
      toast.error(t('nameRequired' as any) || 'Name is required');
      return;
    }
    
    try {
      const docId = editingId || Date.now().toString();
      const payload = {
        ...formData,
        groupId: activeGroupId || user?.uid,
        updatedAt: serverTimestamp(),
        editedBy: user?.displayName || user?.email,
      };

      if (!editingId) {
        (payload as any).createdAt = serverTimestamp();
        (payload as any).createdBy = user?.displayName || user?.email;
      }
      
      await setDoc(doc(db, 'documents', docId), payload, { merge: true });
      toast.success(editingId ? (t('documentUpdated' as any) || 'Document updated') : (t('documentAdded' as any) || 'Document added'));
      setIsAdding(false);
      setEditingId(null);
      setFormData({ name: '', url: '', category: 'General', clientName: '' });
      fetchDocuments();
    } catch (e) {
      console.error(e);
      toast.error(editingId ? (t('failedUpdateDoc' as any) || 'Failed to update document') : (t('failedAddDoc' as any) || 'Failed to add document'));
    }
  };

  const handleEdit = (doc: any) => {
    setFormData({
      name: doc.name,
      url: doc.url,
      category: doc.category || 'General',
      clientName: doc.clientName || ''
    });
    setEditingId(doc.id);
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'documents', id));
      toast.success(t('documentDeleted' as any) || 'Document deleted');
      fetchDocuments();
    } catch (e) {
      console.error(e);
      toast.error(t('deleteFailed' as any) || 'Failed to delete');
    }
  };

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || doc.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <main className="min-h-screen bg-[#F8F9FA] dark:bg-[#09090B] pb-28">
      <header className="px-5 py-4 flex items-center justify-between bg-white dark:bg-[#0C0C0E] border-b border-zinc-200 dark:border-white/5 relative z-40">
        <div className="flex items-center gap-3">
          <Link href="/more" className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-black/20 text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                <FileText size={20} />
            </div>
            <h1 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">{t('documents' as any) || "Documents"}</h1>
          </div>
        </div>
      </header>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="relative w-full sm:w-96 z-30">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input 
              type="text" 
              placeholder={t('searchDocuments' as any) || "Search documents..."} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-[#141417] border border-zinc-200 dark:border-white/5 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-medium text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 shadow-sm"
            />
          </div>
          
            <div className="flex items-center gap-3 w-full sm:w-auto z-20">
              <div className="flex bg-zinc-100 dark:bg-black/20 p-1 rounded-2xl border border-zinc-200 dark:border-white/5">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-white/10 text-amber-500 shadow-sm' : 'text-zinc-500'}`}
                >
                  <LayoutGrid size={18} />
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white dark:bg-white/10 text-amber-500 shadow-sm' : 'text-zinc-500'}`}
                >
                  <List size={18} />
                </button>
              </div>
              <div className="flex-1 sm:w-48 relative">
                <Dropdown
                    value={filterCategory}
                    onChange={(val) => setFilterCategory(val)}
                    options={[
                        { label: t('allCategories' as any) || 'All Categories', value: 'all' },
                        ...categories.map(c => ({ 
                          label: (language === 'lo' && c.nameLo) ? c.nameLo : c.name, 
                          value: c.name 
                        }))
                    ]}
                    buttonClassName="w-full bg-white dark:bg-[#141417] border-zinc-200 dark:border-white/5 rounded-2xl px-4 py-3.5 text-sm font-medium text-zinc-900 dark:text-white"
                />
            </div>
            <Link 
              href="/documents/categories" 
              className="w-11 h-11 rounded-2xl bg-zinc-100 dark:bg-black/20 text-zinc-500 hover:text-amber-500 flex items-center justify-center transition-all border border-zinc-200 dark:border-white/5 overflow-hidden"
              title={t('manageCategories')}
            >
              <Tags size={18} />
            </Link>
            <button 
              onClick={() => setIsAdding(!isAdding)}
              className="bg-amber-500 hover:bg-amber-600 text-white p-3.5 rounded-2xl shadow-sm transition-all"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isAdding && (
            <motion.div 
              initial={{ opacity: 0, height: 0, scale: 0.95 }}
              animate={{ opacity: 1, height: 'auto', scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#141417] p-6 rounded-[28px] border border-zinc-200 dark:border-white/5 shadow-sm mb-8 overflow-hidden"
            >
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText size={20} className="text-amber-500" />
                  {editingId ? (t('editDocument' as any) || 'Edit Document') : (t('addNewDocument' as any) || 'Add New Document')}
                </div>
                <button 
                  onClick={() => { setIsAdding(false); setEditingId(null); setFormData({ name: '', url: '', category: 'General', clientName: '' }); }}
                  className="p-2 text-zinc-400 hover:text-rose-500 transition-colors"
                >
                  <X size={20} />
                </button>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t('documentName' as any) || 'Document Name'}</label>
                  <input 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="E.g. Q3 Proposal"
                    className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                <div className="space-y-2 relative">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t('category')}</label>
                  <Dropdown
                    value={formData.category}
                    onChange={(val) => setFormData({...formData, category: val})}
                    options={categories.map(c => ({ 
                      label: (language === 'lo' && c.nameLo) ? c.nameLo : c.name, 
                      value: c.name 
                    }))}
                    buttonClassName="w-full bg-zinc-50 dark:bg-black/20 border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm flex justify-between"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
                    <span>{t('clientName' as any) || 'Client Name'}</span>
                    <button 
                      type="button" 
                      onClick={() => setShowClientList(true)}
                      className="flex items-center gap-1 text-amber-500 hover:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded-full transition-colors font-black text-[9px] uppercase"
                    >
                      <Plus size={10} strokeWidth={3} /> {t('select' as any) || 'Select'}
                    </button>
                  </label>
                  <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <User size={16} className="text-zinc-400" />
                      </div>
                      <input 
                        value={formData.clientName}
                        onChange={e => setFormData({...formData, clientName: e.target.value})}
                        placeholder="Acme Corp"
                        className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all font-medium"
                      />
                      
                      {showClientList && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
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
                <div className="space-y-4 md:col-span-2 text-center">
                  <GoogleDriveUpload onUploadSuccess={(url) => setFormData({...formData, url})} />
                  
                  <div className="flex items-center gap-4 text-xs font-bold text-zinc-400 uppercase py-2">
                    <div className="h-px bg-zinc-200 dark:bg-white/10 flex-1"></div>
                    <span>{t('or' as any) || 'OR'}</span>
                    <div className="h-px bg-zinc-200 dark:bg-white/10 flex-1"></div>
                  </div>

                  <div className="space-y-2 text-left">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t('documentUrl' as any) || 'Document URL'} ({t('optional' as any) || 'Optional'})</label>
                    <input 
                      value={formData.url}
                      onChange={e => setFormData({...formData, url: e.target.value})}
                      placeholder="https://..."
                      className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-8 flex justify-end gap-3 border-t border-zinc-100 dark:border-white/5 pt-6">
                <button 
                  onClick={() => { setIsAdding(false); setEditingId(null); setFormData({ name: '', url: '', category: 'General', clientName: '' }); }}
                  className="px-6 py-2.5 rounded-xl font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                >
                  {t('cancel')}
                </button>
                <button 
                  onClick={handleSave}
                  className="px-6 py-2.5 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 focus:ring-4 focus:ring-amber-500/20 text-white shadow-sm transition-all"
                >
                  {editingId ? (t('updateDocument' as any) || 'Update Document') : (t('saveDocument' as any) || 'Save Document')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
              {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="bg-zinc-200 dark:bg-white/5 h-32 rounded-3xl"></div>
              ))}
            </div>
        ) : filteredDocs.length === 0 ? (
            <div className="text-center bg-white dark:bg-[#141417] p-16 rounded-[32px] border border-zinc-200 dark:border-white/5 shadow-sm">
              <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText size={24} className="text-amber-500" />
              </div>
              <p className="text-zinc-500 text-sm">{t('noDocuments' as any) || 'No documents found. Click the + button to add one.'}</p>
            </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDocs.map(doc => (
              <div key={doc.id} className="group bg-white dark:bg-[#141417] p-5 rounded-3xl border border-zinc-200 dark:border-white/5 hover:border-amber-300 dark:hover:border-amber-500/30 transition-all shadow-sm hover:shadow-md relative">
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a 
                      href={doc.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-black/20 text-zinc-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
                      title={t('view' as any) || 'View'}
                    >
                        <Eye size={16} />
                    </a>
                    <button 
                      onClick={() => handleEdit(doc)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-black/20 text-zinc-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
                      title={t('edit')}
                    >
                        <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(doc.id)} 
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-black/20 text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                      title={t('delete')}
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
                
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-4 border border-amber-500/20">
                    <FileText size={24} />
                </div>
                
                <h3 className="font-bold text-zinc-900 dark:text-white truncate mb-1 pr-10">{doc.name}</h3>
                
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 uppercase tracking-wider border border-zinc-200 dark:border-white/10">
                        {(() => {
                          const cat = categories.find(c => c.name === doc.category);
                          if (language === 'lo' && cat?.nameLo) return cat.nameLo;
                          if (cat?.name) return cat.name;
                          return t((doc.category || 'General').toLowerCase() as any) || doc.category || 'General';
                        })()}
                    </span>
                    {doc.clientName && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 uppercase tracking-wider border border-amber-500/20 flex items-center gap-1">
                            <User size={10} />
                            {doc.clientName}
                        </span>
                    )}
                    <span className="text-[10px] text-zinc-400">
                        {doc.createdAt?.toDate ? doc.createdAt.toDate().toLocaleDateString() : new Date().toLocaleDateString()}
                    </span>
                </div>
                
                <a 
                    href={getDownloadUrl(doc.url)} 
                    download
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-zinc-50 text-amber-600 hover:bg-amber-50 dark:bg-white/5 dark:text-amber-400 dark:hover:bg-amber-500/10 border border-zinc-200 dark:border-white/5 text-sm font-bold transition-colors"
                >
                    <Download size={16} />
                    {t('downloadDocument' as any) || 'Download Document'}
                </a>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDocs.map(doc => (
              <div key={doc.id} className="group bg-white dark:bg-[#141417] p-4 rounded-2xl border border-zinc-200 dark:border-white/5 hover:border-amber-300 dark:hover:border-amber-500/30 transition-all flex items-center gap-4 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20 shrink-0">
                    <FileText size={20} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-zinc-900 dark:text-white truncate text-sm">{doc.name}</h3>
                  <div className="flex items-center gap-3 mt-1 overflow-hidden">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider truncate">
                      {(() => {
                        const cat = categories.find(c => c.name === doc.category);
                        if (language === 'lo' && cat?.nameLo) return cat.nameLo;
                        if (cat?.name) return cat.name;
                        return t((doc.category || 'General').toLowerCase() as any) || doc.category || 'General';
                      })()}
                    </span>
                    {doc.clientName && (
                      <span className="text-[10px] font-bold text-amber-500 dark:text-amber-400 uppercase tracking-wider truncate flex items-center gap-1">
                        <User size={10} />
                        {doc.clientName}
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-400 whitespace-nowrap">
                      {doc.createdAt?.toDate ? doc.createdAt.toDate().toLocaleDateString() : new Date().toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                   <a 
                      href={doc.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-50 dark:bg-white/5 text-zinc-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
                      title={t('view' as any) || 'View'}
                    >
                        <Eye size={16} />
                    </a>
                    <button 
                      onClick={() => handleEdit(doc)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-50 dark:bg-white/5 text-zinc-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
                      title={t('edit')}
                    >
                        <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(doc.id)} 
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-50 dark:bg-white/5 text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                      title={t('delete')}
                    >
                        <Trash2 size={16} />
                    </button>
                    <a 
                      href={getDownloadUrl(doc.url)} 
                      download
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-900 dark:bg-white/10 text-white dark:text-zinc-400 hover:scale-105 active:scale-95 transition-all ml-1"
                      title={t('downloadDocument' as any)}
                    >
                        <Download size={16} />
                    </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
