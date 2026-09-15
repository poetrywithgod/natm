import type { jsPDF } from "jspdf";

// Simple chart primitives drawn straight onto the PDF canvas with jsPDF's
// own line()/rect()/text() calls -- deliberately not a screenshot of the
// on-screen Recharts SVGs. Same underlying numbers (via scoring.ts), a
// much plainer look, no html2canvas/rasterization step, and it stays
// crisp at any zoom since it's real vector drawing, not an embedded image.

const AXIS_COLOR: [number, number, number] = [180, 180, 180];
const LABEL_COLOR: [number, number, number] = [90, 90, 90];

export interface LineChartPoint {
  label: string; // x-axis tick, e.g. "09-14"
  value: number | null; // 0-100, null = gap (skipped, not interpolated)
}

// Composite/domain trend over time. Y axis fixed 0-100 (these are all
// normalized scores), X axis is whatever date labels are passed in --
// thinned automatically so labels never overlap.
export function drawLineChart(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  points: LineChartPoint[],
  color: [number, number, number],
  title: string
): number {
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text(title, x, y);
  const top = y + 4;
  const plotHeight = height;
  const plotBottom = top + plotHeight;

  doc.setDrawColor(...AXIS_COLOR);
  doc.setLineWidth(0.2);
  doc.line(x, top, x, plotBottom); // Y axis
  doc.line(x, plotBottom, x + width, plotBottom); // X axis

  doc.setFontSize(6);
  doc.setTextColor(...LABEL_COLOR);
  doc.text("100", x - 2, top + 2, { align: "right" });
  doc.text("0", x - 2, plotBottom, { align: "right" });

  const valid = points.filter((p) => p.value !== null) as { label: string; value: number }[];
  if (valid.length === 0) {
    doc.setFontSize(8);
    doc.setTextColor(...LABEL_COLOR);
    doc.text("No data for this period.", x + width / 2, top + plotHeight / 2, { align: "center" });
    return plotBottom + 8;
  }

  const stepX = points.length > 1 ? width / (points.length - 1) : 0;
  const plotY = (value: number) => plotBottom - (value / 100) * plotHeight;

  doc.setDrawColor(...color);
  doc.setLineWidth(0.6);
  let prev: { px: number; py: number } | null = null;
  points.forEach((p, i) => {
    const px = x + stepX * i;
    if (p.value === null) {
      prev = null;
      return;
    }
    const py = plotY(p.value);
    if (prev) doc.line(prev.px, prev.py, px, py);
    prev = { px, py };
  });

  // Thin X labels so they never overlap: show at most ~6 across the width.
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  doc.setFontSize(6);
  points.forEach((p, i) => {
    if (i % labelEvery !== 0 && i !== points.length - 1) return;
    const px = x + stepX * i;
    doc.text(p.label, px, plotBottom + 4, { align: "center" });
  });

  return plotBottom + 8;
}

export interface BarChartItem {
  label: string;
  value: number; // 0-100
}

// Horizontal bars, one row per item -- mirrors the on-screen subject
// averages chart. Row height grows with label length isn't needed since
// labels sit to the left of a fixed-width bar track.
export function drawBarChart(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  items: BarChartItem[],
  color: [number, number, number],
  title: string
): number {
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text(title, x, y);
  let cursorY = y + 5;

  if (items.length === 0) {
    doc.setFontSize(8);
    doc.setTextColor(...LABEL_COLOR);
    doc.text("No data for this period.", x, cursorY + 3);
    return cursorY + 8;
  }

  const labelWidth = 38;
  const trackWidth = width - labelWidth - 12;
  const rowHeight = 6;

  for (const item of items) {
    doc.setFontSize(7);
    doc.setTextColor(30, 30, 30);
    const truncated = doc.splitTextToSize(item.label, labelWidth - 2)[0];
    doc.text(truncated, x, cursorY + 3.5);

    doc.setFillColor(230, 230, 230);
    doc.rect(x + labelWidth, cursorY, trackWidth, 4, "F");

    doc.setFillColor(...color);
    const barWidth = Math.max(1, (item.value / 100) * trackWidth);
    doc.rect(x + labelWidth, cursorY, barWidth, 4, "F");

    doc.setFontSize(6);
    doc.setTextColor(...LABEL_COLOR);
    doc.text(`${item.value}%`, x + labelWidth + trackWidth + 2, cursorY + 3.5);

    cursorY += rowHeight;
  }

  return cursorY + 4;
}
