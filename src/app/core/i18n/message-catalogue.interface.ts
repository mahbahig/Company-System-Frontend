/** A nested AR/EN message catalogue, as stored in `messages/<locale>.json`. */
export interface MessageCatalogue {
  [key: string]: string | MessageCatalogue;
}
