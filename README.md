# MMDM benchmark website

A white, buildless academic project page for **MMDM: Measuring Massive Multitask Decision Making**. The page uses the supplied benchmark logo and displays the six authors with numbered institutional affiliations below the title. Public-facing text names the benchmark MMDM; version IDs are retained only in source paths and machine-readable provenance.

## Open the page

Open `index.html` directly in a browser. It is a self-contained HTML file: results, charts, styles, JavaScript, examples, and the original PNG logo are embedded. It needs no HTTP server, port forwarding, internet connection, or package installation. Resource links lead to their respective external projects.

Local project: `/Users/shamkwanho/Documents/Code_Project/mmdm-benchmark.github.io`.

- Website / Pages repository: <https://github.com/mmdm-benchmark/mmdm-benchmark.github.io>
- Main GitHub button: <https://github.com/mmdm-benchmark/mmdm>

## Current data

The MMDM release has 5,448 examples across 16 categories, 80 category–subcategory combinations, and 62 source identifiers. Labels comprise 4,112 Hard Single, 633 Hard Set, and 703 Soft examples. The 663 Score tasks overlap these labels (35 Hard Single, 628 Soft).

The results snapshot contains 28 model runs plus Random (uniform). Pending evaluation and review metadata remain in the embedded source data. The page embeds the snapshot timestamp and source hashes.

Leaderboard columns are Decision Model, Hard Single Acc, Hard Set Acc, and Soft Brier. Category filters share the same underlying results as the figures. Hard accuracy uses all items, including failed requests in its denominator. Hard Set uses exact Top-N set match with N equal to the reference set size. Soft Brier uses each model's native valid full-distribution predictions. Nonapplicable metrics render as an em dash. No Hard Brier or Soft Accuracy is displayed.

## Charts and examples

- Native inline SVG radar (switch between Hard Single and Hard Set) and soft Brier dot plot.
- The six default representatives, in figure order, are Perplexity Decider-V1.2, Jev 1.14.0, Microsoft Decision-1, LightDecision-1 27B, Intern-Decision 4B, and OpenJev 4B. Their selection is shared through the exported provenance; charts retain the existing Morandi colors. Additional available models can be selected.
- Model display names follow the original results report, with the requested short name Jev 1.14.0. The same names appear in the leaderboard, chart legends, tooltips, and model selector.
- A vertical SVG category bar chart in the original paper-figure layout, with a #Tasks axis; donut and stacked bars for labels and Score.
- Context histograms switch between complete input and state + question. Tokens use Qwen3.5-4B, no special tokens; K is 1,024 tokens.
- Option-set size is shown in seven fixed grouped ranges (2–1,024).
- 27 authentic current-release examples across all 16 categories. Inputs and reference answers are unmodified; examples use their current reference answers.
- Example JSON downloads use embedded data and work offline.

## Rebuild from updated reports

```sh
python3 scripts/export_v2.py \
  --source-root /Users/shamkwanho/Documents/Code_Project/omni-openjev
```

This reads `docs/reports/mmdm-v2-baselines-20261020/comparison.json`, the current `docs/reports/mmdm/` release metadata, and `benchmarks/mmdm-v2/mmdm.jsonl`. It checks the shared dataset SHA, category/label/option counts, and completed-run identity before writing `data/benchmark.json`, `data/provenance.json`, and `index.html`. Regeneration includes any newly completed model summaries. Existing exported source snapshots should be preserved if reproducibility across report updates is required.

Edit the source files, then rebuild:

- `templates/index.html`: page structure and prose
- `assets/style.css`: responsive layout
- `assets/app.js`: charts, leaderboard, and examples
- `scripts/export_v2.py`: checked data transformation and standalone packaging
- `assets/mmdm-logo.png`: supplied original transparent logo

`index.html` is generated. `scripts/export_data.py` delegates to the current v2 exporter.

## Validation

Browser validation uses a copy of the single HTML file in an otherwise unrelated directory, in offline mode. It checks every category view, applicable metrics, all examples, chart controls, downloads, and 320/390/768/1440px layouts. A reference snapshot of the validation results is saved under `.preview/` (Git-ignored).

## GitHub Pages

Push this project to the Pages repository and set Settings → Pages → Deploy from a branch → main → /(root). The self-contained `index.html` also works unchanged on GitHub Pages. `.nojekyll` is included.

## Attribution

The page structure follows [MMMU](https://mmmu-benchmark.github.io/) and [MathVista](https://mathvista.github.io/). The interactive figures use MMDM's Morandi palette and data from the current release and baseline reports. Dataset sources retain their notices: [source notices](https://huggingface.co/datasets/shenjunhao/mmdm/blob/main/SOURCE_NOTICES.md).
