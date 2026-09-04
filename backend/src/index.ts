import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { authRouter } from "./routes/auth.routes";
import { uploadRouter } from "./routes/upload.routes";
import { employeeRouter } from "./routes/employee.routes";
import { historyRouter } from "./routes/history.routes";
import { payslipRouter } from "./routes/payslip.routes";
import { companyRouter } from "./routes/company.routes";
import { clientRouter } from "./routes/client.routes";
import { advanceRouter } from "./routes/advance.routes";
import { portalRouter } from "./routes/portal.routes";
import { reportsRouter } from "./routes/reports.routes";
import { publicRouter } from "./routes/public.routes";
import { dashboardRouter } from "./routes/dashboard.routes";

const app = express();

// In addition to the explicit CORS_ORIGIN list, always allow any
// http://localhost:<port> origin. Vite silently shifts to the next free
// port (5174, 5175, ...) when its default port is taken, which would
// otherwise break local dev with a confusing CORS error.
const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/;

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        env.corsOrigin.includes("*") ||
        env.corsOrigin.includes(origin) ||
        LOCALHOST_ORIGIN.test(origin)
      ) {
        return callback(null, true);
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
  })
);
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRouter);
app.use("/api/uploads", uploadRouter);
app.use("/api/employees", employeeRouter);
app.use("/api/history", historyRouter);
app.use("/api/payslips", payslipRouter);
app.use("/api/company", companyRouter);
app.use("/api/clients", clientRouter);
app.use("/api/advances", advanceRouter);
app.use("/api/portal", portalRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/public", publicRouter);
app.use("/api/dashboard", dashboardRouter);

// Centralized error handler (covers multer errors, unexpected throws, etc.)
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message ?? "Internal server error" });
});

app.listen(env.port, () => {
  console.log(`Payslip API listening on http://localhost:${env.port}`);
});
