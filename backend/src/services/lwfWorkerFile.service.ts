import { prisma } from "../config/db";

// Column order and encoding fixed by the Haryana LWF portal's bulk worker
// upload template ("LWF WORKER DATA FILE.xlsx") — see its header row for the
// exact wording this must match.
export const LWF_WORKER_FILE_HEADER = [
  "Name",
  "Father/Husband Name",
  "Nationality( If Indian add '0' and if non-indian please add '1' )",
  "Workers-Aadhaar-number(Please add 'A' before Aadhaar number) OR Passport (Please add 'P' before Passport number)",
  "ESI-No.",
  "EPF-No.",
  "Gender('M' or 'F' or 'T')",
  "Mobile",
  "DOB(Format: dd-mm-yyyy)",
  "Gross-Wage",
  "Date-Of-Joining(Format: dd-mm-yyyy)",
  "Date-Of-Relieving(Format: dd-mm-yyyy)",
  "Qualification(Format: Number '0' or '1' etc)",
  "Domicile-Of-Haryana( If Yes add '1' and if No add '0' )",
  "Current Designation",
];

const REQUIRED_FIELDS = [
  "guardianName", "aadhaarOrPassport", "esiNo", "epfNo", "gender",
  "phone", "dob", "grossWage", "dateOfJoining", "qualification", "domicileOfHaryana",
] as const;

function formatDate(d: Date | null): string {
  if (!d) return "";
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${d.getUTCFullYear()}`;
}

// The sheet's gender values were typed freehand over time ("Male", "M", "FEMALE", ...);
// normalize to the single-letter code the template requires.
function normalizeGender(raw: string | null): string {
  if (!raw) return "";
  const upper = raw.trim().toUpperCase();
  if (upper.startsWith("M")) return "M";
  if (upper.startsWith("F")) return "F";
  return "T";
}

export interface LwfWorkerRow {
  employeeCode: string;
  name: string;
  cells: (string | number)[];
  missing: string[];
}

export interface LwfWorkerFileResult {
  rows: LwfWorkerRow[];
  summary: { total: number; complete: number; incomplete: number };
}

export async function buildLwfWorkerFileRows(): Promise<LwfWorkerFileResult> {
  const employees = await prisma.employee.findMany({
    orderBy: { name: "asc" },
    include: {
      salaryRecords: {
        orderBy: [{ sheet: { periodYear: "desc" } }, { sheet: { periodMonth: "desc" } }],
        take: 1,
        select: { grossEarnings: true },
      },
    },
  });

  const rows: LwfWorkerRow[] = employees.map((e) => {
    const grossWage = e.salaryRecords[0]?.grossEarnings ?? null;
    const aadhaarOrPassport = e.isIndianNational
      ? (e.aadhaarNo ? `A${e.aadhaarNo}` : "")
      : (e.passportNo ? `P${e.passportNo}` : "");

    const values: Record<(typeof REQUIRED_FIELDS)[number], string | number | null> = {
      guardianName: e.guardianName,
      aadhaarOrPassport,
      esiNo: e.esiNo,
      epfNo: e.epfNo,
      gender: normalizeGender(e.gender),
      phone: e.phone,
      dob: e.dob ? formatDate(e.dob) : null,
      grossWage,
      dateOfJoining: e.dateOfJoining ? formatDate(e.dateOfJoining) : null,
      qualification: e.qualification,
      domicileOfHaryana: e.domicileOfHaryana === null ? null : e.domicileOfHaryana ? "1" : "0",
    };

    const missing = REQUIRED_FIELDS.filter((f) => values[f] === null || values[f] === "");

    const cells: (string | number)[] = [
      e.name,
      e.guardianName ?? "",
      e.isIndianNational ? "0" : "1",
      aadhaarOrPassport,
      e.esiNo ?? "",
      e.epfNo ?? "",
      normalizeGender(e.gender),
      e.phone ?? "",
      e.dob ? formatDate(e.dob) : "",
      grossWage ?? "",
      e.dateOfJoining ? formatDate(e.dateOfJoining) : "",
      e.dateOfRelieving ? formatDate(e.dateOfRelieving) : "",
      e.qualification ?? "",
      e.domicileOfHaryana === null ? "" : e.domicileOfHaryana ? "1" : "0",
      e.designation ?? "",
    ];

    return { employeeCode: e.employeeCode, name: e.name, cells, missing };
  });

  const complete = rows.filter((r) => r.missing.length === 0).length;
  return { rows, summary: { total: rows.length, complete, incomplete: rows.length - complete } };
}
