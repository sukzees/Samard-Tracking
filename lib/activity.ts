import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export enum ActivityAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  STATUS_CHANGE = 'status_change',
}

export enum EntityType {
  INVOICE = 'invoice',
  EXPENSE = 'expense',
  INCOME = 'income',
  CLIENT = 'client',
  CATEGORY = 'category',
}

interface ActivityLogParams {
  groupId: string;
  userId: string;
  userName?: string;
  action: ActivityAction;
  entityType: EntityType;
  entityId: string;
  entityName: string;
  oldValue?: any;
  newValue?: any;
}

export async function logActivity(params: ActivityLogParams) {
  try {
    const cleanOldValue = params.oldValue ? JSON.parse(JSON.stringify(params.oldValue)) : null;
    const cleanNewValue = params.newValue ? JSON.parse(JSON.stringify(params.newValue)) : null;

    await addDoc(collection(db, 'activities'), {
      ...params,
      oldValue: cleanOldValue,
      newValue: cleanNewValue,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error logging activity:", error);
  }
}
