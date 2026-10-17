import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '../api/api.service';
import type { Page } from '../api/page.interface';
import type {
  ChatDetails,
  ChatDirectoryPerson,
  ChatMemberRole,
  ChatMessage,
  ChatMessagePage,
  ChatSearchPage,
  ChatStatus,
  ChatSummary,
  ChatType,
  ManagedChat,
  ManagedChatDetails,
} from './chat.models';

/**
 * The chat REST API: conversations, membership, and messages in bounded
 * batches — the latest, `before` / `after` a position, the batch around one
 * message, search inside one conversation. Never a whole history. (Sending,
 * receipts and typing go over the realtime connection: `ChatCommands`.)
 */
@Service()
export class ChatApi {
  private readonly api = inject(ApiService);

  list(): Observable<ChatSummary[]> {
    return this.api.get<ChatSummary[]>('chats');
  }

  unreadCount(): Observable<{ count: number; chats: number }> {
    return this.api.get<{ count: number; chats: number }>('chats/unread-count');
  }

  details(chatId: string): Observable<ChatDetails> {
    return this.api.get<ChatDetails>(`chats/${chatId}`);
  }

  people(q: string): Observable<ChatDirectoryPerson[]> {
    return this.api.get<ChatDirectoryPerson[]>('chats/people', q ? { q } : {});
  }

  openPrivate(userId: string): Observable<ChatDetails> {
    return this.api.post<ChatDetails>('chats/private', { userId });
  }

  createGroup(name: string, memberIds: string[]): Observable<ChatDetails> {
    return this.api.post<ChatDetails>('chats/groups', { name, memberIds });
  }

  update(chatId: string, changes: { name?: string; adminOnly?: boolean }): Observable<ChatDetails> {
    return this.api.patch<ChatDetails>(`chats/${chatId}`, changes);
  }

  addMembers(chatId: string, userIds: string[]): Observable<ChatDetails> {
    return this.api.post<ChatDetails>(`chats/${chatId}/members`, { userIds });
  }

  removeMember(chatId: string, userId: string): Observable<ChatDetails> {
    return this.api.delete<ChatDetails>(`chats/${chatId}/members/${userId}`);
  }

  changeRole(chatId: string, userId: string, role: ChatMemberRole): Observable<ChatDetails> {
    return this.api.patch<ChatDetails>(`chats/${chatId}/members/${userId}`, { role });
  }

  /** One batch: the latest (no cursor), `before` a position (older) or `after` one (newer). */
  messages(chatId: string, cursor: { before?: number; after?: number; limit?: number } = {}): Observable<ChatMessagePage> {
    return this.api.get<ChatMessagePage>(`chats/${chatId}/messages`, { ...cursor });
  }

  /** The sender edits their own message (the API refuses anyone else, admins included); answers the updated message. */
  editMessage(chatId: string, messageId: string, text: string): Observable<ChatMessage> {
    return this.api.patch<ChatMessage>(`chats/${chatId}/messages/${messageId}`, { text });
  }

  /** The batch around one message (a search result opened far back in a long conversation). */
  context(chatId: string, messageId: string): Observable<ChatMessagePage> {
    return this.api.get<ChatMessagePage>(`chats/${chatId}/messages/${messageId}/context`);
  }

  /** Search inside one conversation, newest first; `before` = the previous batch's `nextBefore`. */
  search(chatId: string, q: string, before?: number | null): Observable<ChatSearchPage> {
    return this.api.get<ChatSearchPage>(`chats/${chatId}/messages/search`, { q, ...(before ? { before } : {}) });
  }

  /** Archive (`true`) / unarchive the conversation in your own list. */
  setArchived(chatId: string, archived: boolean): Observable<ChatDetails> {
    return archived ? this.api.put<ChatDetails>(`chats/${chatId}/archive`) : this.api.delete<ChatDetails>(`chats/${chatId}/archive`);
  }

  deleteMessage(chatId: string, messageId: string): Observable<void> {
    return this.api.delete<void>(`chats/${chatId}/messages/${messageId}`);
  }

  // Group management (Super Administrators): metadata only — no message ever comes back from these.

  managedList(query: { q?: string; type?: ChatType; status?: ChatStatus; page: number; pageSize: number }): Observable<Page<ManagedChat>> {
    return this.api.get<Page<ManagedChat>>('admin/chats', { ...query });
  }

  managedDetails(chatId: string): Observable<ManagedChatDetails> {
    return this.api.get<ManagedChatDetails>(`admin/chats/${chatId}`);
  }

  setLocked(chatId: string, locked: boolean): Observable<ManagedChatDetails> {
    return this.api.post<ManagedChatDetails>(`admin/chats/${chatId}/${locked ? 'lock' : 'unlock'}`);
  }

  deleteManaged(chatId: string): Observable<void> {
    return this.api.delete<void>(`admin/chats/${chatId}`);
  }
}
