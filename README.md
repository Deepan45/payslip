# Salary Slip Software — MVP

Admin uploads an Excel salary sheet → the system generates a professional PDF
payslip for every employee → admin (or later, employees) can download/print
individually or in bulk → every upload is kept in history.

## Stack

- **Backend:** Node.js + Express + TypeScript, Prisma ORM (SQLite for local
  dev, swap to Postgres for production), JWT admin auth, `xlsx` for parsing,
  `pdfkit` for PDF generation, `archiver` for bulk zip downloads.
- **Frontend:** React + TypeScript (Vite), React Router, Axios.

## Project structure

```
Payslip/
  backend/     Express API, Prisma schema, PDF/Excel services
  frontend/    React admin portal
```

## 1. Backend setup

```bash
cd backend
npm install
cp .env.example .env        # edit values as needed
npx prisma migrate dev --name init   # creates dev.db and tables
npm run seed                 # creates the admin login + default company settings
npm run dev                  # starts API on http://localhost:4000
```

The seed script creates an admin using `SEED_ADMIN_EMAIL` /
`SEED_ADMIN_PASSWORD` from `.env` (defaults to `admin@example.com` /
`ChangeMe123!` — **change this before going live**).

## 2. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env        # points at the backend API
npm run dev                  # starts the app on http://localhost:5173
```

Log in with the admin credentials from step 1.

## 3. Using it

1. **Company Settings** — set your company name, address, and logo (shown on
   every payslip).
2. **Upload** — click "Download the template" for a ready-made master Excel
   file, fill it in (one row per employee, one header row), then upload it
   along with the pay period (month/year). The template's fields are based
   on real wage-sheet data (labour/staffing payroll), and the parser also
   recognizes a few common alternate header spellings:

   | Field | Accepted headers (case-insensitive) |
   |---|---|
   | Employee Code | Employee Code, Emp Code, Code, Token No, Employee ID |
   | Name | Name, Emp Name, Employee Name, Name Of Employee |
   | Guardian Name | Guardian Name, Father's Name |
   | Designation | Designation, Rank, Title |
   | Department | Department, Dept, Plant, Site |
   | Bank Account | Bank Account, Account No |
   | IFSC Code | IFSC Code, IFSC |
   | UAN No | UAN No, UAN |
   | ESI No | ESI No, ESIC No |
   | Paid Days | Paid Days, Days, No of Paid Days |
   | OT Hours / OT Amount | OT Hours, OT Hrs, Actual OT / OT Amount |
   | Basic | Basic, Basic Salary, Basic Pay |
   | HRA | HRA, House Rent Allowance |
   | Incentive | Incentive, Incentive Amt, Good Work Award |
   | ESI / EPF / LWF | ESI / ESIC, EPF / PF / PF Wages, LWF |
   | Advance | Advance, Adv, Adv Ded |
   | Dress Shoes | Dress Shoes, Dress & Shoes |
   | Other Deduction | Other Deduction, Canteen Deduction, Food, Lunch |
   | Gross Earnings (optional) | Gross, Gross Salary, Total Gross, Salary Earning — auto-computed from Basic + HRA + Incentive + OT Amount if omitted |
   | Total Deduction (optional) | Total Deduction, T.Ded — auto-computed from ESI + EPF + LWF + Advance + Dress Shoes + Other Deduction if omitted |
   | Net Pay (optional) | Net Pay, Net Salary, Net Payable — auto-computed as Gross Earnings − Total Deduction if omitted |

   Unrecognized columns are kept (not lost) but not shown on the payslip yet.
   Rows missing Employee Code or Name are skipped and reported after upload.

   **Note on real-world sheets:** wage sheets received from different sites
   often use multi-row merged headers and inconsistent field names (see
   `Demo-Excel/` for examples). This MVP standardizes on one flat-header
   template rather than trying to auto-detect every historical format —
   existing sheets need a one-time copy into the template. A column-mapping
   screen (upload any layout, map columns interactively) is a natural v2
   addition if that manual step becomes a bottleneck.

3. Employees are created/updated automatically from the sheet — no separate
   employee entry step needed for the MVP.
4. **History** — every upload is listed; open one to download/print any
   individual payslip or download all of them as a zip.
5. **Employees** — search employees and view each one's payslip history
   across all uploaded periods.

## Notes on "cloud based" for v1

This MVP is built so it can be deployed to any Node-friendly host:

- **Backend:** Render / Railway / Fly.io / a small VPS. Switch
  `provider = "sqlite"` to `"postgresql"` in `backend/prisma/schema.prisma`
  and point `DATABASE_URL` at a hosted Postgres instance (Supabase, Neon,
  Railway) for multi-instance/production use.
- **Frontend:** Vercel / Netlify (static build via `npm run build`).
- **Generated PDFs** are currently stored on the backend's local disk
  (`backend/storage/payslips`). For a host with an ephemeral filesystem
  (e.g. some serverless platforms), swap `pdfPath` storage for an object
  store (S3-compatible bucket) — the `pdf.service.ts` / `payslip.routes.ts`
  are the only two places that would need to change.

## What's intentionally out of scope for v1

- Employee self-service login (only Admin login exists, per the MVP scope).
- Editing salary records after upload (re-upload a corrected sheet instead).
- Payroll calculation rules beyond simple gross − deductions = net.

These are natural "v2" additions once the MVP is validated.
