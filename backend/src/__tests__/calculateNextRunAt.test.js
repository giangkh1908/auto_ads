import { jest } from '@jest/globals';
import {
  createContinuousSchedule,
  createDailySchedule,
  createCustomSchedule,
  createCustomDay,
  createTimeSlot,
} from './helpers/mockData.js';

// Import the function
const { calculateNextRunAt } = await import('../services/auto/autoRuleService.js');

describe('calculateNextRunAt', () => {
  let RealDate;

  beforeAll(() => {
    RealDate = Date;
  });

  afterEach(() => {
    global.Date = RealDate;
  });

  /**
   * Helper to mock current time
   * Uses local time representation to avoid timezone offset issues
   */
  const mockCurrentTime = (year, month, day, hours, minutes = 0, seconds = 0) => {
    // Month is 0-indexed in JavaScript Date
    const mockNow = new RealDate(year, month - 1, day, hours, minutes, seconds);
    
    global.Date = class extends RealDate {
      constructor(...args) {
        if (args.length === 0) {
          super(mockNow.getTime());
        } else {
          super(...args);
        }
      }
    };
    return mockNow;
  };

  /**
   * calN001: No schedule
   * Expected: null
   */
  test('calN001: should return null when schedule is null', () => {
    const result = calculateNextRunAt(null || {});
    expect(result).toBeNull();
  });

  /**
   * calN002: CONTINUOUS
   * Expected: new Date(now + 1min)
   */
  test('calN002: should return +1 minute for CONTINUOUS schedule', () => {
    const mockNow = mockCurrentTime(2024, 12, 6, 10, 0);
    
    const schedule = createContinuousSchedule();
    const result = calculateNextRunAt(schedule);

    expect(result).not.toBeNull();
    expect(result.getTime()).toBe(mockNow.getTime() + 1 * 60 * 1000);
  });

  /**
   * calN003: DAILY in range
   * type: "DAILY", daily_time: { start_time: "08:00", end_time: "18:00" }, now = 10:00
   * Expected: 10:30
   */
  test('calN003: should return +30 minutes for DAILY schedule within time range', () => {
    const mockNow = mockCurrentTime(2024, 12, 6, 10, 0); // 10:00 AM
    
    const schedule = createDailySchedule({
      start_time: '08:00',
      end_time: '18:00',
    });
    
    const result = calculateNextRunAt(schedule);

    expect(result).not.toBeNull();
    const expectedTime = mockNow.getTime() + 30 * 60 * 1000;
    expect(result.getTime()).toBe(expectedTime);
  });

  /**
   * calN004: DAILY near end
   * type: "DAILY", daily_time: { start: "08:00", end: "18:00" }, now = 17:45
   * Expected: Tomorrow 08:00
   */
  test('calN004: should return tomorrow start_time when near end of DAILY range', () => {
    const mockNow = mockCurrentTime(2024, 12, 6, 17, 45); // 5:45 PM
    
    const schedule = createDailySchedule({
      start_time: '08:00',
      end_time: '18:00',
    });
    
    const result = calculateNextRunAt(schedule);

    expect(result).not.toBeNull();
    expect(result.getHours()).toBe(8);
    expect(result.getMinutes()).toBe(0);
    expect(result.getDate()).toBe(mockNow.getDate() + 1);
  });

  /**
   * calN005: DAILY before start
   * type: "DAILY", daily_time: { start: "08:00", end: "18:00" }, now = 06:00
   * Expected: Today 08:00
   */
  test('calN005: should return today start_time when before DAILY range', () => {
    const mockNow = mockCurrentTime(2024, 12, 6, 6, 0); // 6:00 AM
    
    const schedule = createDailySchedule({
      start_time: '08:00',
      end_time: '18:00',
    });
    
    const result = calculateNextRunAt(schedule);

    expect(result).not.toBeNull();
    expect(result.getHours()).toBe(8);
    expect(result.getMinutes()).toBe(0);
    expect(result.getDate()).toBe(mockNow.getDate());
  });

  /**
   * calN006: DAILY after end
   * type: "DAILY", daily_time: { start: "08:00", end: "18:00" }, now = 19:00
   * Expected: Tomorrow 08:00
   */
  test('calN006: should return tomorrow start_time when after DAILY range', () => {
    const mockNow = mockCurrentTime(2024, 12, 6, 19, 0); // 7:00 PM
    
    const schedule = createDailySchedule({
      start_time: '08:00',
      end_time: '18:00',
    });
    
    const result = calculateNextRunAt(schedule);

    expect(result).not.toBeNull();
    expect(result.getHours()).toBe(8);
    expect(result.getMinutes()).toBe(0);
    expect(result.getDate()).toBe(mockNow.getDate() + 1);
  });

  /**
   * calN007: DAILY no config
   * type: "DAILY", daily_time: {}
   * Expected: new Date(now + 30min) (fallback)
   */
  test('calN007: should fallback to +30 minutes when DAILY config is empty', () => {
    const mockNow = mockCurrentTime(2024, 12, 6, 10, 0);
    
    const schedule = {
      type: 'DAILY',
      daily_time: {},
    };
    
    const result = calculateNextRunAt(schedule);

    expect(result).not.toBeNull();
    expect(result.getTime()).toBe(mockNow.getTime() + 30 * 60 * 1000);
  });

  /**
   * calN008: CUSTOM in slot
   * type: "CUSTOM", days: [{ day: "MONDAY", checked: true, time_slots: [{ start: "09:00", end: "17:00" }] }], now = Mon 10:00
   * Expected: Mon 10:30
   */
  test('calN008: should return +30 minutes for CUSTOM schedule within time slot', () => {
    const mockNow = mockCurrentTime(2024, 12, 9, 10, 0); // Monday 10:00 AM
    
    const schedule = createCustomSchedule({
      days: [
        createCustomDay({
          day: 'MONDAY',
          checked: true,
          time_slots: [
            createTimeSlot({
              start_time: '09:00',
              end_time: '17:00',
            }),
          ],
        }),
      ],
    });
    
    const result = calculateNextRunAt(schedule);

    expect(result).not.toBeNull();
    const expectedTime = mockNow.getTime() + 30 * 60 * 1000;
    expect(result.getTime()).toBe(expectedTime);
  });

  /**
   * calN009: CUSTOM near slot end
   * Same as calN008, now = Mon 16:45
   * Expected: Next slot or next day
   */
  test('calN009: should move to next slot when near end of CUSTOM time slot', () => {
    mockCurrentTime(2024, 12, 9, 16, 45); // Monday 4:45 PM
    
    const schedule = createCustomSchedule({
      days: [
        createCustomDay({
          day: 'MONDAY',
          checked: true,
          time_slots: [
            createTimeSlot({
              start_time: '09:00',
              end_time: '17:00',
            }),
            createTimeSlot({
              start_time: '18:00',
              end_time: '20:00',
            }),
          ],
        }),
      ],
    });
    
    const result = calculateNextRunAt(schedule);

    expect(result).not.toBeNull();
    expect(result.getHours()).toBe(18);
    expect(result.getMinutes()).toBe(0);
  });

  /**
   * calN010: CUSTOM before slot
   * Same as calN008, now = Mon 08:00
   * Expected: Today Mon 09:00
   */
  test('calN010: should return slot start_time when before CUSTOM time slot', () => {
    const mockNow = mockCurrentTime(2024, 12, 9, 8, 0); // Monday 8:00 AM
    
    const schedule = createCustomSchedule({
      days: [
        createCustomDay({
          day: 'MONDAY',
          checked: true,
          time_slots: [
            createTimeSlot({
              start_time: '09:00',
              end_time: '17:00',
            }),
          ],
        }),
      ],
    });
    
    const result = calculateNextRunAt(schedule);

    expect(result).not.toBeNull();
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(0);
    expect(result.getDate()).toBe(mockNow.getDate());
  });

  /**
   * calN011: CUSTOM day disabled
   * type: "CUSTOM", days: [{ day: "MONDAY", checked: false }], now = Monday
   * Expected: Next active day
   */
  test('calN011: should find next active day when current day is disabled', () => {
    mockCurrentTime(2024, 12, 9, 10, 0); // Monday
    
    const schedule = createCustomSchedule({
      days: [
        createCustomDay({
          day: 'MONDAY',
          checked: false,
        }),
        createCustomDay({
          day: 'TUESDAY',
          checked: true,
          time_slots: [
            createTimeSlot({
              start_time: '09:00',
              end_time: '17:00',
            }),
          ],
        }),
      ],
    });
    
    const result = calculateNextRunAt(schedule);

    expect(result).not.toBeNull();
    expect(result.getDay()).toBe(2); // Tuesday
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(0);
  });

  /**
   * calN012: CUSTOM multiple slots
   * days: [{ day: "MON", time_slots: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "17:00" }] }], now = 11:45
   * Expected: 14:00
   */
  test('calN012: should move to next time slot in CUSTOM schedule with multiple slots', () => {
    mockCurrentTime(2024, 12, 9, 11, 45); // Monday 11:45 AM
    
    const schedule = createCustomSchedule({
      days: [
        createCustomDay({
          day: 'MONDAY',
          checked: true,
          time_slots: [
            createTimeSlot({
              start_time: '09:00',
              end_time: '12:00',
            }),
            createTimeSlot({
              start_time: '14:00',
              end_time: '17:00',
            }),
          ],
        }),
      ],
    });
    
    const result = calculateNextRunAt(schedule);

    expect(result).not.toBeNull();
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(0);
  });

  /**
   * calN013: CUSTOM last slot
   * Same as calN012, now = 16:45
   * Expected: Next active day
   */
  test('calN013: should move to next active day when in last slot of current day', () => {
    mockCurrentTime(2024, 12, 9, 16, 45); // Monday 4:45 PM
    
    const schedule = createCustomSchedule({
      days: [
        createCustomDay({
          day: 'MONDAY',
          checked: true,
          time_slots: [
            createTimeSlot({
              start_time: '09:00',
              end_time: '12:00',
            }),
            createTimeSlot({
              start_time: '14:00',
              end_time: '17:00',
            }),
          ],
        }),
        createCustomDay({
          day: 'TUESDAY',
          checked: true,
          time_slots: [
            createTimeSlot({
              start_time: '09:00',
              end_time: '17:00',
            }),
          ],
        }),
      ],
    });
    
    const result = calculateNextRunAt(schedule);

    expect(result).not.toBeNull();
    expect(result.getDay()).toBe(2); // Tuesday
    expect(result.getHours()).toBe(9);
  });

  /**
   * calN014: CUSTOM no active days
   * type: "CUSTOM", days: [all checked: false]
   * Expected: null
   */
  test('calN014: should return null when no days are active in CUSTOM schedule', () => {
    const schedule = createCustomSchedule({
      days: [
        createCustomDay({ day: 'MONDAY', checked: false }),
        createCustomDay({ day: 'TUESDAY', checked: false }),
        createCustomDay({ day: 'WEDNESDAY', checked: false }),
        createCustomDay({ day: 'THURSDAY', checked: false }),
        createCustomDay({ day: 'FRIDAY', checked: false }),
        createCustomDay({ day: 'SATURDAY', checked: false }),
        createCustomDay({ day: 'SUNDAY', checked: false }),
      ],
    });
    
    const result = calculateNextRunAt(schedule);

    expect(result).toBeNull();
  });

  /**
   * calN015: CUSTOM wrap week
   * type: "CUSTOM", days: [only MONDAY checked], now = Sunday
   * Expected: Next Monday
   */
  test('calN015: should wrap to next week when only future day in week is active', () => {
    mockCurrentTime(2024, 12, 8, 10, 0); // Sunday
    
    const schedule = createCustomSchedule({
      days: [
        createCustomDay({
          day: 'SUNDAY',
          checked: false,
        }),
        createCustomDay({
          day: 'MONDAY',
          checked: true,
          time_slots: [
            createTimeSlot({
              start_time: '09:00',
              end_time: '17:00',
            }),
          ],
        }),
      ],
    });
    
    const result = calculateNextRunAt(schedule);

    expect(result).not.toBeNull();
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(0);
    expect(result.getDate()).toBe(9); // Next day (Dec 9)
  });
});
