import { useState } from "react";
import { Download, Building2, Receipt, Users, FileSpreadsheet } from "lucide-react";
import { fetchSchools } from "../features/schools/api";
import { fetchAllInvoices, fetchAllCurrentInvoiceStatuses } from "../features/subscriptions/api";
import { fetchAllStaff, ROLE_LABELS } from "../features/staff/api";
import { toCsv, downloadCsv, type CsvColumn } from "../lib/csv";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ReportCardProps<T> {
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  fetchRows: () => Promise<T[]>;
  columns: CsvColumn<T>[];
  filenamePrefix: string;
}

function ReportCard<T>({ title, description, icon: Icon, fetchRows, columns, filenamePrefix }: ReportCardProps<T>) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    try {
      const rows = await fetchRows();
      const csv = toCsv(rows, columns);
      downloadCsv(`${filenamePrefix}-${today()}.csv`, csv);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate report");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Icon size={16} className="text-amber-500" />
        <h2 className="font-display font-bold text-slate-100">{title}</h2>
      </div>
      <p className="font-body text-sm text-slate-400">{description}</p>
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-ui text-sm font-semibold disabled:opacity-60"
      >
        <Download size={14} />
        {downloading ? "Preparing..." : "Download CSV"}
      </button>
      {error && <p className="font-ui text-xs text-error">{error}</p>}
    </div>
  );
}

export default function Reports() {
  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-slate-100 flex items-center gap-2">
          <FileSpreadsheet size={22} className="text-amber-500" /> Reports
        </h1>
        <p className="font-body text-sm text-slate-400 mt-1">
          Export platform data as CSV — opens cleanly in Excel, Sheets, or for handing to an accountant.
        </p>
      </div>

      <ReportCard
        title="Schools Overview"
        description="Every school with enrollment, staff counts, financial model, and current-term billing status."
        icon={Building2}
        filenamePrefix="schools-overview"
        fetchRows={async () => {
          const [schools, invoiceStatuses] = await Promise.all([fetchSchools(), fetchAllCurrentInvoiceStatuses()]);
          const billingBySchool = new Map<string, { due: number; paid: number }>();
          for (const inv of invoiceStatuses) {
            const cur = billingBySchool.get(inv.school_id) ?? { due: 0, paid: 0 };
            cur.due += inv.amount_due;
            cur.paid += inv.amount_paid;
            billingBySchool.set(inv.school_id, cur);
          }
          return schools.map((s) => ({ ...s, billing: billingBySchool.get(s.id) ?? { due: 0, paid: 0 } }));
        }}
        columns={[
          { key: "name", label: "School", value: (r) => r.name },
          { key: "status", label: "Status", value: (r) => (r.is_active ? "Active" : "Inactive") },
          { key: "financial_model", label: "Financial Model", value: (r) => r.financial_model },
          { key: "student_count", label: "Students", value: (r) => r.student_count },
          { key: "staff_count", label: "Staff", value: (r) => r.staff_count },
          { key: "total_invoiced", label: "Total Invoiced (₦)", value: (r) => r.billing.due },
          { key: "total_paid", label: "Total Paid (₦)", value: (r) => r.billing.paid },
          { key: "total_outstanding", label: "Total Outstanding (₦)", value: (r) => r.billing.due - r.billing.paid },
          { key: "contact_email", label: "Contact Email", value: (r) => r.contact_email ?? "" },
          { key: "created_at", label: "Created", value: (r) => new Date(r.created_at).toLocaleDateString() },
        ]}
      />

      <ReportCard
        title="Billing / Invoices"
        description="Every subscription invoice across every school — term, amount due/paid, status, and dates."
        icon={Receipt}
        filenamePrefix="billing-invoices"
        fetchRows={async () => {
          const [invoices, schools] = await Promise.all([fetchAllInvoices(), fetchSchools()]);
          const schoolNames = new Map(schools.map((s) => [s.id, s.name]));
          return invoices.map((inv) => ({ ...inv, school_name: schoolNames.get(inv.school_id) ?? "Unknown school" }));
        }}
        columns={[
          { key: "school_name", label: "School", value: (r) => r.school_name },
          { key: "term_label", label: "Term", value: (r) => r.term_label },
          { key: "amount_due", label: "Amount Due (₦)", value: (r) => r.amount_due },
          { key: "amount_paid", label: "Amount Paid (₦)", value: (r) => r.amount_paid },
          {
            key: "status",
            label: "Status",
            value: (r) => (r.amount_due - r.amount_paid <= 0.01 ? "Paid" : "Outstanding"),
          },
          {
            key: "due_date",
            label: "Due Date",
            value: (r) => (r.due_date ? new Date(r.due_date).toLocaleDateString() : ""),
          },
          { key: "created_at", label: "Created", value: (r) => new Date(r.created_at).toLocaleDateString() },
        ]}
      />

      <ReportCard
        title="Staff Directory"
        description="Every staff member across every school — role, status, and which school they belong to."
        icon={Users}
        filenamePrefix="staff-directory"
        fetchRows={fetchAllStaff}
        columns={[
          { key: "full_name", label: "Name", value: (r) => r.full_name },
          { key: "role", label: "Role", value: (r) => ROLE_LABELS[r.role] },
          { key: "school_name", label: "School", value: (r) => r.school_name },
          { key: "status", label: "Status", value: (r) => (r.is_active ? "Active" : "Deactivated") },
          { key: "created_at", label: "Joined", value: (r) => new Date(r.created_at).toLocaleDateString() },
        ]}
      />
    </div>
  );
}
