/** Previous calendar month in UTC (e.g. generated in April → covers March). */
export function previousMonthRangeUtc(reference = new Date()): {
  start: Date;
  end: Date;
  labelLong: string;
  labelShort: string;
} {
  const y = reference.getUTCFullYear();
  const m = reference.getUTCMonth();
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  const mo = String(start.getUTCMonth() + 1).padStart(2, "0");
  const labelShort = `${start.getUTCFullYear()}-${mo}`;
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const labelLong = `${names[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
  return { start, end, labelLong, labelShort };
}
