import type { TuitionQuote } from '@unity/types';
import { Prisma } from '@prisma/client';

const ZERO = new Prisma.Decimal(0);

export interface TuitionLineInput {
  enrollmentId: string;
  courseId: string;
  courseName: string;
  groupName: string;
  agreedMonthlyPrice: Prisma.Decimal;
  manualDiscount: Prisma.Decimal;
}

export interface DiscountRates {
  multiCoursePercent: number;
  familyPercent: number;
}

const DEFAULT_RATES: DiscountRates = { multiCoursePercent: 10, familyPercent: 10 };

export function emptyTuitionQuote(rates: DiscountRates = DEFAULT_RATES): TuitionQuote {
  return {
    courseCount: 0,
    familyPack: false,
    familyStudentNames: [],
    grossAmount: '0.00',
    manualDiscount: '0.00',
    multiCourseDiscount: '0.00',
    familyDiscount: '0.00',
    netAmount: '0.00',
    multiCourseRate: percentLabel(rates.multiCoursePercent),
    familyRate: percentLabel(rates.familyPercent),
    lines: [],
    summary: 'No active billed courses.',
  };
}

export function buildTuitionQuote(
  lines: TuitionLineInput[],
  familyStudentNames: string[],
  rates: DiscountRates = DEFAULT_RATES,
): TuitionQuote {
  const multiRate = new Prisma.Decimal(rates.multiCoursePercent).div(100);
  const familyRate = new Prisma.Decimal(rates.familyPercent).div(100);
  if (!lines.length) return emptyTuitionQuote(rates);

  const courseNets = new Map<string, { courseName: string; net: Prisma.Decimal }>();
  for (const line of lines) {
    const manual = clampDiscount(line.agreedMonthlyPrice, line.manualDiscount);
    const net = line.agreedMonthlyPrice.minus(manual);
    const current = courseNets.get(line.courseId);
    if (current) {
      current.net = current.net.plus(net);
    } else {
      courseNets.set(line.courseId, { courseName: line.courseName, net });
    }
  }

  const ranked = [...courseNets.entries()].sort((left, right) => {
    if (left[1].net.gt(right[1].net)) return -1;
    if (left[1].net.lt(right[1].net)) return 1;
    return left[1].courseName.localeCompare(right[1].courseName);
  });
  const primaryCourseId = ranked[0]?.[0] ?? null;

  let gross = ZERO;
  let manualTotal = ZERO;
  let multiTotal = ZERO;
  const quoteLines = lines.map((line) => {
    const manual = clampDiscount(line.agreedMonthlyPrice, line.manualDiscount);
    const base = line.agreedMonthlyPrice.minus(manual);
    const isExtraCourse = primaryCourseId !== null && line.courseId !== primaryCourseId;
    const multiCourseDiscount = isExtraCourse ? money(base.mul(multiRate)) : ZERO;
    gross = gross.plus(line.agreedMonthlyPrice);
    manualTotal = manualTotal.plus(manual);
    multiTotal = multiTotal.plus(multiCourseDiscount);
    return {
      enrollmentId: line.enrollmentId,
      courseId: line.courseId,
      courseName: line.courseName,
      groupName: line.groupName,
      listPrice: line.agreedMonthlyPrice.toFixed(2),
      manualDiscount: manual.toFixed(2),
      multiCourseDiscount: multiCourseDiscount.toFixed(2),
      isExtraCourse,
    };
  });

  const afterMulti = gross.minus(manualTotal).minus(multiTotal);
  const names = [...new Set(familyStudentNames.map((name) => name.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
  const familyPack = names.length > 0 && afterMulti.gt(0);
  const familyDiscount = familyPack ? money(afterMulti.mul(familyRate)) : ZERO;
  const net = Prisma.Decimal.max(ZERO, afterMulti.minus(familyDiscount));

  const quote: TuitionQuote = {
    courseCount: courseNets.size,
    familyPack,
    familyStudentNames: names,
    grossAmount: gross.toFixed(2),
    manualDiscount: manualTotal.toFixed(2),
    multiCourseDiscount: multiTotal.toFixed(2),
    familyDiscount: familyDiscount.toFixed(2),
    netAmount: net.toFixed(2),
    multiCourseRate: percentLabel(rates.multiCoursePercent),
    familyRate: percentLabel(rates.familyPercent),
    lines: quoteLines,
    summary: '',
  };
  quote.summary = describeTuition(quote);
  return quote;
}

function describeTuition(quote: TuitionQuote): string {
  const parts: string[] = [];
  if (new Prisma.Decimal(quote.manualDiscount).gt(0)) {
    parts.push(`Enrollment discount EUR ${quote.manualDiscount}.`);
  }
  if (quote.courseCount > 1 && new Prisma.Decimal(quote.multiCourseDiscount).gt(0)) {
    const extras = [...new Set(quote.lines.filter((line) => line.isExtraCourse).map((line) => line.courseName))];
    parts.push(`Extra course ${quote.multiCourseRate}% off (${extras.join(', ')}): EUR ${quote.multiCourseDiscount}.`);
  }
  if (quote.familyPack && new Prisma.Decimal(quote.familyDiscount).gt(0)) {
    parts.push(`Family pack ${quote.familyRate}% off with ${quote.familyStudentNames.join(', ')}: EUR ${quote.familyDiscount}.`);
  }
  if (!parts.length) return 'Monthly tuition has no multi-course or family discount.';
  parts.push(`Amount due EUR ${quote.netAmount}.`);
  return parts.join(' ');
}

function clampDiscount(price: Prisma.Decimal, discount: Prisma.Decimal): Prisma.Decimal {
  if (discount.lte(0)) return ZERO;
  if (discount.gte(price)) return price;
  return discount;
}

function money(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2);
}

function percentLabel(value: number): string {
  const fixed = new Prisma.Decimal(value).toFixed(2);
  return fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed;
}
