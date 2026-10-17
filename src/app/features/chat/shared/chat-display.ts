import { Lock, Megaphone, MessagesSquare, UserRound, Users, UsersRound, type IconNode } from 'lucide';

import type { ChatSummary, ChatType } from '../../../core/chat/chat.models';
import type { I18nService } from '../../../core/i18n/i18n.service';

/** The icon of each kind of conversation (a private chat shows the other person's picture instead). */
export const CHAT_TYPE_ICON: Readonly<Record<ChatType, IconNode>> = {
  private: UserRound,
  public: Megaphone,
  team: UsersRound,
  group: Users,
};

export const CHAT_ICONS = { lock: Lock, empty: MessagesSquare };

/** What a conversation is called for this reader: the other person, the company, the team, or the group's own name. */
export function chatTitle(chat: Pick<ChatSummary, 'type' | 'name' | 'nameAr' | 'peer'>, i18n: I18nService): string {
  switch (chat.type) {
    case 'private':
      return chat.peer ? i18n.pick(chat.peer.nameAr, chat.peer.nameEn) : i18n.t('chat.unknownPerson');
    case 'public':
      return i18n.t('chat.companyChat');
    case 'team':
      return i18n.pick(chat.nameAr, chat.name) || i18n.t('chat.types.team');
    default:
      return chat.name ?? '';
  }
}

/** The last message as the list shows it (who, for groups; deleted / unavailable said in words). */
export function lastMessagePreview(chat: ChatSummary, me: string | null, i18n: I18nService): string {
  const last = chat.lastMessage;
  if (!last) return i18n.t('chat.noMessagesYet');
  const text = last.deleted ? i18n.t('chat.messageDeleted') : last.unavailable || last.preview === null ? i18n.t('chat.messageUnavailable') : last.preview;
  return last.senderId === me ? i18n.t('chat.youPrefix', { text }) : text;
}
