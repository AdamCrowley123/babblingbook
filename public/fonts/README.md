# Cartella Font Locali (Local Fonts)

Puoi inserire in questa cartella i tuoi file di font personalizzati per i fumetti:
- File supportati: `.ttf`, `.otf`, `.woff`, `.woff2`

## Come aggiungere un font:
1. Copia il file del font in questa cartella (es. `public/fonts/MioFont.ttf`).
2. Se vuoi personalizzarne il nome visualizzato nell'app, puoi aggiungerlo all'elenco `LOCAL_FONTS` in `constants.ts` (oppure l'app lo rileverà automaticamente con il nome del file).
3. Il font sarà immediatamente disponibile nel menu a tendina "Font Family" e verrà incorporato automaticamente anche nei file SVG e PNG esportati!
