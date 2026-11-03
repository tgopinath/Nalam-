import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(root, 'uploads');
export const PUBLIC_DIR = path.join(root, 'public');
