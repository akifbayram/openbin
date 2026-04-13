/**
 * Compute the page-number sequence for a numeric pager, compressing long lists with ellipses.
 *
 *   total ≤ 7: every page shown
 *   near start: 1 2 3 4 … last
 *   near end:   1 … n-3 n-2 n-1 last
 *   middle:     1 … prev curr next … last
 */
export function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [1];

  if (current <= 3) {
    for (let i = 2; i <= 4; i++) pages.push(i);
    pages.push('ellipsis', total);
  } else if (current >= total - 2) {
    pages.push('ellipsis');
    for (let i = total - 3; i <= total; i++) pages.push(i);
  } else {
    pages.push('ellipsis', current - 1, current, current + 1, 'ellipsis', total);
  }

  return pages;
}
