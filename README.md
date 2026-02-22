# Fountain Doc Generator

Internal tool for generating HRT/TRT letterhead documents for DocuSign.

## Local Development

```bash
npm install
npm run dev
```

## Deploy to Vercel via GitHub

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import your GitHub repo
4. Vercel auto-detects Vite — no config needed
5. Click Deploy

## Project Structure

```
fountain-doc-generator/
├── public/
│   ├── hrt_letterhead.png   # HRT template background
│   ├── trt_letterhead.png   # TRT template background
│   └── logo.png             # Fountain logo
├── src/
│   ├── main.jsx             # Entry point
│   └── App.jsx              # Full application
├── index.html
├── vite.config.js
└── package.json
```

## Adding / Updating Letterheads

Replace the PNG files in `/public` with updated versions. The text overlay
positions are controlled by `headerEndPct` and `footerStartPct` props in `App.jsx`.
