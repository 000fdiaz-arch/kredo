export function toDateInputValue(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function getCycleRange(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const secondCloseDay = Math.min(30, lastDay);

  if (day <= 15) {
    return {
      startDate: `${year}-${String(month).padStart(2, "0")}-01`,
      endDate: `${year}-${String(month).padStart(2, "0")}-15`,
    };
  }

  return {
    startDate: `${year}-${String(month).padStart(2, "0")}-16`,
    endDate: `${year}-${String(month).padStart(2, "0")}-${String(secondCloseDay).padStart(2, "0")}`,
  };
}

export function getNextCycleRange(dateValue: string) {
  const current = getCycleRange(dateValue);
  const [year, month, day] = current.endDate.split("-").map(Number);

  if (day === 15) {
    return getCycleRange(`${year}-${String(month).padStart(2, "0")}-16`);
  }

  const nextMonthDate = new Date(year, month, 1);
  return getCycleRange(toDateInputValue(nextMonthDate));
}

export function getNextCloseDate(fromDateValue = toDateInputValue()) {
  const current = getCycleRange(fromDateValue);

  if (current.endDate >= fromDateValue) {
    return current.endDate;
  }

  return getNextCycleRange(fromDateValue).endDate;
}

export function listDueCycleRanges(startDateValue: string, asOfDateValue = toDateInputValue()) {
  const cycles: Array<{ startDate: string; endDate: string }> = [];
  let current = getCycleRange(startDateValue);

  while (current.endDate <= asOfDateValue) {
    cycles.push(current);
    current = getNextCycleRange(current.endDate);
  }

  return cycles;
}
