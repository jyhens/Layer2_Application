// // notif.ts
// export type LeaveNotifKind = "submitted" | "approved" | "rejected";

// export type LeaveNotification = {
//   id: number;
//   ts: string;                
//   userId: string;           
//   kind: LeaveNotifKind;
//   date?: string;         
//   leaveId?: string;
//   actorId?: string | null;    
//   actorName?: string | null;
//   comment?: string | null;    
// };

// let listeners: Array<(all: LeaveNotification[]) => void> = [];
// let notifs: LeaveNotification[] = [];

// export function addUserNotification(n: Omit<LeaveNotification, "id" | "ts">) {
//   const entry: LeaveNotification = {
//     id: Date.now() + Math.random(),
//     ts: new Date().toISOString(),
//     ...n,
//   };
//   notifs = [entry, ...notifs].slice(0, 500);
//   listeners.forEach((l) => l(notifs));
// }

// export function getAllNotifications(): LeaveNotification[] {
//   return notifs;
// }

// export function getUserNotifications(userId: string): LeaveNotification[] {
//   return notifs.filter((n) => n.userId === userId);
// }

// export function subscribeNotifications(fn: (all: LeaveNotification[]) => void) {
//   listeners.push(fn);
//   fn(notifs); 
//   return () => {
//     listeners = listeners.filter((x) => x !== fn);
//   };
// }

// export function clearNotificationsForUser(userId: string) {
//   notifs = notifs.filter((n) => n.userId !== userId);
//   listeners.forEach((l) => l(notifs));
// }
