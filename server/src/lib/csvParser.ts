/** RFC 4180 CSV parser. Returns a 2D array of strings. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuoted = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuoted) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuoted = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else if (ch === '"' && field === '') {
      inQuoted = true;
      i++;
    } else if (ch === ',') {
      row.push(field);
      field = '';
      i++;
    } else if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i += 2;
    } else if (ch === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i++;
    } else {
      field += ch;
      i++;
    }
  }

  // Push last field/row if non-empty
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
