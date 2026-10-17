/** The four kinds of conversation (backend `ChatType`). */
export type ChatType = 'private' | 'public' | 'team' | 'group';
export type ChatStatus = 'active' | 'inactive' | 'deleted';
export type ChatMemberRole = 'admin' | 'member';

/** A person as conversations show them. */
export interface ChatPerson {
  id: string;
  nameEn: string;
  nameAr: string;
  jobTitleEn: string | null;
  jobTitleAr: string | null;
  avatarVersion: string | null;
}

/** A colleague from the chat directory. */
export interface ChatDirectoryPerson extends ChatPerson {
  /** May be added to group chats (the API decides). */
  groupEligible: boolean;
}

/** One message, decrypted by the API for a member of its conversation. */
export interface ChatMessage {
  id: string;
  chatId: string;
  /** Position in the conversation — the paging cursor and the order. */
  seq: number;
  sender: ChatPerson | null;
  text: string | null;
  deleted: boolean;
  unavailable: boolean;
  clientMessageId: string | null;
  createdAt: string;
  /** When its sender last edited it (null: never edited). */
  editedAt: string | null;
}

/** What this member's screen may offer (the API re-checks every action). */
export interface ChatCapabilities {
  send: boolean;
  manageMembers: boolean;
  rename: boolean;
  changeAdminMode: boolean;
  /** Archive it in your own list (members never delete a conversation — Super Administrators delete groups in Chat management). */
  archive: boolean;
}

/** One conversation in the list. */
export interface ChatSummary {
  id: string;
  type: ChatType;
  name: string | null;
  nameAr: string | null;
  peer: ChatPerson | null;
  status: ChatStatus;
  locked: boolean;
  adminOnly: boolean;
  memberCount: number;
  myRole: ChatMemberRole;
  unreadCount: number;
  lastSeq: number;
  lastReadSeq: number;
  /** How far this user's devices have received (the rest is reported delivered once the list is loaded). */
  lastDeliveredSeq: number;
  /** In this user's archive: out of the active list, history and unread count unchanged. */
  archived: boolean;
  lastMessage: { id: string; seq: number; senderId: string; preview: string | null; deleted: boolean; unavailable: boolean; createdAt: string } | null;
  lastMessageAt: string | null;
  capabilities: ChatCapabilities;
}

export interface ChatMember extends ChatPerson {
  role: ChatMemberRole;
  joinedAt: string | null;
}

/** How far another member has received and seen the conversation (a message is delivered / seen when its `seq` is at or below). */
export interface ChatReceipt {
  userId: string;
  deliveredSeq: number;
  readSeq: number;
  deliveredAt: string | null;
  readAt: string | null;
}

/** One conversation's details. */
export interface ChatDetails extends ChatSummary {
  members: ChatMember[];
  /** Every other member's delivered / seen position (the ticks of this user's own messages). */
  receipts: ChatReceipt[];
}

/** The list entry of a conversation whose details were read. */
export function summaryOf(details: ChatDetails): ChatSummary {
  const { members: _members, receipts: _receipts, ...summary } = details;
  return summary;
}

/** One batch of history, oldest first. */
export interface ChatMessagePage {
  items: ChatMessage[];
  hasOlder: boolean;
  hasNewer: boolean;
  targetId?: string;
}

/** One batch of search results inside one conversation, newest first. */
export interface ChatSearchPage {
  items: ChatMessage[];
  hasMore: boolean;
  nextBefore: number | null;
  terms: string[];
}

/** A group conversation as Super Administrators manage it — metadata only. */
export interface ManagedChat {
  id: string;
  type: ChatType;
  name: string | null;
  nameAr: string | null;
  teamId: string | null;
  status: ChatStatus;
  locked: boolean;
  lockedAt: string | null;
  adminOnly: boolean;
  memberCount: number;
  createdBy: { id: string; nameEn: string; nameAr: string } | null;
  createdAt: string | null;
  lastActivityAt: string | null;
  manageable: boolean;
}

export interface ManagedChatDetails extends ManagedChat {
  members: ChatMember[];
  admins: ChatMember[];
}

/** The acknowledgement of a chat command over the realtime connection. */
export type ChatAck<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Realtime chat events (backend `ChatEvent`). */
export const CHAT_EVENTS = {
  message: 'chat:message',
  messageDeleted: 'chat:message:deleted',
  messageUpdated: 'chat:message:updated',
  receipt: 'chat:receipt',
  typing: 'chat:typing',
  memberAdded: 'chat:member:added',
  memberRemoved: 'chat:member:removed',
  memberRoleChanged: 'chat:member:role-changed',
  updated: 'chat:updated',
  locked: 'chat:locked',
  deleted: 'chat:deleted',
  adminModeChanged: 'chat:admin-mode-changed',
  /** This user archived / unarchived a conversation (on another of their devices too). */
  archived: 'chat:archived',
} as const;

/** Commands a client sends (backend `ChatCommand`). */
export const CHAT_COMMANDS = {
  send: 'chat:send',
  read: 'chat:read',
  delivered: 'chat:delivered',
  deliveredMany: 'chat:delivered:many',
  typingStart: 'chat:typing:start',
  typingStop: 'chat:typing:stop',
} as const;

/** Mirrors the API's limits (the API enforces them). */
export const MESSAGE_MAX_LENGTH = 4_000;
export const GROUP_NAME_MAX_LENGTH = 80;
export const MIN_GROUP_MEMBERS = 3;
