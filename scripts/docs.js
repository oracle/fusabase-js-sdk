import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Target the TypeDoc output directory
const docsDir = path.resolve(__dirname, '..', 'docs', 'api-reference');

const MARKER = '<!-- injected-custom-header -->';

// Exact header HTML provided by request
const headerInner =
  '<b> Oracle&reg; Backend for Firebase JavaScript Modular SDK Reference <br>Release 26.1.0</b><br>G48196-02<br>';

// Wrap with layout-friendly container inside TypeDoc main container
const headerBlock = `
${MARKER}
<div class="tsd-panel tsd-typography" style="margin-top: 1rem; margin-bottom: 1rem;">
  <div class="row" style="margin-top: 0; margin-bottom: 0;">
    <div class="col-12" style="font-size: 1rem;">
      ${headerInner}
    </div>
  </div>
</div>
`;

 // Footer injection constants
const FOOTER_MARKER = '<!-- injected-custom-footer -->';
const footerInner = 'Copyright &copy; 2026, Oracle and/or its affiliates.';
const footerBlock = `
${FOOTER_MARKER}
<div class="row" style="margin-top: 1rem; margin-bottom: 1rem;">
  <div class="col-12" style="font-size: 0.9rem; text-align: center;">
    ${footerInner}
  </div>
</div>
`;

// Recursively collect all .html files under docsDir
async function getHtmlFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await getHtmlFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(full);
    }
  }
  return files;
}

 // Inject headerBlock into a single HTML file, relocating if already present
async function injectHeader(file) {
  let content = await fs.readFile(file, 'utf8');

  const contentTag = '<div class="col-content">';
  const containerTag = '<div class="container container-main">';
  const bodyTag = '<body>';

  // If a header was already injected earlier, remove it so we can reinsert at the correct spot
  const markerIdx = content.indexOf(MARKER);
  if (markerIdx !== -1) {
    // Heuristically find the end of our injected block: it consists of three nested </div>
    let endIdx = markerIdx;
    let closes = 0;
    while (closes < 3) {
      const nextClose = content.indexOf('</div>', endIdx);
      if (nextClose === -1) break;
      endIdx = nextClose + '</div>'.length;
      closes++;
    }
    // Include a trailing newline if present
    const after = content[endIdx] === '\n' ? endIdx + 1 : endIdx;
    content = content.slice(0, markerIdx) + content.slice(after);
  }

  // Insert at preferred position: top of main content column
  if (content.includes(contentTag)) {
    const idx = content.indexOf(contentTag) + contentTag.length;
    content = content.slice(0, idx) + '\n' + headerBlock + '\n' + content.slice(idx);
  } else if (content.includes(containerTag)) {
    const idx = content.indexOf(containerTag) + containerTag.length;
    content = content.slice(0, idx) + '\n' + headerBlock + '\n' + content.slice(idx);
  } else if (content.includes(bodyTag)) {
    const idx = content.indexOf(bodyTag) + bodyTag.length;
    content = content.slice(0, idx) + '\n' + headerBlock + '\n' + content.slice(idx);
  } else {
    // Fallback: prepend if expected anchors are not found
    content = headerBlock + '\n' + content;
  }

  await fs.writeFile(file, content, 'utf8');
  return true;
}

async function injectFooter(file) {
  let content = await fs.readFile(file, 'utf8');
  if (content.includes(FOOTER_MARKER)) return false;

  const endBodyTag = '</body>';

  if (content.includes(endBodyTag)) {
    const idx = content.indexOf(endBodyTag);
    content = content.slice(0, idx) + '\n' + footerBlock + '\n' + content.slice(idx);
  } else {
    // Fallback: append at end if </body> not found
    content = content + '\n' + footerBlock + '\n';
  }

  await fs.writeFile(file, content, 'utf8');
  return true;
}

async function main() {
  // Ensure docs directory exists
  try {
    const stat = await fs.stat(docsDir);
    if (!stat.isDirectory()) {
      console.error(`[docs] Not a directory: ${docsDir}`);
      process.exit(0); // do not fail the pipeline
    }
  } catch {
    console.warn(`[docs] Skipping header injection, directory not found: ${docsDir}`);
    return;
  }

  const files = await getHtmlFiles(docsDir);
  let modified = 0;
  for (const f of files) {
    const changedH = await injectHeader(f);
    const changedF = await injectFooter(f);
    if (changedH) modified++;
    if (changedF) modified++;
  }
  console.log(`[docs] Header injection complete. Processed ${files.length} HTML files, modified ${modified}.`);
}

main().catch((err) => {
  console.error('[docs] Header injection error:', err);
  process.exit(1);
});
