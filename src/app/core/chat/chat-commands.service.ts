import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { RealtimeService } from '../realtime/realtime.service';
import { CHAT_COMMANDS, type ChatAck, type ChatMessage } from './chat.models';

/**
 * Chat over the application's one realtime connection: the commands this
 * browser sends (each answered by the server's acknowledgement) and the
 * events it receives. The server decides everything — who the sender is,
 * membership, admin-only, locks; nothing here is trusted by it.
 */
@Service()
export class ChatCommands {
  private readonly realtime = inject(RealtimeService);

  readonly connected = this.realtime.connected;
  readonly connections = this.realtime.connections;

  on<T>(event: string): Observable<T> {
    return this.realtime.on<T>(event);
  }

  /** Stored (encrypted) first, then delivered; the acknowledgement carries the stored message. */
  send(chatId: string, clientMessageId: string, text: string): Promise<ChatAck<{ message: ChatMessage }>> {
    return this.realtime.request<ChatAck<{ message: ChatMessage }>>(CHAT_COMMANDS.send, { chatId, clientMessageId, text });
  }

  markRead(chatId: string, seq: number): Promise<ChatAck<{ readSeq: number }>> {
    return this.realtime.request<ChatAck<{ readSeq: number }>>(CHAT_COMMANDS.read, { chatId, seq });
  }

  markDelivered(chatId: string, seq: number): Promise<ChatAck<{ deliveredSeq: number }>> {
    return this.realtime.request<ChatAck<{ deliveredSeq: number }>>(CHAT_COMMANDS.delivered, { chatId, seq });
  }

  /** Delivered positions of several conversations in one command (the list loaded, or messages arrived together). */
  markDeliveredMany(items: Array<{ chatId: string; seq: number }>): Promise<ChatAck<{ delivered: Array<{ chatId: string; deliveredSeq: number }> }>> {
    return this.realtime.request<ChatAck<{ delivered: Array<{ chatId: string; deliveredSeq: number }> }>>(CHAT_COMMANDS.deliveredMany, { items });
  }

  typing(chatId: string, typing: boolean): Promise<ChatAck> {
    return this.realtime.request<ChatAck>(typing ? CHAT_COMMANDS.typingStart : CHAT_COMMANDS.typingStop, { chatId }, 4_000);
  }
}
