'use client';

import { ArrowLeft, FileText, Edit2, Check, ArrowUpDown, ReceiptText, Wallet, Calendar, User, Eye, Trash2, Printer } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { useLanguage } from '@/components/LanguageProvider';
import { useCurrency } from '@/components/CurrencyProvider';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'react-hot-toast';

export default function InvoiceDetailsPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { t } = useLanguage();
  const { formatAmount } = useCurrency();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const docRef = doc(db, 'invoices', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setInvoice(docSnap.data());
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, 'invoices');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchInvoice();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#09090B]">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#09090B] p-6">
        <p className="text-zinc-500 mb-4">Invoice not found</p>
        <button onClick={() => router.back()} className="text-indigo-500 font-bold">
          {t('back')}
        </button>
      </div>
    );
  }

  const subtotal = invoice.subtotal || invoice.items?.reduce((acc: number, item: any) => acc + (item.qty * item.rate), 0) || 0;
  const tax = invoice.tax || 0;
  const total = invoice.total || (subtotal + tax);

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-[#09090B] pb-10">
      <header className="px-5 py-4 flex justify-between items-center bg-white/80 dark:bg-[#0C0C0E]/80 backdrop-blur-md sticky top-0 z-40 border-b border-zinc-200 dark:border-white/5">
        <button onClick={() => router.back()} className="text-zinc-700 dark:text-zinc-300 p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-white/5 transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-[16px] font-bold text-zinc-900 dark:text-white tracking-tight">
          {t('invoice')} {invoice.invoiceNumber}
        </h1>
        <button 
          onClick={() => router.push(`/invoices?id=${id}&action=edit`)} 
          className="text-indigo-500 p-2 rounded-full hover:bg-indigo-500/10 transition-colors"
        >
          <Edit2 size={20} />
        </button>
      </header>

      <div className="px-5 py-6 space-y-6 max-w-2xl mx-auto">
        <div className="bg-white dark:bg-[#141417] rounded-[24px] border border-zinc-200 dark:border-white/5 overflow-hidden shadow-sm relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500"></div>
          
          {/* Header Info */}
          <div className="p-8 border-b border-zinc-100 dark:border-white/5">
            <div className="flex justify-between items-start mb-8">
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
                  INVOICE
                </h2>
                <p className="text-[11px] font-bold text-indigo-500 tracking-widest">{invoice.invoiceNumber}</p>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  invoice.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-500' : 
                  invoice.status === 'Sent' ? 'bg-indigo-500/10 text-indigo-500' : 
                  'bg-orange-500/10 text-orange-500'
                }`}>
                  {invoice.status === 'Paid' ? t('paid') : invoice.status === 'Sent' ? t('sent') : t('pending')}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">{t('billTo')}</p>
                <p className="text-sm font-bold text-zinc-900 dark:text-white">{invoice.clientName}</p>
                {invoice.clientAddress && (
                  <p className="text-[11px] text-zinc-500 mt-1 whitespace-pre-wrap">{invoice.clientAddress}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">{t('date')}</p>
                <p className="text-sm font-bold text-zinc-900 dark:text-white">{invoice.date}</p>
                {invoice.dueDate && (
                  <div className="mt-2">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t('dueDate')}</p>
                    <p className="text-[11px] text-rose-500 font-bold">{invoice.dueDate}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="p-8">
            <div className="mb-4">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t('items')}</p>
            </div>
            <div className="space-y-4">
              {invoice.items?.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center py-1">
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-zinc-900 dark:text-white">{item.name}</p>
                    <p className="text-[11px] text-zinc-500">{item.qty} x {formatAmount(item.rate, invoice.currency)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-bold text-zinc-900 dark:text-white">{formatAmount(item.qty * item.rate, invoice.currency)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-white/5 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500 font-medium">{t('subtotal')}</span>
                <span className="text-zinc-900 dark:text-white font-bold">{formatAmount(subtotal, invoice.currency)}</span>
              </div>
              <div className="flex justify-between text-lg pt-2">
                <span className="text-zinc-900 dark:text-white font-black">{t('total')}</span>
                <span className="text-emerald-500 font-black">{formatAmount(total, invoice.currency)}</span>
              </div>
            </div>
          </div>

          {/* Metadata Section - requested details */}
          <div className="p-8 bg-zinc-50 dark:bg-black/10 border-t border-zinc-100 dark:border-white/5 space-y-6">
            <div className="space-y-6">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t('description')}</p>
                <p className="text-sm font-semibold text-zinc-900 dark:text-white leading-relaxed">
                  {invoice.items?.map((i: any) => i.name).join(', ') || 'No items'}
                </p>
              </div>

              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t('date')}</p>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">{invoice.date}</p>
                </div>
                {invoice.updatedAt && (
                  <div className="text-right pl-4">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t('modifiedDate')}</p>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                      {invoice.updatedAt?.toDate ? invoice.updatedAt.toDate().toLocaleString() : 
                       invoice.updatedAt ? new Date(invoice.updatedAt).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t('createdBy')}</p>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">{invoice.createdBy || 'User'}</p>
                </div>
                {invoice.editedBy && (
                  <div className="text-right pl-4">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t('editedBy')}</p>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">{invoice.editedBy}</p>
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
                  <p className="text-sm font-bold text-indigo-500">{invoice.status || 'Sent'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 bg-white dark:bg-[#141417] border border-zinc-200 dark:border-white/5 text-zinc-700 dark:text-zinc-300 font-bold py-4 rounded-xl transition-all hover:bg-zinc-100 dark:hover:bg-white/10"
          >
            <Printer size={18} /> {t('downloadPdf' as any) || 'Print'}
          </button>
          <button 
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl transition-all"
          >
            < Eye size={18} /> {t('share')}
          </button>
        </div>
      </div>
    </main>
  );
}
