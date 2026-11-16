import * as THREE from 'three';

const textureCache = new Map<string, THREE.CanvasTexture>();

export interface SignOptions {
  bg: string;
  bgBottom?: string;
  border?: string;
  title: string;
  subtitle?: string;
  bnText?: string;
  textColor?: string;
  accentColor?: string;
  badge?: 'hospital' | 'shwapno' | 'sust' | 'brtc' | 'highway' | 'mosque' | 'shop';
  width?: number;
  height?: number;
}

export function createSignboardTexture(key: string, opts: SignOptions): THREE.CanvasTexture {
  const cached = textureCache.get(key);
  if (cached) return cached;

  const w = opts.width ?? 1024;
  const h = opts.height ?? 320;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, opts.bg);
  grad.addColorStop(1, opts.bgBottom ?? opts.bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Border
  if (opts.border) {
    ctx.strokeStyle = opts.border;
    ctx.lineWidth = Math.max(8, Math.round(h * 0.04));
    ctx.strokeRect(10, 10, w - 20, h - 20);
  }

  let leftOffset = 0;

  // Custom brand badges so Shwapno, Mount Adora, SUST etc. look immediately authentic!
  if (opts.badge === 'hospital') {
    const cx = h * 0.48;
    const cy = h * 0.5;
    const r = h * 0.32;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e11d48';
    const barW = r * 0.52;
    const barL = r * 1.3;
    ctx.fillRect(cx - barW / 2, cy - barL / 2, barW, barL);
    ctx.fillRect(cx - barL / 2, cy - barW / 2, barL, barW);
    leftOffset = h * 0.85;
  } else if (opts.badge === 'shwapno') {
    // Iconic Shwapno yellow-orange sunburst / cart emblem on left
    const cx = h * 0.48;
    const cy = h * 0.5;
    const r = h * 0.32;
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = Math.max(6, h * 0.035);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.25, cy + Math.sin(a) * r * 0.25);
      ctx.lineTo(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78);
      ctx.stroke();
    }
    leftOffset = h * 0.86;
  } else if (opts.badge === 'sust') {
    const cx = h * 0.48;
    const cy = h * 0.5;
    const r = h * 0.31;
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = '#065f46';
    ctx.font = `900 ${Math.round(r * 0.65)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SUST', cx, cy + 2);
    leftOffset = h * 0.86;
  }

  const centerX = leftOffset + (w - leftOffset) / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const textColor = opts.textColor ?? '#ffffff';
  const accent = opts.accentColor ?? '#fde047';

  if (opts.bnText && opts.subtitle) {
    ctx.fillStyle = accent;
    ctx.font = `700 ${Math.round(h * 0.21)}px "Noto Sans Bengali", Inter, sans-serif`;
    ctx.fillText(opts.bnText, centerX, h * 0.26, w - leftOffset - 48);

    ctx.fillStyle = textColor;
    ctx.font = `900 ${Math.round(h * 0.27)}px Inter, sans-serif`;
    ctx.fillText(opts.title, centerX, h * 0.56, w - leftOffset - 48);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = `600 ${Math.round(h * 0.15)}px Inter, sans-serif`;
    ctx.fillText(opts.subtitle, centerX, h * 0.81, w - leftOffset - 48);
  } else if (opts.bnText) {
    ctx.fillStyle = accent;
    ctx.font = `700 ${Math.round(h * 0.24)}px "Noto Sans Bengali", Inter, sans-serif`;
    ctx.fillText(opts.bnText, centerX, h * 0.34, w - leftOffset - 48);

    ctx.fillStyle = textColor;
    ctx.font = `900 ${Math.round(h * 0.30)}px Inter, sans-serif`;
    ctx.fillText(opts.title, centerX, h * 0.70, w - leftOffset - 48);
  } else if (opts.subtitle) {
    ctx.fillStyle = textColor;
    ctx.font = `900 ${Math.round(h * 0.32)}px Inter, sans-serif`;
    ctx.fillText(opts.title, centerX, h * 0.40, w - leftOffset - 48);

    ctx.fillStyle = accent;
    ctx.font = `700 ${Math.round(h * 0.19)}px Inter, sans-serif`;
    ctx.fillText(opts.subtitle, centerX, h * 0.73, w - leftOffset - 48);
  } else {
    ctx.fillStyle = textColor;
    ctx.font = `900 ${Math.round(h * 0.38)}px Inter, sans-serif`;
    ctx.fillText(opts.title, centerX, h * 0.52, w - leftOffset - 48);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  textureCache.set(key, tex);
  return tex;
}

export function createRoadAsphaltTexture(): THREE.CanvasTexture {
  const key = '__road_asphalt_v1';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base bitumen asphalt
  ctx.fillStyle = '#262b33';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle asphalt grain & tire wear lanes
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 30 + Math.floor(Math.random() * 28);
    ctx.fillStyle = `rgb(${v},${v + 3},${v + 8})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Darker tire wear tracks in left & right lanes
  ctx.fillStyle = 'rgba(15, 18, 24, 0.25)';
  ctx.fillRect(95, 0, 85, 512);
  ctx.fillRect(332, 0, 85, 512);

  // Outer yellow curb lines (Bangladesh city road edge markings)
  ctx.fillStyle = '#eab308';
  ctx.fillRect(18, 0, 8, 512);
  ctx.fillRect(486, 0, 8, 512);

  // White dashed center lane divider
  ctx.fillStyle = '#f8fafc';
  for (let y = 16; y < 512; y += 96) {
    ctx.fillRect(252, y, 8, 54);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  textureCache.set(key, tex);
  return tex;
}

export function createBuildingFacadeTexture(
  seed: number,
  wallColor: string,
  shopBanner?: { name: string; bg: string; text: string }
): THREE.CanvasTexture {
  const key = `facade_${seed}_${wallColor}_${shopBanner?.name ?? 'none'}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = wallColor;
  ctx.fillRect(0, 0, 512, 512);

  // Horizontal floor ledges
  const floors = 4;
  const topArea = shopBanner ? 390 : 480;
  const floorH = topArea / floors;

  for (let f = 0; f < floors; f++) {
    const y0 = f * floorH;
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.fillRect(0, y0 + floorH - 6, 512, 6);

    // 4 windows per floor
    for (let w = 0; w < 4; w++) {
      const wx = 26 + w * 120;
      const wy = y0 + 18;
      const ww = 76;
      const wh = floorH - 34;

      const lit = ((seed + f * 7 + w * 3) % 5) < 2;
      ctx.fillStyle = lit ? '#fef08a' : '#1e293b';
      ctx.fillRect(wx, wy, ww, wh);

      // Window mullions
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 3;
      ctx.strokeRect(wx, wy, ww, wh);
      ctx.beginPath();
      ctx.moveTo(wx + ww / 2, wy);
      ctx.lineTo(wx + ww / 2, wy + wh);
      ctx.stroke();

      // Occasional AC outdoor unit
      if ((seed + f + w) % 4 === 0) {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(wx + ww + 4, wy + 8, 22, 16);
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(wx + ww + 12, wy + 16, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Ground floor Sylheti shopfront!
  if (shopBanner) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 390, 512, 122);

    // Shop signboard
    ctx.fillStyle = shopBanner.bg;
    ctx.fillRect(10, 394, 492, 42);
    ctx.fillStyle = shopBanner.text;
    ctx.font = '800 24px "Noto Sans Bengali", Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(shopBanner.name, 256, 415, 470);

    // Lit shop interior display windows
    ctx.fillStyle = '#fef9c3';
    ctx.fillRect(24, 444, 210, 62);
    ctx.fillRect(276, 444, 210, 62);
    ctx.fillStyle = '#f472b6'; // bKash pink sticker!
    ctx.fillRect(240, 452, 30, 22);
    ctx.fillStyle = '#fb923c'; // Nagad orange sticker!
    ctx.fillRect(240, 478, 30, 22);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

export function createGlassCurtainTexture(tintHex: string, gridColor = '#93c5fd'): THREE.CanvasTexture {
  const key = `glass_${tintHex}_${gridColor}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, tintHex);
  grad.addColorStop(0.5, '#38bdf8');
  grad.addColorStop(1, tintHex);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Diagonal sky reflection bands
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.moveTo(60, 0);
  ctx.lineTo(180, 0);
  ctx.lineTo(0, 240);
  ctx.lineTo(0, 120);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(310, 0);
  ctx.lineTo(440, 0);
  ctx.lineTo(80, 512);
  ctx.lineTo(0, 512);
  ctx.closePath();
  ctx.fill();

  // Mullion grid
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 4;
  for (let x = 0; x <= 512; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y <= 512; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

export function createLEDMatrixTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  updateLEDMatrixCanvas(canvas, text);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function updateLEDMatrixCanvas(canvas: HTMLCanvasElement, text: string): void {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  ctx.fillStyle = '#facc15';
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 10;
  ctx.font = '900 44px monospace, Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 2, w - 36);
  ctx.shadowBlur = 0;
}

export function createRickshawArtTexture(paletteIndex: number): THREE.CanvasTexture {
  const key = `rickshaw_art_${paletteIndex}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const palettes = [
    ['#e11d48', '#facc15', '#0284c7'],
    ['#2563eb', '#f472b6', '#fde047'],
    ['#16a34a', '#fb923c', '#fef08a'],
    ['#9333ea', '#22d3ee', '#fde047'],
  ];
  const [bg, c1, c2] = palettes[paletteIndex % palettes.length];

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 256);

  // Scalloped border
  ctx.strokeStyle = c1;
  ctx.lineWidth = 10;
  ctx.strokeRect(12, 12, 232, 232);

  // Folk floral medallion in center
  ctx.fillStyle = c2;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.arc(128 + Math.cos(a) * 44, 128 + Math.sin(a) * 44, 24, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = c1;
  ctx.beginPath();
  ctx.arc(128, 128, 30, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}
