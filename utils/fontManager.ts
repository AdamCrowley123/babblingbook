/**
 * Font Manager for Babbling Book
 * Handles Google Fonts, Local Project Fonts (public/fonts/), and System Fonts.
 */

export interface FontDefinition {
  name: string;
  source: 'google' | 'local' | 'system';
  url?: string;
  format?: string;
}

export const GOOGLE_FONTS: string[] = [
  'Comic Neue',
  'Bangers',
  'Luckiest Guy',
  'Permanent Marker',
  'Komika Text',
  'Anton',
  'Chewy',
  'Yomogi',
  'Patrick Hand',
];

export const SYSTEM_FONTS: string[] = ['Arial', 'Verdana'];

/**
 * Automatically scan all font files placed inside public/fonts/
 */
const localFontModules = import.meta.glob<string>('/public/fonts/*.{ttf,otf,woff,woff2}', {
  eager: true,
  query: '?url',
  import: 'default',
});

/**
 * Helper to determine CSS font format from filename or URL
 */
export function getFontFormat(url: string): string {
  const cleanUrl = url.split('?')[0].toLowerCase();
  if (cleanUrl.endsWith('.woff2')) return 'woff2';
  if (cleanUrl.endsWith('.woff')) return 'woff';
  if (cleanUrl.endsWith('.otf')) return 'opentype';
  if (cleanUrl.endsWith('.ttf')) return 'truetype';
  return 'truetype';
}

/**
 * Format filename into font family name
 * e.g., "animeace2_bld.ttf" -> "animeace2_bld"
 */
function getFontNameFromPath(path: string): string {
  const fileName = path.split('/').pop() || path;
  return fileName.replace(/\.[^/.]+$/, '');
}

/**
 * Build dynamic list of local fonts found in public/fonts/
 */
export const LOCAL_FONTS: FontDefinition[] = Object.entries(localFontModules).map(([path, resolvedUrl]) => {
  const fontName = getFontNameFromPath(path);
  const webUrl = typeof resolvedUrl === 'string' && resolvedUrl ? resolvedUrl : (path.startsWith('/public') ? path.replace(/^\/public/, '') : path);
  return {
    name: fontName,
    source: 'local' as const,
    url: webUrl,
    format: getFontFormat(path),
  };
});

/**
 * Register and inject a @font-face rule into the DOM
 */
export async function injectFontFace(font: FontDefinition): Promise<void> {
  if (!font.url || font.source !== 'local') return;

  const fontId = `custom-font-${font.name.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  if (!document.getElementById(fontId)) {
    const format = font.format || getFontFormat(font.url);
    const style = document.createElement('style');
    style.id = fontId;
    style.textContent = `
      @font-face {
        font-family: '${font.name}';
        src: url('${font.url}') format('${format}');
        font-display: swap;
      }
    `;
    document.head.appendChild(style);
  }

  // Also pre-load into document.fonts for immediate canvas & SVG readiness
  if ('fonts' in document) {
    try {
      const face = new FontFace(font.name, `url(${font.url})`);
      const loaded = await face.load();
      document.fonts.add(loaded);
    } catch (e) {
      console.warn(`Could not preload font face ${font.name}:`, e);
    }
  }
}

/**
 * Initialize and inject all local fonts found in public/fonts/
 */
export function initLocalFonts(): void {
  LOCAL_FONTS.forEach(injectFontFace);
}

/**
 * Get all currently available font family names (Google + Local + System)
 */
export function getAllFontFamilies(): string[] {
  const localNames = LOCAL_FONTS.map(f => f.name);
  return Array.from(new Set([
    ...GOOGLE_FONTS,
    ...localNames,
    ...SYSTEM_FONTS,
  ]));
}

/**
 * Generates embedded @font-face CSS (with base64 data URIs) for SVG and raster exports.
 */
export async function getExportEmbeddedFontCss(usedFontNames: string[]): Promise<string> {
  const uniqueFonts = [...new Set(usedFontNames)];
  let combinedCss = '';

  // 1. Check for Google Fonts
  const googleFontsToFetch = uniqueFonts.filter(f => GOOGLE_FONTS.includes(f));
  if (googleFontsToFetch.length > 0) {
    try {
      const fontFamiliesQuery = googleFontsToFetch.map(f => `family=${f.replace(/ /g, '+')}:wght@400;700`).join('&');
      const fontCssUrl = `https://fonts.googleapis.com/css2?${fontFamiliesQuery}&display=swap`;
      const cssResponse = await fetch(fontCssUrl);
      if (cssResponse.ok) {
        let cssText = await cssResponse.text();
        const fontUrlMatches = Array.from(cssText.matchAll(/url\((https?:\/\/[^)]+)\)/g));
        const embeddedPromises = fontUrlMatches.map(async (match) => {
          const url = match[1];
          try {
            const fontFileResponse = await fetch(url);
            if (!fontFileResponse.ok) return { originalUrl: url, dataUri: null };
            const buffer = await fontFileResponse.arrayBuffer();
            const base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
            const mime = fontFileResponse.headers.get('content-type') || 'font/woff2';
            return { originalUrl: url, dataUri: `data:${mime};base64,${base64}` };
          } catch {
            return { originalUrl: url, dataUri: null };
          }
        });

        const embeddedResults = await Promise.all(embeddedPromises);
        for (const { originalUrl, dataUri } of embeddedResults) {
          if (dataUri) {
            cssText = cssText.replace(originalUrl, dataUri);
          }
        }
        combinedCss += `\n${cssText}\n`;
      }
    } catch (err) {
      console.error('Could not embed Google Fonts for export:', err);
    }
  }

  // 2. Check for Local fonts (from public/fonts/)
  for (const fontName of uniqueFonts) {
    const localFont = LOCAL_FONTS.find(f => f.name === fontName);

    if (localFont && localFont.url) {
      try {
        let dataUri = localFont.url;
        // Fetch local font file and convert to base64 for standalone export
        const res = await fetch(localFont.url);
        if (res.ok) {
          const buffer = await res.arrayBuffer();
          const format = localFont.format || getFontFormat(localFont.url);
          const mime = format === 'woff2' ? 'font/woff2' : format === 'woff' ? 'font/woff' : format === 'opentype' ? 'font/otf' : 'font/ttf';
          const base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
          dataUri = `data:${mime};base64,${base64}`;
        }

        const format = localFont.format || getFontFormat(localFont.url);
        combinedCss += `
          @font-face {
            font-family: '${localFont.name}';
            src: url('${dataUri}') format('${format}');
            font-display: swap;
          }
        `;
      } catch (err) {
        console.error(`Could not embed local font ${fontName} for export:`, err);
      }
    }
  }

  return combinedCss;
}
