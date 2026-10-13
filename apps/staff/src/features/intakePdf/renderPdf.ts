import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { EMPTY, type DocTable, type IntakeDocument } from "./model";

const MARGIN = 14;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const GREEN: [number, number, number] = [31, 107, 71];
const LIGHT_GREEN: [number, number, number] = [230, 245, 237];
const GREY: [number, number, number] = [140, 140, 140];

// jsPDF's built-in fonts only cover Latin-1. Parents can type anything
// (Yoruba/Igbo diacritics like "ọ", "ṣ", "ẹ", curly quotes, emoji), and an
// unsupported character would otherwise print as garbage and can corrupt
// the spacing of the whole line. Normalise to the nearest plain character
// instead: "ọ" -> "o", curly quotes -> straight, anything else -> "?".
export function pdfSafe(input: string): string {
  const mapped = input
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u00A0\u2007\u202F]/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
  let out = "";
  for (const ch of mapped) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === "\n" || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) {
      out += ch;
      continue;
    }
    // Strip combining marks off the base letter ("ọ" decomposes to "o" + dot).
    const base = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // A lone combining mark (e.g. the tone mark in "ọ̀") strips to nothing: drop it.
    out += base === "" ? "" : /^[\x20-\x7e\xa0-\xff]+$/.test(base) ? base : "?";
  }
  return out;
}

function safeTable(t: DocTable): DocTable {
  return {
    head: t.head.map(pdfSafe),
    widths: t.widths,
    rows: t.rows.map((r) => r.map(pdfSafe)),
  };
}

function columnStyles(widths: number[] | undefined, count: number) {
  const w = widths && widths.length === count ? widths : Array(count).fill(1);
  const total = w.reduce((a, b) => a + b, 0);
  const styles: Record<number, { cellWidth: number }> = {};
  w.forEach((x, i) => {
    styles[i] = { cellWidth: (x / total) * CONTENT_WIDTH };
  });
  return styles;
}

function lastY(doc: jsPDF): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (doc as any).lastAutoTable.finalY as number;
}

// Pure renderer: builds the PDF in memory and returns it. Saving to disk is
// a separate step so this can be exercised without a browser.
export function renderDocumentToPdf(source: IntakeDocument): jsPDF {
  const document = {
    ...source,
    meta: source.meta.map((m) => ({ label: pdfSafe(m.label), value: pdfSafe(m.value) })),
    sections: source.sections.map((s) => ({
      ...s,
      title: pdfSafe(s.title),
      intro: s.intro ? pdfSafe(s.intro) : undefined,
      tables: s.tables.map(safeTable),
    })),
    title: pdfSafe(source.title),
  };

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y: number;

  // --- Title block ---
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, PAGE_WIDTH, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(document.title, MARGIN, 14);
  doc.setFont("helvetica", "normal");
  y = 30;

  // --- Meta grid (two label/value pairs per row) ---
  const pairs: string[][] = [];
  for (let i = 0; i < document.meta.length; i += 2) {
    const a = document.meta[i];
    const b = document.meta[i + 1];
    pairs.push([a.label, a.value, b?.label ?? "", b?.value ?? ""]);
  }
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: "plain",
    styles: { fontSize: 8.5, cellPadding: { top: 1, bottom: 1, left: 1, right: 2 }, textColor: [40, 40, 40] },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 32, textColor: GREEN },
      1: { cellWidth: CONTENT_WIDTH / 2 - 32 },
      2: { fontStyle: "bold", cellWidth: 32, textColor: GREEN },
      3: { cellWidth: CONTENT_WIDTH / 2 - 32 },
    },
    body: pairs,
  });
  y = lastY(doc) + 4;

  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 7;

  // --- Sections ---
  for (const section of document.sections) {
    // Keep a heading with at least a few lines of what follows it.
    if (y > PAGE_HEIGHT - 45) {
      doc.addPage();
      y = MARGIN;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...GREEN);
    doc.text(section.title, MARGIN, y);
    y += 2;
    doc.setDrawColor(...LIGHT_GREEN);
    doc.setLineWidth(0.6);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y += 4;
    doc.setFont("helvetica", "normal");

    if (section.intro) {
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      const lines = doc.splitTextToSize(section.intro, CONTENT_WIDTH) as string[];
      doc.text(lines, MARGIN, y);
      y += lines.length * 3.6 + 1.5;
    }

    for (const table of section.tables) {
      autoTable(doc, {
        startY: y,
        margin: { left: MARGIN, right: MARGIN, bottom: 16 },
        theme: "grid",
        styles: {
          fontSize: 8,
          cellPadding: 1.8,
          overflow: "linebreak",
          valign: "top",
          lineColor: [215, 215, 215],
          lineWidth: 0.15,
          textColor: [30, 30, 30],
        },
        headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold" },
        columnStyles: columnStyles(table.widths, table.head.length),
        head: [table.head],
        body: table.rows,
        rowPageBreak: "avoid",
        didParseCell: (data) => {
          if (data.section === "body" && data.cell.text.join("") === EMPTY) {
            data.cell.styles.textColor = GREY;
          }
          // First column of a two-column Field/Response table reads as a label.
          if (data.section === "body" && data.column.index === 0 && table.head.length === 2) {
            data.cell.styles.fillColor = [246, 249, 247];
            data.cell.styles.fontStyle = "bold";
          }
        },
      });
      y = lastY(doc) + 5;
    }
    y += 2;
  }

  // --- Footer on every page ---
  const learner = document.meta.find((m) => m.label === "Learner")?.value ?? "";
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    doc.text(`Confidential - contains sensitive information about a child${learner ? ` (${learner})` : ""}`, MARGIN, 291);
    doc.text(`Page ${i} of ${pages}`, PAGE_WIDTH - MARGIN, 291, { align: "right" });
  }

  return doc;
}

export function downloadIntakePdf(source: IntakeDocument): void {
  const doc = renderDocumentToPdf(source);
  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`${source.fileStem}_${stamp}.pdf`);
}
