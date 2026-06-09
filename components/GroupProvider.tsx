'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, onSnapshot, serverTimestamp, deleteDoc, updateDoc, collectionGroup, arrayUnion } from 'firebase/firestore';
import { safeStorage } from '@/lib/storage';

export interface Group {
  id: string;
  name: string;
  members: string[];
  ownerId: string;
  startingBalance?: number;
  startingBalanceCurrency?: string;
}

export interface Invitation {
  id: string;
  groupId: string;
  email: string;
  status: 'pending' | 'accepted' | 'revoked';
  invitedBy: string;
  createdAt: any;
}

interface GroupContextType {
  activeGroupId: string | null;
  activeGroup: Group | null;
  groups: Group[];
  loadingGroups: boolean;
  switchGroup: (groupId: string) => void;
  createGroup: (name: string) => Promise<string | null>;
  joinGroup: (groupId: string) => Promise<boolean>;
  updateGroupName: (groupId: string, newName: string) => Promise<boolean>;
  updateGroupStartingBalance: (groupId: string, balance: number, currency: string) => Promise<boolean>;
  deleteGroup: (groupId: string) => Promise<boolean>;
  removeMember: (groupId: string, memberId: string) => Promise<boolean>;
  inviteMember: (groupId: string, email: string) => Promise<boolean>;
  revokeInvite: (groupId: string, inviteId: string) => Promise<boolean>;
  getPendingInvites: (groupId: string) => Promise<Invitation[]>;
  getMyInvites: () => Promise<Invitation[]>;
  acceptInvite: (groupId: string, inviteId: string) => Promise<boolean>;
  declineInvite: (groupId: string, inviteId: string) => Promise<boolean>;
}

const GroupContext = createContext<GroupContextType>({
  activeGroupId: null,
  activeGroup: null,
  groups: [],
  loadingGroups: true,
  switchGroup: () => {},
  createGroup: async () => null,
  joinGroup: async () => false,
  updateGroupName: async () => false,
  updateGroupStartingBalance: async () => false,
  deleteGroup: async () => false,
  removeMember: async () => false,
  inviteMember: async () => false,
  revokeInvite: async () => false,
  getPendingInvites: async () => [],
  getMyInvites: async () => [],
  acceptInvite: async () => false,
  declineInvite: async () => false,
});

export const useGroup = () => useContext(GroupContext);

export function GroupProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return safeStorage.getItem('activeGroupId');
    }
    return null;
  });
  const [loadingGroups, setLoadingGroups] = useState(true);

  useEffect(() => {
    if (!user) {
      setGroups([]);
      setActiveGroupId(null);
      setLoadingGroups(false);
      return;
    }

    setLoadingGroups(true);
    // Subscribe to groups where user is a member
    const q = query(collection(db, 'groups'), where('members', 'array-contains', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const groupList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
      setGroups(groupList);
      setLoadingGroups(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'groups');
      setLoadingGroups(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Handle join from URL
  useEffect(() => {
    if (typeof window !== 'undefined' && user) {
      const params = new URLSearchParams(window.location.search);
      const joinId = params.get('join');
      if (joinId) {
        joinGroup(joinId).then(success => {
          if (success) {
            // Clean up URL without reload
            const url = new URL(window.location.href);
            url.searchParams.delete('join');
            window.history.replaceState({}, '', url.pathname + url.search);
          }
        });
      }
    }
  }, [user]);

  // Ensure there's an active group
  useEffect(() => {
    if (!loadingGroups && user) {
      let savedGroupId = safeStorage.getItem('activeGroupId');
      
      if (groups.length > 0) {
        // User has groups. If saved ID is valid, keep it. Otherwise default to first.
        if (savedGroupId && groups.some(g => g.id === savedGroupId)) {
          setActiveGroupId(savedGroupId);
        } else {
          setActiveGroupId(groups[0].id);
          safeStorage.setItem('activeGroupId', groups[0].id);
        }
      }
    }
  }, [groups, loadingGroups, user]);

  useEffect(() => {
    if (activeGroupId) {
      safeStorage.setItem('activeGroupId', activeGroupId);
    }
  }, [activeGroupId]);

  const switchGroup = (groupId: string) => {
    setActiveGroupId(groupId);
    safeStorage.setItem('activeGroupId', groupId);
  };

  const createGroup = async (name: string) => {
    if (!user) return null;
    try {
      const newGroupId = `grp_${Date.now()}`;
      const newGroup = {
        name,
        members: [user.uid],
        ownerId: user.uid,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'groups', newGroupId), newGroup);
      switchGroup(newGroupId);
      return newGroupId;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const joinGroup = async (groupId: string) => {
    if (!user) return false;
    try {
      // In a real app we need a secure join mechanism (or a cloud function),
      // for now we'll fetch group, and add user to members if we have permission.
      // Actually, since rules might be permissive, let's just do it.
      const gDoc = await getDocs(query(collection(db, 'groups'), where('__name__', '==', groupId)));
      if (!gDoc.empty) {
        const { id, ...gData } = gDoc.docs[0].data() as Group;
        if (!gData.members.includes(user.uid)) {
           await setDoc(doc(db, 'groups', groupId), {
             ...gData,
             members: [...gData.members, user.uid]
           });
        }
        switchGroup(groupId);
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const updateGroupName = async (groupId: string, newName: string) => {
    if (!user) return false;
    try {
      const group = groups.find(g => g.id === groupId);
      if (!group || group.ownerId !== user.uid) return false;
      
      const { id, ...data } = group;
      await setDoc(doc(db, 'groups', groupId), {
        ...data,
        name: newName,
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `groups/${groupId}`);
      return false;
    }
  };

  const updateGroupStartingBalance = async (groupId: string, balance: number, currency: string) => {
    if (!user) return false;
    try {
      const group = groups.find(g => g.id === groupId);
      if (!group) return false;
      
      const { id, ...data } = group;
      await setDoc(doc(db, 'groups', groupId), {
        ...data,
        startingBalance: balance,
        startingBalanceCurrency: currency,
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `groups/${groupId}`);
      return false;
    }
  };

  const deleteGroup = async (groupId: string) => {
    if (!user) return false;
    try {
      const group = groups.find(g => g.id === groupId);
      if (!group || group.ownerId !== user.uid) return false;
      
      await deleteDoc(doc(db, 'groups', groupId));
      
      if (activeGroupId === groupId) {
        const remaining = groups.filter(g => g.id !== groupId);
        if (remaining.length > 0) {
          switchGroup(remaining[0].id);
        } else {
          setActiveGroupId(null);
          safeStorage.removeItem('activeGroupId');
        }
      }
      return true;
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `groups/${groupId}`);
      return false;
    }
  };

  const removeMember = async (groupId: string, memberId: string) => {
    if (!user) return false;
    try {
      const group = groups.find(g => g.id === groupId);
      if (!group) return false;
      
      // Only owner can remove others, but members can remove themselves
      if (group.ownerId !== user.uid && user.uid !== memberId) return false;
      // Cannot remove the owner
      if (memberId === group.ownerId) return false;

      const { id, ...data } = group;
      const newMembers = group.members.filter(m => m !== memberId);
      await setDoc(doc(db, 'groups', groupId), {
        ...data,
        members: newMembers,
        updatedAt: serverTimestamp()
      });
      
      return true;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `groups/${groupId}`);
      return false;
    }
  };

  const inviteMember = async (groupId: string, email: string) => {
    if (!user) return false;
    try {
      const inviteId = doc(collection(db, 'groups', groupId, 'invitations')).id;
      await setDoc(doc(db, 'groups', groupId, 'invitations', inviteId), {
        groupId,
        email,
        status: 'pending',
        invitedBy: user.uid,
        createdAt: serverTimestamp()
      });
      return true;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `groups/${groupId}/invitations`);
      return false;
    }
  };

  const revokeInvite = async (groupId: string, inviteId: string) => {
    if (!user) return false;
    try {
      await deleteDoc(doc(db, 'groups', groupId, 'invitations', inviteId));
      return true;
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `groups/${groupId}/invitations/${inviteId}`);
      return false;
    }
  };

  const getPendingInvites = async (groupId: string) => {
    if (!user) return [];
    try {
      const q = query(
        collection(db, 'groups', groupId, 'invitations'), 
        where('status', '==', 'pending')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invitation));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, `groups/${groupId}/invitations`);
      return [];
    }
  };

  const getMyInvites = async () => {
    if (!user || !user.email) return [];
    try {
      const q = query(
        collectionGroup(db, 'invitations'),
        where('email', '==', user.email),
        where('status', '==', 'pending')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invitation));
    } catch (e) {
      console.error("Failed to fetch my invites", e);
      return [];
    }
  };

  const acceptInvite = async (groupId: string, inviteId: string) => {
    if (!user) return false;
    try {
      await updateDoc(doc(db, 'groups', groupId), {
        members: arrayUnion(user.uid)
      });
      await updateDoc(doc(db, 'groups', groupId, 'invitations', inviteId), {
        status: 'accepted'
      });
      switchGroup(groupId);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const declineInvite = async (groupId: string, inviteId: string) => {
    if (!user) return false;
    try {
      await updateDoc(doc(db, 'groups', groupId, 'invitations', inviteId), {
        status: 'revoked'
      });
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const activeGroup = groups.find(g => g.id === activeGroupId) || null;

  return (
    <GroupContext.Provider value={{ 
      activeGroupId, 
      activeGroup, 
      groups, 
      loadingGroups, 
      switchGroup, 
      createGroup, 
      joinGroup,
      updateGroupName,
      updateGroupStartingBalance,
      deleteGroup,
      removeMember,
      inviteMember,
      revokeInvite,
      getPendingInvites,
      getMyInvites,
      acceptInvite,
      declineInvite
    }}>
      {children}
    </GroupContext.Provider>
  );
}
