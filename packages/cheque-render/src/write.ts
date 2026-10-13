/**
 * The only file-system code in the package. It is a thin wrapper: everything it
 * does is call `renderCheque` and write the bytes, so tests can exercise the
 * whole renderer in memory.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { renderCheque } from './render.ts';
import type { ChequeData, ChequeLayout, PrinterProfile, RenderOptions } from './types.ts';

export async function renderChequeToFile(
  layout: ChequeLayout,
  profile: PrinterProfile,
  data: ChequeData,
  options: RenderOptions,
  path: string,
): Promise<void> {
  const bytes = await renderCheque(layout, profile, data, options);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}
