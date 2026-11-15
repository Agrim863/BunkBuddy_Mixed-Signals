import { describe, expect, it } from 'vitest';
import { NAV_ITEMS } from './navigation';

describe('Navigation configuration', () => {
  it('defines all 8 required application sections in exact order', () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      'Overview',
      'My Attendance',
      'Bunk Simulator',
      'Mass Bunk Tracker',
      'Academic Calendar',
      'Timetable',
      'Analytics',
      'Settings',
    ]);
  });

  it('has unique route identifiers and searchable descriptions', () => {
    const ids = new Set(NAV_ITEMS.map((item) => item.id));
    expect(ids.size).toBe(8);
    for (const item of NAV_ITEMS) {
      expect(item.description.length).toBeGreaterThan(10);
      expect(item.keywords.length).toBeGreaterThan(0);
    }
  });
});
