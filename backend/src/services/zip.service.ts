import archiver from "archiver";
import { Response } from "express";

export interface ZipEntry {
  filePath: string;
  nameInZip: string;
}

/**
 * Streams a zip archive of the given files directly to the HTTP response.
 */
export function streamZip(res: Response, zipFileName: string, entries: ZipEntry[]): Promise<void> {
  return new Promise((resolve, reject) => {
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipFileName}"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      reject(err);
      res.status(500).end();
    });
    archive.on("end", () => resolve());

    archive.pipe(res);
    for (const entry of entries) {
      archive.file(entry.filePath, { name: entry.nameInZip });
    }
    archive.finalize();
  });
}
