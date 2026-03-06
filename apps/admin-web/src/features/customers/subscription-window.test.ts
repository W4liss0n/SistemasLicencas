import { describe, expect, it } from 'vitest';
import {
  buildSubscriptionWindow,
  type SubscriptionWindowInput
} from './subscription-window';

function localIso(year: number, month: number, day: number, hour: number, minute = 0): string {
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

function makeInput(
  overrides: Partial<SubscriptionWindowInput> = {}
): SubscriptionWindowInput {
  return {
    vigenciaMode: 'monthly',
    hasCustomStart: true,
    startDate: '2026-03-05',
    startTime: '10:00',
    endDay: '',
    endMonth: '',
    endYear: '',
    endTime: '00:00',
    ...overrides
  };
}

describe('buildSubscriptionWindow', () => {
  it('builds monthly window from a custom start date', () => {
    const window = buildSubscriptionWindow(makeInput(), new Date('2026-03-01T00:00:00.000Z'));

    expect(window.startAt).toBe(localIso(2026, 3, 5, 10));
    expect(window.endAt).toBe(localIso(2026, 4, 5, 10));
  });

  it('builds yearly window from now when custom start is disabled', () => {
    const window = buildSubscriptionWindow(
      makeInput({
        vigenciaMode: 'yearly',
        hasCustomStart: false
      }),
      new Date('2026-03-05T12:30:00.000Z')
    );

    expect(window.startAt).toBeUndefined();
    expect(window.endAt).toBe('2027-03-05T12:30:00.000Z');
  });

  it('builds custom end date from separate day, month, year and time fields', () => {
    const window = buildSubscriptionWindow(
      makeInput({
        vigenciaMode: 'custom_end',
        endDay: '25',
        endMonth: '12',
        endYear: '2026',
        endTime: '18:00'
      }),
      new Date('2026-03-01T00:00:00.000Z')
    );

    expect(window.startAt).toBe(localIso(2026, 3, 5, 10));
    expect(window.endAt).toBe(localIso(2026, 12, 25, 18));
  });

  it('rejects end dates that are not after the start', () => {
    expect(() =>
      buildSubscriptionWindow(
        makeInput({
          vigenciaMode: 'custom_end',
          endDay: '05',
          endMonth: '03',
          endYear: '2026',
          endTime: '09:00'
        }),
        new Date('2026-03-01T00:00:00.000Z')
      )
    ).toThrow('subscription_end_at must be greater than subscription_start_at');
  });
});
