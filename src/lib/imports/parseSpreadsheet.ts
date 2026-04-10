import ExcelJS from "exceljs";
import { parseCsv, type CsvParseResult } from "@/modules/integrations/providers/csv/parser";
import {
  SPREADSHEET_MAX_BYTES,
  SPREADSHEET_MAX_COLS,
  SPREADSHEET_MAX_ROWS,
} from "@/lib/imports/spreadsheetLimits";

export type SpreadsheetWarning = { code: string; message: string };

function cellToString(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && v !== null && "text" in v) {
    const t = (v as { text?: string }).text;
    return String(t ?? "").trim();
  }
  if (typeof v === "object" && v !== null && "richText" in v) {
    const parts = (v as { richText?: { text: string }[] }).richText ?? [];
    return parts.map((p) => p.text).join("").trim();
  }
  if (typeof v === "number" && cell.type === ExcelJS.ValueType.Date) {
    return new Date(v).toISOString();
  }
  return String(v).trim();
}

function uniqueColumnNames(raw: string[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((h) => {
    const base = h.trim() || "column";
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}_${n + 1}`;
  });
}

export async function parseSpreadsheetBuffer(args: {
  buffer: Buffer;
  filename: string;
  sheetIndex?: number;
}): Promise<{
  result: CsvParseResult;
  sourceType: "CSV" | "XLSX";
  sheetNames?: string[];
  warnings: SpreadsheetWarning[];
}> {
  const warnings: SpreadsheetWarning[] = [];
  const lower = args.filename.toLowerCase();

  if (lower.endsWith(".csv")) {
    const content = args.buffer.toString("utf8");
    if (Buffer.byteLength(content, "utf8") > SPREADSHEET_MAX_BYTES) {
      return {
        result: {
          rows: [],
          columns: [],
          rowCount: 0,
          errors: [{ row: 0, message: `File exceeds max size (${SPREADSHEET_MAX_BYTES} bytes)` }],
        },
        sourceType: "CSV",
        warnings,
      };
    }
    const result = parseCsv(content, {
      maxFileSizeBytes: SPREADSHEET_MAX_BYTES,
      maxRows: SPREADSHEET_MAX_ROWS,
    });
    if (result.columns.length > SPREADSHEET_MAX_COLS) {
      warnings.push({
        code: "too_many_columns",
        message: `More than ${SPREADSHEET_MAX_COLS} columns; extra columns were ignored.`,
      });
      const trimmedCols = result.columns.slice(0, SPREADSHEET_MAX_COLS);
      const trimmedRows = result.rows.map((r) => {
        const o: Record<string, string> = {};
        for (const c of trimmedCols) o[c] = r[c] ?? "";
        return o;
      });
      return {
        result: {
          columns: trimmedCols,
          rows: trimmedRows,
          rowCount: trimmedRows.length,
          errors: result.errors,
        },
        sourceType: "CSV",
        warnings,
      };
    }
    return { result, sourceType: "CSV", warnings };
  }

  if (lower.endsWith(".xlsx")) {
    if (args.buffer.length > SPREADSHEET_MAX_BYTES) {
      return {
        result: {
          rows: [],
          columns: [],
          rowCount: 0,
          errors: [{ row: 0, message: `File exceeds max size (${SPREADSHEET_MAX_BYTES} bytes)` }],
        },
        sourceType: "XLSX",
        warnings,
      };
    }

    const workbook = new ExcelJS.Workbook();
    // ExcelJS expects Node `Buffer`; normalize in case of alternate Buffer/Uint8Array typings.
    const xlsxBuf = Buffer.from(args.buffer);
    await workbook.xlsx.load(xlsxBuf as never);
    const sheetNames = workbook.worksheets.map((w) => w.name);
    const idx = Math.max(0, Math.min(args.sheetIndex ?? 0, workbook.worksheets.length - 1));
    const sheet = workbook.worksheets[idx];
    if (!sheet) {
      return {
        result: {
          rows: [],
          columns: [],
          rowCount: 0,
          errors: [{ row: 0, message: "Workbook has no sheets" }],
        },
        sourceType: "XLSX",
        sheetNames,
        warnings,
      };
    }

    let headerRowNum = 0;
    const scanLimit = Math.min(sheet.rowCount, 500);
    for (let r = 1; r <= scanLimit; r++) {
      const row = sheet.getRow(r);
      let any = false;
      for (let c = 1; c <= SPREADSHEET_MAX_COLS; c++) {
        const s = cellToString(row.getCell(c));
        if (s) {
          any = true;
          break;
        }
      }
      if (any) {
        headerRowNum = r;
        break;
      }
    }

    if (headerRowNum === 0) {
      return {
        result: { rows: [], columns: [], rowCount: 0, errors: [{ row: 0, message: "Empty sheet" }] },
        sourceType: "XLSX",
        sheetNames,
        warnings,
      };
    }

    const headerRow = sheet.getRow(headerRowNum);
    const rawHeaders: string[] = [];
    for (let c = 1; c <= SPREADSHEET_MAX_COLS; c++) {
      rawHeaders.push(cellToString(headerRow.getCell(c)));
    }
    while (rawHeaders.length > 0 && !rawHeaders[rawHeaders.length - 1]?.trim()) {
      rawHeaders.pop();
    }
    if (rawHeaders.length > SPREADSHEET_MAX_COLS) {
      warnings.push({
        code: "too_many_columns",
        message: `More than ${SPREADSHEET_MAX_COLS} columns; extra columns were ignored.`,
      });
    }
    const capped = rawHeaders.slice(0, SPREADSHEET_MAX_COLS);
    const columns = uniqueColumnNames(capped.map((h) => h || "column"));

    const rows: Record<string, string>[] = [];
    const errors: { row: number; message: string }[] = [];

    for (let r = headerRowNum + 1; r <= sheet.rowCount && rows.length < SPREADSHEET_MAX_ROWS; r++) {
      const row = sheet.getRow(r);
      const obj: Record<string, string> = {};
      let any = false;
      for (let ci = 0; ci < columns.length; ci++) {
        const cell = row.getCell(ci + 1);
        const val = cellToString(cell);
        obj[columns[ci]!] = val;
        if (val) any = true;
      }
      if (any) rows.push(obj);
    }

    return {
      result: { rows, columns, rowCount: rows.length, errors },
      sourceType: "XLSX",
      sheetNames,
      warnings,
    };
  }

  return {
    result: {
      rows: [],
      columns: [],
      rowCount: 0,
      errors: [{ row: 0, message: "Unsupported file type (use .csv or .xlsx)" }],
    },
    sourceType: "CSV",
    warnings,
  };
}
