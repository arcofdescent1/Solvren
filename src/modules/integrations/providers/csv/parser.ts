/**
 * Phase 3 — CSV parser for ingestion.
 * Supports UTF-8, configurable delimiter/quote, header row required.
 */
export type CsvParseOptions = {
  delimiter?: string;
  quote?: string;
  maxFileSizeBytes?: number;
  maxRows?: number;
};

export type CsvParseResult = {
  rows: Record<string, string>[];
  columns: string[];
  rowCount: number;
  errors: { row: number; message: string }[];
};

const DEFAULT_DELIMITER = ",";
const DEFAULT_QUOTE = '"';
const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const DEFAULT_MAX_ROWS = 100_000;

export function parseCsv(
  content: string,
  options: CsvParseOptions = {}
): CsvParseResult {
  const delimiter = options.delimiter ?? DEFAULT_DELIMITER;
  const quote = options.quote ?? DEFAULT_QUOTE;
  const maxFileSize = options.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE;
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  const errors: { row: number; message: string }[] = [];

  if (Buffer.byteLength(content, "utf8") > maxFileSize) {
    return {
      rows: [],
      columns: [],
      rowCount: 0,
      errors: [{ row: 0, message: `File exceeds max size (${maxFileSize} bytes)` }],
    };
  }

  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { rows: [], columns: [], rowCount: 0, errors };
  }

  const headerLine = lines[0];
  const columns = parseCsvLine(headerLine, delimiter, quote);
  if (columns.length === 0) {
    errors.push({ row: 1, message: "No columns in header row" });
    return { rows: [], columns: [], rowCount: 0, errors };
  }

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length && rows.length < maxRows; i++) {
    const cells = parseCsvLine(lines[i], delimiter, quote);
    if (cells.length !== columns.length && cells.some((c) => c.trim().length > 0)) {
      errors.push({ row: i + 1, message: `Column count mismatch: expected ${columns.length}, got ${cells.length}` });
    }
    const row: Record<string, string> = {};
    columns.forEach((col, idx) => {
      row[col] = cells[idx] ?? "";
    });
    rows.push(row);
  }

  return {
    rows,
    columns,
    rowCount: rows.length,
    errors,
  };
}

function parseCsvLine(line: string, delimiter: string, quoteChar: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === quoteChar) {
        if (line[i + 1] === quoteChar) {
          current += quoteChar;
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += c;
      }
    } else {
      if (c === quoteChar) {
        inQuotes = true;
      } else if (c === delimiter) {
        result.push(current.trim());
        current = "";
      } else {
        current += c;
      }
    }
  }
  result.push(current.trim());
  return result;
}

/** Preview first N rows without full parse */
export function previewCsv(content: string, limit = 10, options: CsvParseOptions = {}): CsvParseResult {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const limited = lines.slice(0, limit + 1).join("\n");
  return parseCsv(limited, { ...options, maxRows: limit });
}
