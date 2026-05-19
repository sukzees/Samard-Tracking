'use client';

import { useState, useEffect } from 'react';
import { useGroup, Invitation } from './GroupProvider';
import { useAuth } from './AuthProvider';
import { Users, Plus, Check, Copy, UserPlus, Settings, Trash2, X, Edit2, LogOut, Link as LinkIcon, Mail, RefreshCw, User } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

import { useLanguage } from './LanguageProvider';

export default function WorkspaceManager() {
  const { language, t } = useLanguage();
  const { 
    groups, 
    activeGroupId, 
    switchGroup, 
    createGroup, 
    joinGroup, 
    updateGroupName, 
    deleteGroup, 
    removeMember,
    inviteMember,
    revokeInvite,
    getPendingInvites,
    getMyInvites,
    acceptInvite,
    declineInvite
  } = useGroup();
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [joinGroupId, setJoinGroupId] = useState('');
  
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showSettings, setShowSettings] = useState<string | null>(null);
  const [viewingMembers, setViewingMembers] = useState<string | null>(null);
  
  const [invitingEmail, setInvitingEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<Invitation[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);

  const [myInvites, setMyInvites] = useState<Invitation[]>([]);
  
  useEffect(() => {
    loadMyInvites();
  }, [user]);

  const loadMyInvites = async () => {
    const invites = await getMyInvites();
    setMyInvites(invites);
  };

  const handleAcceptInvite = async (groupId: string, inviteId: string) => {
    const success = await acceptInvite(groupId, inviteId);
    if (success) {
      toast.success('Joined workspace');
      loadMyInvites();
    } else {
      toast.error('Failed to join workspace');
    }
  };

  const handleDeclineInvite = async (groupId: string, inviteId: string) => {
    const success = await declineInvite(groupId, inviteId);
    if (success) {
      toast.success('Invitation declined');
      loadMyInvites();
    } else {
      toast.error('Failed to decline invitation');
    }
  };

  useEffect(() => {
    if (showSettings) {
      loadInvites(showSettings);
    }
  }, [showSettings]);

  const loadInvites = async (groupId: string) => {
    setLoadingInvites(true);
    const invites = await getPendingInvites(groupId);
    setPendingInvites(invites);
    setLoadingInvites(false);
  };

  const handleCreateInvitation = async (groupId: string) => {
    if (!invitingEmail.trim()) return;
    setIsInviting(true);
    const success = await inviteMember(groupId, invitingEmail);
    if (success) {
      toast.success('Invitation sent');
      setInvitingEmail('');
      loadInvites(groupId);
    } else {
      toast.error('Failed to send invitation');
    }
    setIsInviting(false);
  };

  const handleRevokeInvite = async (groupId: string, inviteId: string) => {
    const success = await revokeInvite(groupId, inviteId);
    if (success) {
      toast.success('Invitation revoked');
      loadInvites(groupId);
    } else {
      toast.error('Failed to revoke invitation');
    }
  };

  const handleReInvite = async (groupId: string, email: string) => {
    // Re-inviting is just creating a new one (or we could update the timestamp)
    // For simplicity, we'll just send it again
    const success = await inviteMember(groupId, email);
    if (success) {
      toast.success('Invitation resent');
      loadInvites(groupId);
    } else {
      toast.error('Failed to resend invitation');
    }
  };

  const handleCreate = async () => {
    if (!newGroupName.trim()) return;
    const id = await createGroup(newGroupName);
    if (id) {
      toast.success('Workspace created!');
      setIsCreating(false);
      setNewGroupName('');
    } else {
      toast.error('Failed to create workspace');
    }
  };

  const handleJoin = async () => {
    if (!joinGroupId.trim()) return;
    const success = await joinGroup(joinGroupId);
    if (success) {
      toast.success('Joined workspace!');
      setIsJoining(false);
      setJoinGroupId('');
    } else {
      toast.error('Failed to join workspace. Check the ID.');
    }
  };

  const handleUpdateName = async (id: string) => {
    if (!editName.trim()) return;
    const success = await updateGroupName(id, editName);
    if (success) {
      toast.success('Workspace renamed');
      setEditingGroupId(null);
    } else {
      toast.error('Failed to rename workspace');
    }
  };

  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setConfirmingDelete(null);
    const success = await deleteGroup(id);
    if (success) {
      toast.success('Workspace deleted');
      setShowSettings(null);
    } else {
      toast.error('Failed to delete workspace');
    }
  };

  const [confirmingRemove, setConfirmingRemove] = useState<{groupId: string, memberId: string} | null>(null);

  const handleRemoveMember = async (groupId: string, memberId: string) => {
    setConfirmingRemove(null);
    const success = await removeMember(groupId, memberId);
    if (success) {
      toast.success(memberId === user?.uid ? 'Left workspace' : 'Member removed');
      if (memberId === user?.uid) setShowSettings(null);
    } else {
      toast.error('Failed to remove member');
    }
  };

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success('Workspace ID copied to clipboard');
  };

  const copyLink = (id: string) => {
    const url = `${window.location.origin}?join=${id}`;
    navigator.clipboard.writeText(url);
    toast.success('Shareable link copied to clipboard');
  };

  return (
    <div className="space-y-4">
      {myInvites.length > 0 && (
        <div className="space-y-2 mb-6">
          <label className="text-sm font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">{t('invitations' as any) || 'Invitations'}:</label>
          {myInvites.map(invite => (
            <div key={invite.id} className="flex items-center justify-between p-3 rounded-xl border bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/30">
               <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-500 flex items-center justify-center font-bold flex-shrink-0">
                  <Mail size={16} />
                </div>
                <div className="overflow-hidden">
                  <div className="text-sm font-bold text-zinc-900 dark:text-white truncate">You have been invited</div>
                  <div className="text-xs text-zinc-500 truncate mt-0.5">Workspace Invite</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => handleAcceptInvite(invite.groupId, invite.id)}
                  className="p-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
                  title="Accept"
                >
                  <Check size={16} />
                </button>
                <button 
                  onClick={() => handleDeclineInvite(invite.groupId, invite.id)}
                  className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                  title="Decline"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-semibold text-zinc-900 dark:text-white">{t('workspaces')}:</label>
      </div>
      
      <div className="space-y-2">
        {groups.map(g => (
          <div key={g.id} className="group relative">
            <div 
              className={`flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer ${activeGroupId === g.id ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/30' : 'bg-transparent border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/5'}`} 
              onClick={() => switchGroup(g.id)}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 flex-shrink-0 rounded-full bg-indigo-500/20 text-indigo-500 flex items-center justify-center font-bold">
                  {g.name.charAt(0).toUpperCase()}
                </div>
                {editingGroupId === g.id ? (
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <input 
                      autoFocus
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="bg-white dark:bg-zinc-900 border border-indigo-500 rounded px-2 py-0.5 text-sm"
                      onKeyDown={e => e.key === 'Enter' && handleUpdateName(g.id)}
                    />
                    <button onClick={() => handleUpdateName(g.id)} className="text-green-500"><Check size={16}/></button>
                    <button onClick={() => setEditingGroupId(null)} className="text-red-500"><X size={16}/></button>
                  </div>
                ) : (
                  <div className="overflow-hidden">
                    <div className="text-sm font-bold text-zinc-900 dark:text-white truncate">{g.name}</div>
                    <div className="text-xs text-zinc-500 flex items-center gap-1 cursor-pointer hover:text-indigo-500 transition-colors mt-0.5" onClick={(e) => { e.stopPropagation(); setShowSettings(g.id); }}>
                      <Users size={12} /> {g.members.length} {t('members')}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                 <button 
                    onClick={(e) => { e.stopPropagation(); copyLink(g.id); }}
                    className="p-1.5 text-zinc-400 hover:text-indigo-500 transition-colors rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
                    title="Copy Shareable Link"
                 >
                   <LinkIcon size={16} />
                 </button>
                 <button 
                    onClick={(e) => { e.stopPropagation(); copyId(g.id); }}
                    className="p-1.5 text-zinc-400 hover:text-indigo-500 transition-colors rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
                    title="Copy Invite ID"
                 >
                   <Copy size={16} />
                 </button>
                 <button 
                    onClick={(e) => { e.stopPropagation(); setShowSettings(g.id); }}
                    className={`p-1.5 transition-colors rounded-lg hover:bg-black/5 dark:hover:bg-white/5 ${showSettings === g.id ? 'text-indigo-500 bg-black/5' : 'text-zinc-400 hover:text-indigo-500'}`}
                    title="Workspace Settings"
                 >
                   <Settings size={16} />
                 </button>
                 {activeGroupId === g.id && <Check size={18} className="text-indigo-600 dark:text-indigo-400 ml-1" />}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-2 flex gap-2">
        {isCreating ? (
          <div className="flex-1 flex gap-2">
            <input 
              value={newGroupName} 
              onChange={e => setNewGroupName(e.target.value)} 
              placeholder={t('workspacePlaceholder')} 
              className="flex-1 bg-black/5 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
            <button onClick={handleCreate} className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold">{t('save')}</button>
            <button onClick={() => setIsCreating(false)} className="px-3 py-2 bg-zinc-200 dark:bg-white/10 text-zinc-700 dark:text-white rounded-xl text-sm font-bold">{t('cancel')}</button>
          </div>
        ) : isJoining ? (
          <div className="flex-1 flex gap-2">
            <input 
              value={joinGroupId} 
              onChange={e => setJoinGroupId(e.target.value)} 
              placeholder={t('joinPlaceholder')} 
              className="flex-1 bg-black/5 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
            <button onClick={handleJoin} className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold">{t('joinShort')}</button>
            <button onClick={() => setIsJoining(false)} className="px-3 py-2 bg-zinc-200 dark:bg-white/10 text-zinc-700 dark:text-white rounded-xl text-sm font-bold">{t('cancel')}</button>
          </div>
        ) : (
          <>
            <button onClick={() => setIsCreating(true)} className="flex-1 py-2.5 rounded-xl border border-dashed border-zinc-300 dark:border-white/20 text-zinc-600 dark:text-zinc-400 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
              <Plus size={16} /> {t('create')}
            </button>
            <button onClick={() => setIsJoining(true)} className="flex-1 py-2.5 rounded-xl border border-dashed border-zinc-300 dark:border-white/20 text-zinc-600 dark:text-zinc-400 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
              <UserPlus size={16} /> {t('join')}
            </button>
          </>
        )}
      </div>

      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowSettings(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#0C0C0E] w-full max-w-md rounded-[32px] border border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-6 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                     <Settings size={24} strokeWidth={2.5} />
                   </div>
                   <div>
                     <h3 className="font-black text-lg text-zinc-900 dark:text-white leading-none uppercase tracking-tight truncate max-w-[200px]">
                       {groups.find(g => g.id === showSettings)?.name}
                     </h3>
                     <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Workspace Settings</p>
                   </div>
                </div>
                <button onClick={() => setShowSettings(null)} className="w-10 h-10 flex items-center justify-center bg-zinc-100 dark:bg-white/5 text-zinc-500 rounded-2xl hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 space-y-8 custom-scrollbar">
                {groups.find(g => g.id === showSettings) && (() => {
                  const g = groups.find(gx => gx.id === showSettings)!;
                  return (
                    <>
                      {/* Name Update */}
                      {g.ownerId === user?.uid && (
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('rename')}</label>
                          <div className="flex gap-2">
                             <input 
                               value={editingGroupId === g.id ? editName : g.name}
                               onChange={e => { if (editingGroupId !== g.id) { setEditingGroupId(g.id); } setEditName(e.target.value); }}
                               className="flex-1 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-500"
                             />
                             {editingGroupId === g.id && (
                               <button onClick={() => handleUpdateName(g.id)} className="px-4 bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest">
                                 {t('save')}
                               </button>
                             )}
                          </div>
                        </div>
                      )}

                      {/* Members List */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('members')}</label>
                          <span className="text-[10px] font-bold bg-zinc-100 dark:bg-white/10 px-2 py-0.5 rounded-full text-zinc-500">{g.members.length} {t('members')}</span>
                        </div>
                        <div className="space-y-2">
                          {g.members.map(mId => (
                            <div key={mId} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/5 group/member">
                              <div className="flex items-center gap-3 overflow-hidden">
                                <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-500 flex items-center justify-center flex-shrink-0">
                                  <User size={14} />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="truncate text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                    {mId === g.ownerId && <span className="text-amber-500 mr-1">[{t('owner')}]</span>}
                                    {mId === user?.uid && <span className="text-indigo-500 mr-1">({t('you')})</span>}
                                    {mId.substring(0, 15)}...
                                  </span>
                                </div>
                              </div>
                              
                              {(g.ownerId === user?.uid || mId === user?.uid) && mId !== g.ownerId && (
                                <div className="flex items-center gap-1">
                                  {confirmingRemove?.groupId === g.id && confirmingRemove?.memberId === mId ? (
                                    <div className="flex items-center gap-1">
                                      <button 
                                        onClick={() => handleRemoveMember(g.id, mId)}
                                        className="py-1.5 px-3 bg-rose-600 text-white rounded-lg text-[10px] font-bold"
                                      >
                                        {mId === user?.uid ? t('leave') : t('remove')}
                                      </button>
                                      <button 
                                        onClick={() => setConfirmingRemove(null)}
                                        className="py-1.5 px-3 bg-zinc-200 dark:bg-white/10 text-zinc-700 dark:text-white rounded-lg text-[10px] font-bold"
                                      >
                                        X
                                      </button>
                                    </div>
                                  ) : (
                                    <button 
                                      onClick={() => setConfirmingRemove({ groupId: g.id, memberId: mId })}
                                      className="p-2 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors"
                                    >
                                      {mId === user?.uid ? <LogOut size={16} /> : <Trash2 size={16} />}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Pending Invites & Inviting Component */}
                      {g.ownerId === user?.uid && (
                        <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-white/5">
                          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('inviteMembers')}</label>
                          <div className="flex gap-2">
                            <input 
                              type="email"
                              placeholder={t('invitePlaceholder')}
                              value={invitingEmail}
                              onChange={(e) => setInvitingEmail(e.target.value)}
                              className="flex-1 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500"
                            />
                            <button 
                              onClick={() => handleCreateInvitation(g.id)}
                              disabled={isInviting || !invitingEmail.trim()}
                              className="px-4 bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                            >
                              <Plus size={16} />
                            </button>
                          </div>

                          <div className="space-y-2 mt-4">
                            {loadingInvites ? (
                              <div className="text-[10px] text-center text-zinc-500 py-2">Loading invites...</div>
                            ) : pendingInvites.length > 0 && (
                              <div className="space-y-2">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('pendingInvitations')}</span>
                                {pendingInvites.map(invite => (
                                  <div key={invite.id} className="flex items-center justify-between text-xs p-3 bg-zinc-50 dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/5">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                      <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                                        <Mail size={14} className="text-zinc-500" />
                                      </div>
                                      <span className="truncate text-zinc-700 dark:text-zinc-300 font-bold">{invite.email}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button 
                                        onClick={() => handleReInvite(g.id, invite.email)}
                                        className="p-2 hover:bg-zinc-200 dark:hover:bg-white/10 rounded-xl text-indigo-500"
                                      >
                                        <RefreshCw size={14} />
                                      </button>
                                      <button 
                                        onClick={() => handleRevokeInvite(g.id, invite.id)}
                                        className="p-2 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl text-rose-500"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Delete Workspace */}
                      {g.ownerId === user?.uid && groups.length > 1 && (
                        <div className="pt-6 mt-4 border-t border-zinc-100 dark:border-white/5">
                          {confirmingDelete === g.id ? (
                            <div className="flex gap-2">
                              <button 
                                onClick={() => handleDelete(g.id)}
                                className="flex-1 py-3 px-2 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-colors"
                              >
                                {t('delete')}
                              </button>
                              <button 
                                onClick={() => setConfirmingDelete(null)}
                                className="flex-1 py-3 px-2 bg-zinc-200 dark:bg-white/10 text-zinc-700 dark:text-white rounded-xl text-[10px] font-black uppercase tracking-widest"
                              >
                                {t('cancel')}
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => setConfirmingDelete(g.id)}
                              className="w-full py-3 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            >
                              <Trash2 size={16} /> {t('deleteWorkspace')}
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
