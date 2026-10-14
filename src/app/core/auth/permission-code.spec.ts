import { isReadPermission } from './permission-code';

describe('isReadPermission', () => {
  it('treats views, dashboards and downloads as read-only', () => {
    expect(isReadPermission('customers.view')).toBe(true);
    expect(isReadPermission('meetings.view_locations')).toBe(true);
    expect(isReadPermission('dashboards.view_executive')).toBe(true);
    expect(isReadPermission('data.export')).toBe(true);
  });

  it('treats every change as a write', () => {
    expect(isReadPermission('customers.edit')).toBe(false);
    expect(isReadPermission('approvals.decide')).toBe(false);
    expect(isReadPermission('leads.assign')).toBe(false);
  });
});
