/** JOUR-01/02 milestone on the opportunity's customer journey. i18n key suffix: `opportunities.journey.<code>`. */
export interface JourneyMilestone {
  code: string;
  state: 'completed' | 'current' | 'upcoming';
  completedAt?: string | null;
}
