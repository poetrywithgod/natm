import { useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import {
  fetchSchoolInfo,
  updateSchoolName,
  updateSchoolDetails,
  updateFinancialModel,
  uploadSchoolLogo,
  type SchoolInfo,
  type SchoolDetailsInput,
  type FinancialModel,
} from "../features/schools/api";

const EMPTY_DETAILS: SchoolDetailsInput = {
  contact_email: "",
  address: "",
  phone_1: "",
  phone_2: "",
  website: "",
  motto: "",
  year_established: null,
  principal_name: "",
};

export default function AdminSchoolProfile() {
  const { profile } = useAuth();

  const [school, setSchool] = useState<SchoolInfo | null>(null);

  const [nameInput, setNameInput] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);

  const [logoLoading, setLogoLoading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const [details, setDetails] = useState<SchoolDetailsInput>(EMPTY_DETAILS);
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsSaved, setDetailsSaved] = useState(false);

  const [modelSaving, setModelSaving] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.school_id) {
      fetchSchoolInfo(profile.school_id).then((info) => {
        setSchool(info);
        setNameInput(info?.name ?? "");
        setDetails({
          contact_email: info?.contact_email ?? "",
          address: info?.address ?? "",
          phone_1: info?.phone_1 ?? "",
          phone_2: info?.phone_2 ?? "",
          website: info?.website ?? "",
          motto: info?.motto ?? "",
          year_established: info?.year_established ?? null,
          principal_name: info?.principal_name ?? "",
        });
      });
    }
  }, [profile?.school_id]);

  if (!profile) return null;

  async function handleNameSave() {
    if (!profile?.school_id || !nameInput.trim()) return;
    setNameError(null);
    setNameSaved(false);
    setNameSaving(true);
    try {
      await updateSchoolName(profile.school_id, nameInput.trim(), profile.id);
      setSchool((prev) => (prev ? { ...prev, name: nameInput.trim() } : prev));
      setNameSaved(true);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Failed to update name.");
    } finally {
      setNameSaving(false);
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile?.school_id) return;
    setLogoError(null);
    setLogoLoading(true);
    try {
      const publicUrl = await uploadSchoolLogo(profile.school_id, file, profile.id);
      setSchool((prev) => (prev ? { ...prev, logo_url: publicUrl } : prev));
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setLogoLoading(false);
      e.target.value = "";
    }
  }

  async function handleModelChange(nextModel: FinancialModel) {
    if (!profile?.school_id || nextModel === school?.financial_model) return;
    setModelError(null);
    setModelSaving(true);
    try {
      await updateFinancialModel(profile.school_id, nextModel, profile.id);
      setSchool((prev) => (prev ? { ...prev, financial_model: nextModel } : prev));
    } catch (err) {
      setModelError(err instanceof Error ? err.message : "Failed to update financial model.");
    } finally {
      setModelSaving(false);
    }
  }

  function updateField<K extends keyof SchoolDetailsInput>(key: K, value: SchoolDetailsInput[K]) {
    setDetails((prev) => ({ ...prev, [key]: value }));
    setDetailsSaved(false);
  }

  async function handleDetailsSave() {
    if (!profile?.school_id) return;
    setDetailsError(null);
    setDetailsSaved(false);
    setDetailsSaving(true);
    try {
      const payload: SchoolDetailsInput = {
        ...details,
        contact_email: details.contact_email?.trim() || null,
        address: details.address?.trim() || null,
        phone_1: details.phone_1?.trim() || null,
        phone_2: details.phone_2?.trim() || null,
        website: details.website?.trim() || null,
        motto: details.motto?.trim() || null,
        principal_name: details.principal_name?.trim() || null,
      };
      await updateSchoolDetails(profile.school_id, payload, profile.id);
      setSchool((prev) => (prev ? { ...prev, ...payload } : prev));
      setDetailsSaved(true);
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : "Failed to update details.");
    } finally {
      setDetailsSaving(false);
    }
  }

  const inputClass =
    "w-full px-3 py-2 rounded bg-forest-900 border border-forest-700 text-forest-100 font-ui text-sm";
  const labelClass = "font-ui text-xs text-forest-300 mb-1 block";

  return (
    <div className="p-6 max-w-xl space-y-8">
      <div>
        <h1 className="font-display text-2xl text-forest-100">School Profile</h1>
        <p className="font-ui text-sm text-forest-300 mt-1">
          Manage your school's name, logo, and contact details as shown across the app.
        </p>
      </div>

      {/* Logo */}
      <section className="space-y-3">
        <h2 className="font-ui text-sm font-semibold text-forest-100">Logo</h2>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-lg bg-forest-800 overflow-hidden flex items-center justify-center text-forest-300 font-ui text-xs">
            {school?.logo_url ? (
              <img src={school.logo_url} alt="School logo" className="w-full h-full object-contain" />
            ) : (
              "No logo"
            )}
          </div>
          <label className="px-3 py-2 rounded bg-forest-700 text-forest-100 font-ui text-sm cursor-pointer hover:bg-forest-600">
            {logoLoading ? "Uploading..." : "Change logo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              disabled={logoLoading}
              onChange={handleLogoChange}
            />
          </label>
        </div>
        {logoError && <p className="font-ui text-xs text-red-400">{logoError}</p>}
      </section>

      {/* Name */}
      <section className="space-y-2">
        <h2 className="font-ui text-sm font-semibold text-forest-100">School name</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => {
              setNameInput(e.target.value);
              setNameSaved(false);
            }}
            className="flex-1 px-3 py-2 rounded bg-forest-900 border border-forest-700 text-forest-100 font-ui text-sm"
          />
          <button
            onClick={handleNameSave}
            disabled={nameSaving || !nameInput.trim() || nameInput.trim() === school?.name}
            className="px-3 py-2 rounded bg-forest-500 text-forest-950 font-ui text-sm font-semibold disabled:opacity-50"
          >
            {nameSaving ? "Saving..." : "Save"}
          </button>
        </div>
        {nameError && <p className="font-ui text-xs text-red-400">{nameError}</p>}
        {nameSaved && <p className="font-ui text-xs text-forest-400">Name updated.</p>}
      </section>

      {/* Financial model */}
      <section className="space-y-3">
        <h2 className="font-ui text-sm font-semibold text-forest-100">Financial model</h2>
        <p className="font-ui text-xs text-forest-300">
          Choose how billing is framed across the app for this school. This doesn't change the
          underlying fee terms/amounts your Finance Manager sets up -- it only changes labels and,
          on the Partnership model, lets parents pick a partnership tier when they pay.
        </p>
        <div className="space-y-2">
          <label className="flex items-start gap-3 p-3 rounded-lg border border-forest-700 bg-forest-900 cursor-pointer">
            <input
              type="radio"
              name="financial_model"
              checked={school?.financial_model === "fees"}
              onChange={() => handleModelChange("fees")}
              disabled={modelSaving}
              className="mt-1"
            />
            <span>
              <span className="block font-ui text-sm text-forest-100 font-semibold">Fees</span>
              <span className="block font-ui text-xs text-forest-300">
                Standard school fees, billed by term.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 p-3 rounded-lg border border-forest-700 bg-forest-900 cursor-pointer">
            <input
              type="radio"
              name="financial_model"
              checked={school?.financial_model === "partnership"}
              onChange={() => handleModelChange("partnership")}
              disabled={modelSaving}
              className="mt-1"
            />
            <span>
              <span className="block font-ui text-sm text-forest-100 font-semibold">
                Partnership (Foundation)
              </span>
              <span className="block font-ui text-xs text-forest-300">
                Fees are shown as quarterly Child Developmental Support, and parents choose a
                Partnership tier (Gold / Silver / Resource Men Support) each time they contribute.
              </span>
            </span>
          </label>
        </div>
        {modelError && <p className="font-ui text-xs text-red-400">{modelError}</p>}
      </section>

      {/* Details */}
      <section className="space-y-3">
        <h2 className="font-ui text-sm font-semibold text-forest-100">School details</h2>

        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            value={details.contact_email ?? ""}
            onChange={(e) => updateField("contact_email", e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Address</label>
          <input
            type="text"
            value={details.address ?? ""}
            onChange={(e) => updateField("address", e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Phone 1</label>
            <input
              type="tel"
              value={details.phone_1 ?? ""}
              onChange={(e) => updateField("phone_1", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Phone 2</label>
            <input
              type="tel"
              value={details.phone_2 ?? ""}
              onChange={(e) => updateField("phone_2", e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Website</label>
          <input
            type="url"
            placeholder="https://"
            value={details.website ?? ""}
            onChange={(e) => updateField("website", e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Motto / tagline</label>
          <input
            type="text"
            value={details.motto ?? ""}
            onChange={(e) => updateField("motto", e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Year established</label>
            <input
              type="number"
              value={details.year_established ?? ""}
              onChange={(e) =>
                updateField("year_established", e.target.value ? Number(e.target.value) : null)
              }
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Principal / head name</label>
            <input
              type="text"
              value={details.principal_name ?? ""}
              onChange={(e) => updateField("principal_name", e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <button
          onClick={handleDetailsSave}
          disabled={detailsSaving}
          className="px-3 py-2 rounded bg-forest-500 text-forest-950 font-ui text-sm font-semibold disabled:opacity-50"
        >
          {detailsSaving ? "Saving..." : "Save details"}
        </button>
        {detailsError && <p className="font-ui text-xs text-red-400">{detailsError}</p>}
        {detailsSaved && <p className="font-ui text-xs text-forest-400">Details updated.</p>}
      </section>
    </div>
  );
}
