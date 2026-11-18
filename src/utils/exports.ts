import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportColumn {
  header: string;
  key: string;
}

export function exportReportToCsv(
  fileName: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[]
): void {
  const escapeCell = (val: unknown) => {
    const str = val === null || val === undefined ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = columns.map((c) => escapeCell(c.header)).join(',');
  const dataLines = rows.map((row) =>
    columns.map((c) => escapeCell(row[c.key])).join(',')
  );
  const csvContent = [headerLine, ...dataLines].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerBlobDownload(blob, `${fileName}.csv`);
}

export function exportReportToExcel(
  fileName: string,
  sheetName: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[]
): void {
  const mappedRows = rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (const col of columns) {
      obj[col.header] = row[col.key] ?? '';
    }
    return obj;
  });

  const worksheet = XLSX.utils.json_to_sheet(mappedRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

export function exportReportToPdf(
  fileName: string,
  reportTitle: string,
  subtitle: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[]
): void {
  const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait' });

  doc.setFillColor(9, 11, 14);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 28, 'F');

  doc.setTextColor(16, 185, 129);
  doc.setFontSize(11);
  doc.text('DSR SECURETECH // PROJECT COMMAND CENTER', 14, 11);

  doc.setTextColor(243, 244, 246);
  doc.setFontSize(15);
  doc.text(reportTitle, 14, 20);

  doc.setTextColor(107, 114, 128);
  doc.setFontSize(9);
  doc.text(
    `${subtitle}  |  Generated: ${new Date().toLocaleString()}`,
    14,
    35
  );

  autoTable(doc, {
    startY: 40,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) =>
      columns.map((c) => {
        const val = row[c.key];
        return val === null || val === undefined ? '—' : String(val);
      })
    ),
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: [31, 41, 55],
    },
    headStyles: {
      fillColor: [16, 185, 129],
      textColor: [9, 11, 14],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [243, 244, 246],
    },
  });

  doc.save(`${fileName}.pdf`);
}

export function exportJsonBackup(fileName: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  triggerBlobDownload(blob, `${fileName}.json`);
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
