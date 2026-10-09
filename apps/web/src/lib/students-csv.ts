import type { CreateStudentRequest, Gender, GuardianInput, StudentStatus } from '@unity/types';

export interface PreparedStudentImport {
  row: number;
  student: CreateStudentRequest;
  placeholders: string[];
}

export interface RejectedStudentImport {
  row: number;
  message: string;
}

export interface StudentCsvParseResult {
  students: PreparedStudentImport[];
  rejected: RejectedStudentImport[];
}

const FIRST_NAME_HEADERS = new Set(['emri', 'firstname', 'first', 'givenname']);
const LAST_NAME_HEADERS = new Set(['mbiemri', 'lastname', 'last', 'surname', 'familyname']);
const FULL_NAME_HEADERS = new Set([
  'emriiplote',
  'fullname',
  'emermbiemer',
  'emridhembiemri',
  'studenti',
  'student',
  'name',
]);
const AGE_HEADERS = new Set(['mosha', 'age']);
const PHONE_HEADERS = new Set(['telefoni', 'phone', 'tel', 'mobile', 'nrtel', 'numriitel']);
const EMAIL_HEADERS = new Set(['email', 'emaili', 'mail']);
const SCHOOL_HEADERS = new Set(['shkolla', 'school']);
const ADDRESS_HEADERS = new Set(['adresa', 'address']);
const BIRTH_HEADERS = new Set(['datelindja', 'dateofbirth', 'dob', 'birthday', 'birthdate']);
const REGISTRATION_HEADERS = new Set([
  'dataeregjistrimit',
  'registrationdate',
  'registered',
  'dataregjistrimit',
  'regjistrimi',
]);
const GENDER_HEADERS = new Set(['gjinia', 'gender', 'sex']);
const STATUS_HEADERS = new Set(['statusi', 'status']);
const NOTES_HEADERS = new Set(['shenime', 'notes', 'koment', 'komente']);
const GUARDIAN_HEADERS = new Set(['prindi', 'guardian', 'kujdestari', 'parent', 'prinderit']);
const GUARDIAN_PHONE_HEADERS = new Set(['telefoniiprindit', 'guardianphone', 'parentphone']);

export function parseStudentCsv(text: string): StudentCsvParseResult {
  const table = parseTable(text);
  if (table.length === 0) {
    return { students: [], rejected: [{ row: 1, message: 'The file is empty.' }] };
  }

  const headerIndex = table.findIndex((row) => row.some((cell) => isKnownHeader(headerKey(cell))));
  if (headerIndex < 0) {
    return {
      students: [],
      rejected: [{ row: 1, message: 'Add a header row with Emri and Mbiemri, or a full name column.' }],
    };
  }

  const headerCells = table[headerIndex] ?? [];
  const headers = headerCells.map(headerKey);
  const columns = mapColumns(headers, headerCells);
  if (columns.firstName == null && columns.fullName == null) {
    return {
      students: [],
      rejected: [{ row: headerIndex + 1, message: 'The file needs Emri, Mbiemri, or a full name column.' }],
    };
  }

  const students: PreparedStudentImport[] = [];
  const rejected: RejectedStudentImport[] = [];

  table.forEach((cells, index) => {
    if (index <= headerIndex) return;
    const rowNumber = index + 1;
    if (cells.every((cell) => cell.trim() === '')) return;

    const prepared = prepareRow(cells, columns, rowNumber);
    if ('message' in prepared) {
      rejected.push({ row: rowNumber, message: prepared.message });
      return;
    }
    students.push(prepared);
  });

  if (students.length === 0 && rejected.length === 0) {
    rejected.push({ row: headerIndex + 2, message: 'No student rows were found under the header.' });
  }

  return { students: students.slice(0, 500), rejected };
}

export function studentCsvTemplate() {
  return [
    'Emri,Mbiemri,Mosha,Telefoni,Email,Shkolla,Data e regjistrimit,Prindi',
    'Olti,Uka,12,049181742,olti.uka@example.com,Shkolla fillore,09.10.2026,Arta Uka',
  ].join('\n');
}

function prepareRow(
  cells: string[],
  columns: ColumnMap,
  rowNumber: number,
): PreparedStudentImport | { message: string } {
  const read = (index?: number) => (index == null ? '' : (cells[index] ?? '').trim());
  const placeholders: string[] = [];
  const names = resolveNames(read(columns.firstName), read(columns.lastName), read(columns.fullName));
  if (!names) {
    return { message: 'First name and last name are missing.' };
  }

  let { firstName, lastName } = names;
  if (!lastName) {
    lastName = 'Student';
    placeholders.push('last name');
  }
  if (!firstName) {
    firstName = 'Student';
    placeholders.push('first name');
  }

  const birthDate = parseDate(read(columns.dateOfBirth));
  let age = parseAge(read(columns.age));
  if (age == null && birthDate) age = ageFromDate(birthDate);

  const phone = normalizePhone(read(columns.phone));
  const rawEmail = read(columns.email).toLowerCase();
  const email = rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : undefined;

  const registrationDate = parseDate(read(columns.registrationDate)) ?? todayInputDate();
  if (!parseDate(read(columns.registrationDate))) placeholders.push('registration date');

  const gender = parseGender(read(columns.gender));
  const status = parseStatus(read(columns.status));
  const school = read(columns.school) || undefined;
  const address = read(columns.address) || undefined;
  const guardian = guardianFrom(read(columns.guardian), read(columns.guardianPhone));

  const extraNotes = columns.extras
    .map((extra) => {
      const value = read(extra.index);
      return value ? `${extra.label}: ${value}` : '';
    })
    .filter(Boolean);
  const ownNotes = read(columns.notes);
  const notes = [
    ownNotes,
    ...extraNotes,
    placeholders.length ? `Placeholder values: ${placeholders.join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    row: rowNumber,
    placeholders,
    student: {
      firstName,
      lastName,
      age,
      phone: phone || undefined,
      email,
      school,
      address,
      dateOfBirth: birthDate,
      gender,
      status,
      registrationDate,
      notes: notes || undefined,
      guardians: guardian ? [guardian] : undefined,
    },
  };
}

function resolveNames(first: string, last: string, full: string) {
  if (first || last) {
    if (!last && first.includes(' ')) {
      const parts = first.split(/\s+/);
      return { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1) ?? '' };
    }
    if (!first && last.includes(' ')) {
      const parts = last.split(/\s+/);
      return { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1) ?? '' };
    }
    return { firstName: first, lastName: last };
  }

  if (!full) return null;
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0] ?? '', lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1) ?? '' };
}

function guardianFrom(name: string, phone: string): GuardianInput | undefined {
  if (!name) return undefined;
  const parts = name.split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? 'Prind';
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : 'Prind';
  const guardianPhone = normalizePhone(phone);
  return {
    firstName,
    lastName,
    relationship: 'GUARDIAN',
    phone: guardianPhone || undefined,
  };
}

interface ColumnMap {
  firstName?: number;
  lastName?: number;
  fullName?: number;
  age?: number;
  phone?: number;
  email?: number;
  school?: number;
  address?: number;
  dateOfBirth?: number;
  registrationDate?: number;
  gender?: number;
  status?: number;
  notes?: number;
  guardian?: number;
  guardianPhone?: number;
  extras: Array<{ index: number; label: string }>;
}

function mapColumns(headers: string[], labels: string[]): ColumnMap {
  const columns: ColumnMap = { extras: [] };
  const used = new Set<number>();

  const take = (match: Set<string>, assign: (index: number) => void) => {
    const index = headers.findIndex((header, position) => header && match.has(header) && !used.has(position));
    if (index >= 0) {
      used.add(index);
      assign(index);
    }
  };

  take(FIRST_NAME_HEADERS, (index) => {
    columns.firstName = index;
  });
  take(LAST_NAME_HEADERS, (index) => {
    columns.lastName = index;
  });
  take(FULL_NAME_HEADERS, (index) => {
    columns.fullName = index;
  });
  take(AGE_HEADERS, (index) => {
    columns.age = index;
  });
  take(PHONE_HEADERS, (index) => {
    columns.phone = index;
  });
  take(EMAIL_HEADERS, (index) => {
    columns.email = index;
  });
  take(SCHOOL_HEADERS, (index) => {
    columns.school = index;
  });
  take(ADDRESS_HEADERS, (index) => {
    columns.address = index;
  });
  take(BIRTH_HEADERS, (index) => {
    columns.dateOfBirth = index;
  });
  take(REGISTRATION_HEADERS, (index) => {
    columns.registrationDate = index;
  });
  take(GENDER_HEADERS, (index) => {
    columns.gender = index;
  });
  take(STATUS_HEADERS, (index) => {
    columns.status = index;
  });
  take(NOTES_HEADERS, (index) => {
    columns.notes = index;
  });
  take(GUARDIAN_HEADERS, (index) => {
    columns.guardian = index;
  });
  take(GUARDIAN_PHONE_HEADERS, (index) => {
    columns.guardianPhone = index;
  });

  headers.forEach((header, index) => {
    if (!header || used.has(index)) return;
    columns.extras.push({ index, label: labels[index]?.trim() || header });
  });

  return columns;
}

function parseTable(text: string) {
  const source = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const delimiter = detectDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (quoted && char === '"' && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && char === delimiter) {
      row.push(cell.trim());
      cell = '';
      continue;
    }
    if (!quoted && char === '\n') {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += char ?? '';
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((value) => value !== ''));
}

function detectDelimiter(text: string) {
  const line = text.split('\n').find((entry) => entry.trim()) ?? '';
  const counts = [
    { delimiter: ',', count: line.split(',').length },
    { delimiter: ';', count: line.split(';').length },
    { delimiter: '\t', count: line.split('\t').length },
  ];
  counts.sort((a, b) => b.count - a.count);
  return counts[0] && counts[0].count > 1 ? counts[0].delimiter : ',';
}

function isKnownHeader(key: string) {
  return (
    FIRST_NAME_HEADERS.has(key) ||
    LAST_NAME_HEADERS.has(key) ||
    FULL_NAME_HEADERS.has(key) ||
    AGE_HEADERS.has(key) ||
    PHONE_HEADERS.has(key) ||
    EMAIL_HEADERS.has(key)
  );
}

function headerKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function parseAge(value: string) {
  if (!value) return undefined;
  const age = Number(value.replace(',', '.'));
  if (!Number.isInteger(age) || age < 1 || age > 120) return undefined;
  return age;
}

function parseDate(value: string) {
  if (!value) return undefined;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const local = /^(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(value);
  const year = Number(iso?.[1] ?? local?.[3]);
  const month = Number(iso?.[2] ?? local?.[2]);
  const day = Number(iso?.[3] ?? local?.[1]);
  if (!year || !month || !day) return undefined;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return undefined;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function ageFromDate(value: string) {
  const parsed = parseDate(value);
  if (!parsed) return undefined;
  const [year, month, day] = parsed.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  const today = new Date();
  let age = today.getFullYear() - year;
  const birthdayPassed = today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!birthdayPassed) age -= 1;
  return age >= 1 && age <= 120 ? age : undefined;
}

function parseGender(value: string): Gender | undefined {
  const key = headerKey(value);
  if (['m', 'male', 'mashkull', 'djal'].includes(key)) return 'MALE';
  if (['f', 'female', 'femer', 'vajze'].includes(key)) return 'FEMALE';
  if (['other', 'tjeter'].includes(key)) return 'OTHER';
  return undefined;
}

function parseStatus(value: string): StudentStatus {
  const key = headerKey(value);
  if (['inactive', 'pasiv', 'joaktiv'].includes(key)) return 'INACTIVE';
  if (['paused', 'pezull'].includes(key)) return 'PAUSED';
  if (['graduated', 'dipllomuar', 'diplomuar'].includes(key)) return 'GRADUATED';
  return 'ACTIVE';
}

function normalizePhone(value: string) {
  const compact = value.replace(/[^\d+]/g, '');
  return /^[0-9+()\-\s]{6,20}$/.test(value.trim()) ? value.trim() : compact.length >= 6 ? compact : '';
}

function todayInputDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
