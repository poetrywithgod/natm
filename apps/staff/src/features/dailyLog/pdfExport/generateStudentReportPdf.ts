import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import {
  CLASS_TEACHER_OBSERVATION_SECTIONS,
  SHADOW_TEACHER_RECORD_SECTIONS,
  SUBJECT_PERFORMANCE_SECTION_KEY,
  SUBJECT_PERFORMANCE_OPTIONS,
  aggregateDomainOverTime,
  computeWeeklyDeltas,
  extractSubjectScores,
  type SectionConfig,
  type WeeklyDelta,
} from "@natm/shared-types";
import { fetchObservationsForRange, fetchShadowRecordsForRange, fetchSubjectNameMap } from "../api";
import { fetchStudentAttendance, fetchStudentFees } from "../../promotion/api";
import { fetchSubjectProgress } from "../../grading/api";
import { flattenRecord } from "./flattenSection";
import { drawLineChart, drawBarChart } from "./drawNativeCharts";

const CLASS_SUMMARY_ONLY: SectionConfig[] = CLASS_TEACHER_OBSERVATION_SECTIONS.filter(
  (s) => s.key === "daily_functional_summary"
);
const SHADOW_SUMMARY_ONLY: SectionConfig[] = SHADOW_TEACHER_RECORD_SECTIONS.filter(
  (s) => s.key === "daily_support_summary"
);

const MARGIN = 14;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

export interface GenerateReportParams {
  studentId: string;
  studentName: string;
  uniqueStudentId: string;
  className: string;
  classId: string | null; // needed to pull Subject Progress; omitted (no table) when the student is unassigned
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function directionSentence(d: WeeklyDelta, subject: string): string {
  if (d.direction === "improving") return `${subject} ${d.label} skills improved by ${d.deltaPoints}% this week.`;
  if (d.direction === "declining")
    return `${subject} ${d.label} skills dropped by ${Math.abs(d.deltaPoints)}% this week.`;
  return `${subject} ${d.label} skills stayed steady this week.`;
}

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.text(`Page ${i} of ${pageCount}`, PAGE_WIDTH - MARGIN, 292, { align: "right" });
  }
}

// Admin-triggered, all-time student report: summary (attendance, fees,
// subject progress, skills/behaviour trend + highlights) up front, then
// the full raw daily-log history as a paginated appendix. Fetches its
// own data so it produces the same result regardless of whether it was
// triggered from the Overview tab or the Daily Log tab.
export async function generateStudentReportPdf({
  studentId,
  studentName,
  uniqueStudentId,
  className,
  classId,
}: GenerateReportParams): Promise<void> {
  const [classObservations, shadowObservations, subjectNames, attendance, fees] = await Promise.all([
    fetchObservationsForRange(studentId, null),
    fetchShadowRecordsForRange(studentId, null),
    fetchSubjectNameMap(),
    fetchStudentAttendance(studentId),
    fetchStudentFees(studentId),
  ]);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  // --- Header ---
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text(studentName, MARGIN, y);
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(`ID: ${uniqueStudentId}  ·  Class: ${className}`, MARGIN, y);
  y += 4;
  doc.text(
    `Generated ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}  ·  All-time report`,
    MARGIN,
    y
  );
  y += 8;

  // --- Attendance summary ---
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text("Attendance", MARGIN, y);
  y += 5;
  if (attendance.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text("No attendance records yet.", MARGIN, y);
    y += 6;
  } else {
    const present = attendance.filter((a) => a.status === "present").length;
    const late = attendance.filter((a) => a.status === "late").length;
    const absent = attendance.filter((a) => a.status === "absent").length;
    const pct = Math.round(((present + late) / attendance.length) * 100);
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(
      `${pct}% attendance  —  Present: ${present}   Late: ${late}   Absent: ${absent}   (${attendance.length} days recorded)`,
      MARGIN,
      y
    );
    y += 7;
  }

  // --- Fee status summary ---
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text("Fee Status", MARGIN, y);
  y += 2;
  if (fees.length === 0) {
    y += 4;
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text("No fees recorded yet.", MARGIN, y);
    y += 6;
  } else {
    autoTable(doc, {
      startY: y + 2,
      margin: { left: MARGIN, right: MARGIN },
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [95, 191, 143] },
      head: [["Fee", "Paid", "Due", "Status"]],
      body: fees.map((f) => [
        f.fee_type?.name ?? "Unknown fee",
        `\u20a6${f.amount_paid.toLocaleString()}`,
        `\u20a6${f.amount_due.toLocaleString()}`,
        f.is_paid ? "Paid" : "Outstanding",
      ]),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // --- Subject progress ---
  let subjectProgress: Awaited<ReturnType<typeof fetchSubjectProgress>> = [];
  if (classId) {
    try {
      subjectProgress = await fetchSubjectProgress(studentId, classId);
    } catch {
      subjectProgress = [];
    }
  }

  // --- Skills & behaviour summary ---
  if (y > 240) {
    doc.addPage();
    y = MARGIN;
  }
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text("Skills & Behaviour", MARGIN, y);
  y += 6;

  const trend = aggregateDomainOverTime(CLASS_SUMMARY_ONLY, classObservations);
  const shadowTrend = aggregateDomainOverTime(SHADOW_SUMMARY_ONLY, shadowObservations);
  const lineData = trend.map((t) => ({ label: t.date.slice(5), value: t.composite }));
  const shadowLineData = shadowTrend.map((t) => ({ label: t.date.slice(5), value: t.composite }));

  if (lineData.length > 0) {
    y = drawLineChart(doc, MARGIN, y, CONTENT_WIDTH, 35, lineData, [95, 191, 143], "Class Teacher — overall trend");
  }
  if (shadowLineData.length > 0) {
    if (y > 240) {
      doc.addPage();
      y = MARGIN;
    }
    y = drawLineChart(doc, MARGIN, y, CONTENT_WIDTH, 35, shadowLineData, [127, 178, 255], "Shadow Teacher — overall trend");
  }

  const classDeltas = computeWeeklyDeltas(CLASS_SUMMARY_ONLY, classObservations);
  const shadowDeltas = computeWeeklyDeltas(SHADOW_SUMMARY_ONLY, shadowObservations);
  const topDeltas = [...classDeltas, ...shadowDeltas]
    .sort((a, b) => Math.abs(b.deltaPoints) - Math.abs(a.deltaPoints))
    .slice(0, 3);

  if (topDeltas.length > 0) {
    if (y > 260) {
      doc.addPage();
      y = MARGIN;
    }
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 20);
    doc.text("This week's highlights:", MARGIN, y);
    y += 5;
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    for (const d of topDeltas) {
      const lines = doc.splitTextToSize(`\u2022 ${directionSentence(d, studentName)}`, CONTENT_WIDTH);
      doc.text(lines, MARGIN, y);
      y += lines.length * 4 + 1;
    }
    y += 3;
  }

  const subjectGrouped: Record<string, number[]> = {};
  for (const r of [...classObservations, ...shadowObservations]) {
    for (const s of extractSubjectScores(
      r.sections,
      SUBJECT_PERFORMANCE_SECTION_KEY,
      SUBJECT_PERFORMANCE_OPTIONS,
      subjectNames
    )) {
      (subjectGrouped[s.subjectName] ??= []).push(s.score);
    }
  }
  const subjectAverages = Object.entries(subjectGrouped)
    .map(([name, scores]) => ({ label: name, value: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) }))
    .sort((a, b) => b.value - a.value);

  if (y > 250) {
    doc.addPage();
    y = MARGIN;
  }
  y = drawBarChart(doc, MARGIN, y, CONTENT_WIDTH, subjectAverages, [95, 191, 143], "Subject averages");

  if (subjectProgress.length > 0) {
    if (y > 250) {
      doc.addPage();
      y = MARGIN;
    }
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [95, 191, 143] },
      head: [["Subject", "This quarter", "Last finalized"]],
      body: subjectProgress.map((sp) => [
        sp.subject_name,
        sp.currentQuarterAverage !== null
          ? `${sp.currentQuarterAverage.toFixed(0)}% (${sp.currentQuarterAttemptCount} attempt${sp.currentQuarterAttemptCount === 1 ? "" : "s"})`
          : "No attempts yet",
        sp.lastFinalizedScore !== null && sp.lastFinalizedQuarter
          ? `${sp.lastFinalizedScore.toFixed(0)}% (Q${sp.lastFinalizedQuarter.quarterNumber} ${sp.lastFinalizedQuarter.year})`
          : "—",
      ]),
    });
  }

  // --- Appendix: raw daily log entries ---
  doc.addPage();
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text("Appendix: Daily Log Entries", MARGIN, MARGIN);

  type Entry = { date: string; source: string; rows: { label: string; value: string }[] };
  const entries: Entry[] = [
    ...classObservations.map((o) => ({
      date: o.date,
      source: "Class Teacher",
      rows: flattenRecord(CLASS_TEACHER_OBSERVATION_SECTIONS, o.sections),
    })),
    ...shadowObservations.map((o) => ({
      date: o.date,
      source: "Shadow Teacher",
      rows: flattenRecord(SHADOW_TEACHER_RECORD_SECTIONS, o.sections),
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const body: RowInput[] = [];
  for (const entry of entries) {
    body.push([
      {
        content: `${formatDate(entry.date)}  —  ${entry.source}`,
        colSpan: 2,
        styles: { fillColor: [230, 245, 237], fontStyle: "bold", textColor: [20, 20, 20] },
      },
    ]);
    for (const row of entry.rows) {
      body.push([row.label, row.value]);
    }
  }

  if (entries.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text("No daily log entries recorded for this student yet.", MARGIN, MARGIN + 8);
  } else {
    autoTable(doc, {
      startY: MARGIN + 6,
      margin: { left: MARGIN, right: MARGIN, bottom: 14 },
      styles: { fontSize: 7.5, cellPadding: 1.5, overflow: "linebreak" },
      columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: CONTENT_WIDTH - 55 } },
      showHead: "firstPage",
      body,
      // Repeats naturally across pages via jspdf-autotable's own
      // pagination -- no manual page-break math needed, and the section
      // header rows re-establish context if a day's entry itself spans
      // a page break.
    });
  }

  addFooter(doc);

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`${studentName.replace(/\s+/g, "_")}_report_${stamp}.pdf`);
}
