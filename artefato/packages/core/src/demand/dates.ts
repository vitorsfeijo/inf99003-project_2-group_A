/**
 * Utilitários para manipulação de datas em formato YYYY-MM-DD
 */

export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Adiciona N dias corridos a uma data
 */
export function addCalendarDays(dateStr: string, days: number): string {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

/**
 * Retorna a diferença em dias corridos entre d2 e d1 (d2 - d1)
 */
export function differenceInCalendarDays(dateStr2: string, dateStr1: string): number {
  const d1 = parseDate(dateStr1);
  const d2 = parseDate(dateStr2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 3600 * 24));
}

/**
 * Retorna se um dia é útil (segunda a sexta) se nenhum calendário customizado for informado.
 * 0 = Domingo, 6 = Sábado
 */
export function isStandardWorkingDay(dateStr: string): boolean {
  const date = parseDate(dateStr);
  const dayOfWeek = date.getDay();
  return dayOfWeek !== 0 && dayOfWeek !== 6;
}

/**
 * Gera a lista de N dias úteis futuros a partir de uma data inicial.
 */
export function getWorkingDaysHorizon(startDateStr: string, horizonCount: number): string[] {
  const workingDays: string[] = [];
  let currDate = startDateStr;

  while (workingDays.length < horizonCount) {
    if (isStandardWorkingDay(currDate)) {
      workingDays.push(currDate);
    }
    currDate = addCalendarDays(currDate, 1);
  }

  return workingDays;
}
