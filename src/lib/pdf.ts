import { readFile, writeFile, mkdir, exists } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';

const PDF_FOLDER = 'pdfs';

async function ensurePdfFolder(): Promise<string> {
  const base = await appDataDir();
  const dir = await join(base, PDF_FOLDER);
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

/**
 * Copy a PDF from an absolute source path into the app-data pdfs/ folder.
 * Returns the relative path (e.g. "pdfs/abc-123.pdf").
 */
export async function copyPdfToAppData(sourcePath: string, fileName: string): Promise<string> {
  const dir = await ensurePdfFolder();
  const destPath = await join(dir, fileName);
  const data = await readFile(sourcePath);
  await writeFile(destPath, data);
  return `${PDF_FOLDER}/${fileName}`;
}

/**
 * Read a PDF from app-data and return it as base64 string.
 */
export async function readPdfAsBase64(sourcePath: string): Promise<string> {
  const data = await readFile(sourcePath);
  return uint8ToBase64(data);
}

/**
 * Get the absolute path for a relative pdf_path stored in the DB.
 */
export async function getAbsolutePdfPath(relativePath: string): Promise<string> {
  const base = await appDataDir();
  return join(base, relativePath);
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}


