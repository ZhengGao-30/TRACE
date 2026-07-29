# TRACE

Project page and interactive demo for **TRACE: A Two-Channel Robust Attribution
Watermark via Complementary Embeddings for LLM-Agent Trajectories**
([arXiv:2607.08400](https://arxiv.org/abs/2607.08400)).

**Live site:** https://zhenggao-30.github.io/TRACE/

TRACE hides two complementary watermarks in an AI agent's behaviour trajectory,
so provenance survives even when the party holding the log deletes or rewrites
records. A Tech4HSE project (CSIRO's Data61 × UNSW).

## What's in this repo

- `demo/web/` — the project website (landing page) and the interactive demo UI
  (React + Vite + TailwindCSS). This is what GitHub Pages serves.
- `.github/workflows/deploy-pages.yml` — builds and deploys the site on push.

The paper's core watermarking implementation and the demo's Python backend are
not part of this repository.

## The interactive demo

The site's landing page is fully static. The **interactive demo** (a live agent
run through an ALFWorld room, with real-time detection and attack panels) needs
a separate backend that runs the watermarking algorithm; it is not hosted here.
On a phone the demo shows a "open on desktop" notice.

## Develop locally

```bash
cd demo/web
npm install
npm run dev
```

Open http://localhost:5173.
