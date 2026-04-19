const FFLATE_URL = 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js';

export async function packExport(data) {
  const { zipSync, strToU8 } = await import(FFLATE_URL);
  const files = {};

  files['manifest.json'] = strToU8(
    JSON.stringify(
      {
        version: '1',
        exportedAt: Date.now(),
        projectIds: data.projects.map((p) => p.id),
        demoIds: data.demos.map((d) => d.id),
      },
      null,
      2
    )
  );

  for (const project of data.projects) {
    files[`projects/${project.id}.json`] = strToU8(JSON.stringify(project, null, 2));
  }

  for (const demo of data.demos) {
    const { assets = [], files: demoFiles = [], ...meta } = demo;
    files[`demos/${demo.id}/meta.json`] = strToU8(JSON.stringify(meta, null, 2));
    for (const file of demoFiles) {
      files[`demos/${demo.id}/${file.name}`] = strToU8(file.content);
    }
    for (const asset of assets) {
      // Decode base64 to Uint8Array
      const base64 = asset.data.split(',')[1] || '';
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      files[`demos/${demo.id}/assets/${asset.filename}`] = bytes;
    }
  }

  const zipped = zipSync(files);
  return zipped;
}

export async function unpackImport(buffer) {
  const { unzipSync, strFromU8 } = await import(FFLATE_URL);
  const files = unzipSync(new Uint8Array(buffer));

  const projects = [];
  const demos = [];

  for (const [path, data] of Object.entries(files)) {
    if (path.startsWith('projects/') && path.endsWith('.json')) {
      projects.push(JSON.parse(strFromU8(data)));
    }
  }

  // Group demo files
  const demoMap = {};
  for (const [path, data] of Object.entries(files)) {
    const match = path.match(/^demos\/([^/]+)\//);
    if (!match) continue;
    const demoId = match[1];
    if (!demoMap[demoId]) demoMap[demoId] = { files: [], assets: [] };

    if (path.endsWith('/meta.json')) {
      demoMap[demoId].meta = JSON.parse(strFromU8(data));
    } else if (path.includes('/assets/')) {
      const filename = path.split('/assets/')[1];
      const mimeType = guessMime(filename);
      const bytes = data;
      const binary = Array.from(bytes)
        .map((b) => String.fromCharCode(b))
        .join('');
      const base64 = btoa(binary);
      demoMap[demoId].assets.push({
        filename,
        mimeType,
        data: `data:${mimeType};base64,${base64}`,
        size: bytes.length,
      });
    } else {
      const filename = path.replace(`demos/${demoId}/`, '');
      if (filename && !filename.includes('/')) {
        demoMap[demoId].files.push({
          name: filename,
          content: strFromU8(data),
          mimeType: guessMime(filename),
        });
      }
    }
  }

  for (const [id, demoData] of Object.entries(demoMap)) {
    if (demoData.meta) {
      demos.push({ ...demoData.meta, files: demoData.files, assets: demoData.assets });
    }
  }

  return { projects, demos };
}

function guessMime(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    html: 'text/html',
    css: 'text/css',
    js: 'text/javascript',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
  };
  return map[ext] || 'application/octet-stream';
}

export async function exportAsJSON(data) {
  const payload = { version: '1', exportedAt: Date.now(), ...data };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  await triggerDownload(blob, `glint-export-${new Date().toISOString().slice(0, 10)}.json`);
}

export async function triggerDownload(blob, filename) {
  // Use FileReader.readAsDataURL to avoid createObjectURL failures in
  // sandboxed/restricted contexts (e.g. Safari, certain PWA environments).
  const url = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
