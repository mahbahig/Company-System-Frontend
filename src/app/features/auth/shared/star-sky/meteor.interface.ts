/** One meteor of the {@link MeteorShower} pool, in CSS pixels with y pointing up. */
export interface Meteor {
  active: boolean;
  /** Head position. */
  x: number;
  y: number;
  /** Direction of travel. */
  angle: number;
  /** Pixels per second. */
  speed: number;
  /** Full tail length, reached shortly after the meteor appears. */
  tail: number;
  /** Thickness multiplier. */
  scale: number;
  brightness: number;
  /** 0 = the cool tail colour, 1 = the warm one. */
  tint: number;
  age: number;
  life: number;
}
