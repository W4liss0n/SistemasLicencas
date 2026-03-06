export type SubscriptionWindowInput = {
  vigenciaMode: 'monthly' | 'yearly' | 'custom_end';
  hasCustomStart: boolean;
  startDate?: string;
  startTime?: string;
  endDay?: string;
  endMonth?: string;
  endYear?: string;
  endTime?: string;
};

export type SubscriptionWindow = {
  startAt?: string;
  endAt: string;
};

export function buildSubscriptionWindow(
  input: SubscriptionWindowInput,
  now: Date = new Date()
): SubscriptionWindow {
  const start = input.hasCustomStart
    ? buildDateFromDateAndTime(input.startDate, input.startTime, 'subscription_start_at')
    : now;

  const end = (() => {
    if (input.vigenciaMode === 'monthly') {
      const date = new Date(start);
      date.setMonth(date.getMonth() + 1);
      return date;
    }

    if (input.vigenciaMode === 'yearly') {
      const date = new Date(start);
      date.setFullYear(date.getFullYear() + 1);
      return date;
    }

    return buildDateFromParts(
      input.endDay,
      input.endMonth,
      input.endYear,
      input.endTime,
      'subscription_end_at'
    );
  })();

  if (end.getTime() <= start.getTime()) {
    throw new Error('subscription_end_at must be greater than subscription_start_at');
  }

  return {
    startAt: input.hasCustomStart ? start.toISOString() : undefined,
    endAt: end.toISOString()
  };
}

function buildDateFromDateAndTime(
  dateValue: string | undefined,
  timeValue: string | undefined,
  field: string
): Date {
  if (!dateValue) {
    throw new Error(`${field} date is required`);
  }

  const [yearRaw, monthRaw, dayRaw] = dateValue.split('-');
  return buildDate(
    Number(yearRaw),
    Number(monthRaw),
    Number(dayRaw),
    timeValue,
    field
  );
}

function buildDateFromParts(
  dayValue: string | undefined,
  monthValue: string | undefined,
  yearValue: string | undefined,
  timeValue: string | undefined,
  field: string
): Date {
  return buildDate(
    Number(dayValue),
    Number(monthValue),
    Number(yearValue),
    timeValue,
    field,
    true
  );
}

function buildDate(
  first: number,
  second: number,
  third: number,
  timeValue: string | undefined,
  field: string,
  isDayMonthYear = false
): Date {
  if (!timeValue) {
    throw new Error(`${field} time is required`);
  }

  const [hoursRaw, minutesRaw] = timeValue.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  const year = isDayMonthYear ? third : first;
  const month = isDayMonthYear ? second : second;
  const day = isDayMonthYear ? first : third;

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes)
  ) {
    throw new Error(`${field} must be a valid local date`);
  }

  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hours ||
    date.getMinutes() !== minutes
  ) {
    throw new Error(`${field} must be a valid local date`);
  }

  return date;
}
