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
- `demo/hse/cases/` — the two synthetic fixtures used by frontend tests.

The paper's core watermarking implementation and the demo's Python backend are
not part of this repository.

## The interactive demo

The site includes Household Tasks, Industrial Safety (HSE), and General Attack
Scenarios. Saved runs play directly from static files without a Python backend
or model API. The two HSE duty-shift cases each contain 31 displayed steps,
including one explicitly injected controller fault. Watermarked actions replay
alongside the recorded unwatermarked comparison, with probabilities, selection
scores, and attribution results available for inspection.

Live model execution still requires a separately configured backend. This
repository publishes the website and saved demonstrations, not that service.

## Develop locally

Use Node.js 24 (minimum 22.12) and npm 10.5.1 or newer.

```bash
cd demo/web
npm ci
npm test
npm run build
npm run dev
```

Open the URL printed by Vite (normally http://localhost:5173).

For deployment under a subdirectory, set the base path when building, for
example `BASE_PATH=/TRACE/ npm run build`. The Pages workflow supplies the
repository-specific path automatically.
