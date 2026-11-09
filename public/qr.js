import qrcode from './vendor/qrcode.js';

// Square matrix of booleans (true = dark module) for a text, using the lowest error correction so it stays small.
export function qrMatrix(text) {
  const code = qrcode(0, 'L');
  code.addData(String(text), 'Byte');
  code.make();
  const size = code.getModuleCount();
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, column) => code.isDark(row, column)));
}

// Draws the matrix as one SVG path with the quiet zone the scanners need.
export function renderQr(container, text, label = 'QR code') {
  const matrix = qrMatrix(text), margin = 4, size = matrix.length + margin * 2;
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label);
  svg.setAttribute('shape-rendering', 'crispEdges');
  const background = document.createElementNS(namespace, 'rect');
  background.setAttribute('width', String(size)); background.setAttribute('height', String(size)); background.setAttribute('fill', '#fff');
  const path = document.createElementNS(namespace, 'path');
  let data = '';
  matrix.forEach((row, y) => { let x = 0; while (x < row.length) { if (!row[x]) { x++; continue; } let end = x; while (end < row.length && row[end]) end++; data += `M${x + margin} ${y + margin}h${end - x}v1h-${end - x}z`; x = end; } });
  path.setAttribute('d', data); path.setAttribute('fill', '#000');
  svg.append(background, path);
  container.replaceChildren(svg);
  return matrix.length;
}
