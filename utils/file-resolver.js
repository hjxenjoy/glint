// Process a FileList and return structured demo data
export async function resolveFileSet(fileList) {
  const files = Array.from(fileList);
  const textExts = new Set(['html', 'css', 'js', 'json', 'txt', 'md', 'svg', 'xml']);
  const imageExts = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'ico']);

  const textFiles = [];
  const assetFiles = [];

  // Strip common root folder prefix (from webkitdirectory uploads)
  const paths = files.map((f) => f.webkitRelativePath || f.name);
  const prefix = getCommonPrefix(paths);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const name = (paths[i].slice(prefix.length) || file.name).replace(/^\//, '');
    const ext = name.split('.').pop().toLowerCase();

    if (textExts.has(ext)) {
      const content = await file.text();
      textFiles.push({ name, content, mimeType: file.type || guessMime(name) });
    } else if (imageExts.has(ext) || file.type.startsWith('image/')) {
      const data = await fileToBase64(file);
      assetFiles.push({
        filename: name,
        mimeType: file.type || guessMime(name),
        data,
        size: file.size,
      });
    }
  }

  // Determine entry file
  const htmlFiles = textFiles.filter((f) => f.name.endsWith('.html'));
  let entryFile = 'index.html';
  if (htmlFiles.length === 1) {
    entryFile = htmlFiles[0].name;
  } else if (htmlFiles.find((f) => f.name === 'index.html')) {
    entryFile = 'index.html';
  } else if (htmlFiles.length > 1) {
    // Return all html files so caller can prompt user
    entryFile = htmlFiles[0].name;
  }

  return { entryFile, files: textFiles, assets: assetFiles };
}

function getCommonPrefix(paths) {
  if (!paths.length) return '';
  // If single file (not from directory), no prefix
  if (paths.every((p) => !p.includes('/'))) return '';
  const parts = paths[0].split('/');
  let prefix = '';
  for (let i = 0; i < parts.length - 1; i++) {
    const candidate = parts.slice(0, i + 1).join('/') + '/';
    if (paths.every((p) => p.startsWith(candidate))) prefix = candidate;
    else break;
  }
  return prefix;
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
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
  return map[ext] || 'text/plain';
}

// Replace asset references in HTML content with base64 data URIs
export function inlineAssets(htmlContent, assetsMap) {
  // Parse with DOMParser for HTML attributes
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');

  // Replace src attributes
  doc.querySelectorAll('[src]').forEach((el) => {
    const src = el.getAttribute('src');
    const filename = src.split('/').pop().split('?')[0];
    if (assetsMap[filename]) el.setAttribute('src', assetsMap[filename]);
  });

  // Replace href attributes (for images/icons, not for CSS/JS links)
  doc.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach((el) => {
    const href = el.getAttribute('href');
    const filename = href?.split('/').pop().split('?')[0];
    if (filename && assetsMap[filename]) el.setAttribute('href', assetsMap[filename]);
  });

  // Replace CSS url() in style tags and inline styles
  const styleEls = doc.querySelectorAll('style, [style]');
  styleEls.forEach((el) => {
    // Access the right property
    let css = el.tagName === 'STYLE' ? el.textContent : el.getAttribute('style');
    if (!css) return;
    css = inlineCSSAssets(css, assetsMap);
    if (el.tagName === 'STYLE') el.textContent = css;
    else el.setAttribute('style', css);
  });

  return '<!DOCTYPE html>' + doc.documentElement.outerHTML;
}

function inlineCSSAssets(css, assetsMap) {
  return css.replace(/url\(['"]?([^'")]+)['"]?\)/g, (match, url) => {
    const filename = url.split('/').pop().split('?')[0];
    if (assetsMap[filename]) return `url('${assetsMap[filename]}')`;
    return match;
  });
}

// Build complete srcdoc string for iframe preview
export function buildSrcdoc(demo, assets) {
  const entryFile = demo.files?.find((f) => f.name === demo.entryFile) || demo.files?.[0];
  if (!entryFile) return '<html><body><p>No HTML file found</p></body></html>';

  // Build assets map: filename -> base64 data URI
  const assetsMap = {};
  for (const asset of assets || []) {
    assetsMap[asset.filename] = asset.data;
    // Also map without path prefix
    const basename = asset.filename.split('/').pop();
    assetsMap[basename] = asset.data;
  }

  // Also inline CSS files referenced in the HTML
  let html = entryFile.content;

  // Inline linked CSS files
  const cssFiles = Object.fromEntries(
    (demo.files || []).filter((f) => f.name.endsWith('.css')).map((f) => [f.name, f.content])
  );
  html = html.replace(
    /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi,
    (match, href) => {
      const filename = href.split('/').pop();
      const cssContent = cssFiles[filename] || cssFiles[href];
      if (cssContent) {
        const inlined = inlineCSSAssets(cssContent, assetsMap);
        return `<style>${inlined}</style>`;
      }
      return match;
    }
  );

  // Inline JS files (optional — skip for security, let them error naturally)

  return inlineAssets(html, assetsMap);
}
