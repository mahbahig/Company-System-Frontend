/** Query accepted by `GET /<entity>/:id/timeline` (`TimelineQueryDto`). */
export interface TimelineQuery {
  type?: string;
  from?: string;
  to?: string;
  opportunityId?: string;
}
