'use client';

import { ArrowLeft, FilePlus, ReceiptText, Wallet, Users, Package, BarChart2, Clock, Settings, FileText, ChevronRight, LayoutGrid, Kanban, Bookmark } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';

export default function MorePage() {
  const { t } = useLanguage();
  
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-[#09090B] pb-10">
      <header className="px-5 py-4 flex items-center gap-3 bg-white/80 dark:bg-[#0C0C0E]/80 backdrop-blur-md sticky top-0 z-40 border-b border-zinc-200 dark:border-white/5">
        <Link href="/" className="text-zinc-700 dark:text-zinc-300 p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-white/5 transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-[18px] font-bold text-zinc-900 dark:text-white tracking-tight">{t('seeAll' as any) || "All Menus"}</h1>
      </header>

      <div className="px-5 py-6 space-y-8">
        {/* Create Group */}
        <div className="space-y-3">
          <h2 className="text-[13px] font-bold text-zinc-500 uppercase tracking-widest px-1">{t('create')}</h2>
          <div className="bg-white dark:bg-[#141417] rounded-[24px] border border-zinc-200 dark:border-white/5 overflow-hidden">
            <MenuRow href="/invoices?action=new" icon={<FilePlus size={20} className="text-emerald-500" />} label={t('newInvoice')} bg="bg-emerald-500/10 border-emerald-500/20" />
            <MenuRow href="/expenses?action=new" icon={<ReceiptText size={20} className="text-rose-500" />} label={t('newExpense')} bg="bg-rose-500/10 border-rose-500/20" />
            <MenuRow href="/income?action=new" icon={<Wallet size={20} className="text-indigo-500" />} label={t('newIncome')} bg="bg-indigo-500/10 border-indigo-500/20" isLast />
          </div>
        </div>

        {/* Manage Group */}
        <div className="space-y-3">
          <h2 className="text-[13px] font-bold text-zinc-500 uppercase tracking-widest px-1">{t('manage')}</h2>
          <div className="bg-white dark:bg-[#141417] rounded-[24px] border border-zinc-200 dark:border-white/5 overflow-hidden">
            <MenuRow href="/invoices" icon={<FileText size={20} className="text-emerald-500" />} label={t('invoicesList')} bg="bg-emerald-500/10 border-emerald-500/20" />
            <MenuRow href="/expenses" icon={<ReceiptText size={20} className="text-rose-500" />} label={t('expense')} bg="bg-rose-500/10 border-rose-500/20" />
            <MenuRow href="/income" icon={<Wallet size={20} className="text-indigo-500" />} label={t('income')} bg="bg-indigo-500/10 border-indigo-500/20" />
            <MenuRow href="/categories" icon={<Bookmark size={20} className="text-orange-500" />} label={t('categories' as any) || "Categories"} bg="bg-orange-500/10 border-orange-500/20" isLast />
          </div>
        </div>

        {/* CRM System Group */}
        <div className="space-y-3">
          <h2 className="text-[13px] font-bold text-zinc-500 uppercase tracking-widest px-1">{t('crmSystem' as any) || "CRM System"}</h2>
          <div className="bg-white dark:bg-[#141417] rounded-[24px] border border-zinc-200 dark:border-white/5 overflow-hidden">
            <MenuRow href="/clients" icon={<Users size={20} className="text-purple-500" />} label={t('clients')} bg="bg-purple-500/10 border-purple-500/20" />
            <MenuRow href="/pipeline" icon={<Kanban size={20} className="text-blue-500" />} label={t('pipeline' as any) || "Pipeline"} bg="bg-blue-500/10 border-blue-500/20" />
            <MenuRow href="/documents" icon={<FileText size={20} className="text-amber-500" />} label={t('documents' as any) || "Documents"} bg="bg-amber-500/10 border-amber-500/20" isLast />
          </div>
        </div>

        {/* Tools Group */}
        <div className="space-y-3">
          <h2 className="text-[13px] font-bold text-zinc-500 uppercase tracking-widest px-1">Analytics & Tools</h2>
          <div className="bg-white dark:bg-[#141417] rounded-[24px] border border-zinc-200 dark:border-white/5 overflow-hidden">
            <MenuRow href="/reports" icon={<BarChart2 size={20} className="text-cyan-500" />} label={t('reports')} bg="bg-cyan-500/10 border-cyan-500/20" />
            <MenuRow href="/history" icon={<Clock size={20} className="text-amber-500" />} label={t('history')} bg="bg-amber-500/10 border-amber-500/20" />
            <MenuRow href="/settings" icon={<Settings size={20} className="text-zinc-600 dark:text-zinc-400" />} label={t('settings')} bg="bg-zinc-100 dark:bg-white/5 border-zinc-300 dark:border-white/10" isLast />
          </div>
        </div>
      </div>
    </main>
  );
}

function MenuRow({ href, icon, label, bg, isLast = false }: { href: string; icon: React.ReactNode; label: string; bg: string; isLast?: boolean }) {
  return (
    <Link href={href} className={`flex items-center justify-between p-4 hover:bg-zinc-200 dark:hover:bg-white/5 transition-colors ${!isLast ? 'border-b border-zinc-200 dark:border-white/5' : ''}`}>
      <div className="flex items-center gap-4">
        <div className={`p-2.5 rounded-[12px] border ${bg}`}>
          {icon}
        </div>
        <span className="font-semibold text-[15px] text-zinc-900 dark:text-white tracking-tight">{label}</span>
      </div>
      <ChevronRight size={20} className="text-zinc-600" />
    </Link>
  );
}
