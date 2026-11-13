# MMDM benchmark website

A white, buildless academic project page for **MMDM: Measuring Massive Multitask Decision Making**. The page uses the supplied benchmark logo and displays the six authors with numbered institutional affiliations below the title. Public-facing text names the benchmark MMDM; version IDs are retained only in source paths and machine-readable provenance.

## Open the page

Open `index.html` directly in a browser. It is a self-contained HTML file: results, charts, styles, JavaScript, examples, and the original PNG logo are embedded. It needs no HTTP server, port forwarding, internet connection, or package installation. Resource links lead to their respective external projects.

Local project: `/Users/shamkwanho/Documents/Code_Project/mmdm-benchmark.github.io`.

- Website / Pages repository: <https://github.com/mmdm-benchmark/mmdm-benchmark.github.io>
- Main GitHub button: <https://github.com/mmdm-benchmark/mmdm>

## Current data

The MMDM release has 5,448 examples across 16 categories. Labels comprise 4,112 Hard Single-select, 633 Hard Multi-select, and 703 Soft examples. The 663 Score tasks overlap these labels (35 Hard Single-select, 628 Soft).

The results snapshot contains 29 public model runs plus Random (uniform). Display names follow the paper. The public model selection is recorded in `config/model-display.json`. The page embeds the results snapshot timestamp and source hashes, with the source report timestamp retained separately in provenance.

Leaderboard columns are Decision Model, Hard Single-select Acc, Hard Multi-select Acc, and Soft Brier. Category filters share the same underlying results as the figures. Hard accuracy includes failed requests. Quota-limited interim runs show the evaluated denominator beside each affected accuracy. Hard Multi-select uses exact Top-N set match with N equal to the reference set size. Soft Brier uses each model's native valid full-distribution predictions. Nonapplicable metrics render as an em dash. No Hard Brier or Soft Accuracy is displayed.

The introduction names the leading models and connects their results to category-level gaps. Dataset documentation explains the state, question, option names and criteria, each reference-label type, and scoring examples. Model counts, best results, and the leading model’s category accuracies are generated from the public subset of the embedded snapshot. The introduction combines test-set contamination with the paper’s motivation: jointly testing long contexts, large option spaces, and complex logical dependencies through fresh construction, recomposition, and rewriting. The concise paragraph has no external citation.

## Charts and examples

- Native inline SVG radar with Hard Single-select / Hard Multi-select tab buttons, a soft Brier dot plot, and interactive calibration curves before the introduction. A prominent shared model chooser controls these views.
- Calibration switches between Hard Single-select and Soft, using 10 equal-width confidence bins. Shared-cohort mode uses the source report’s fixed common examples intersected with the verified supplemental run (2,081 hard / 192 soft); all-eligible mode uses each model’s own valid native unique-top1 predictions. Empty bins stay empty; only adjacent populated bins are connected. Hollow points have fewer than 20 samples. ECE is recomputed and checked during export.
- A Hard Multi-select tab beside Hard Single-select and Soft shows exact Top-N set match over all 633 tasks alongside Top-N probability balance over each model’s valid native predictions. Balance is the normalized similarity to equal weighting inside the predicted top N; it is not set correctness or a calibration probability. Tooltips preserve the distinct denominators. Both quantities come directly from the source report.
- The size-performance plot after the leaderboard switches among Hard Single-select Accuracy, Hard Multi-select Accuracy, and Soft Brier. It uses reported total/backbone size on a log axis, computes the nondominated frontier among displayed disclosed-size models, and shows undisclosed-size models as horizontal dashed references. A monotone cubic curve connects the measured frontier points without overshooting their endpoint values. Numbered markers map to a clickable model-and-result list below the plot; other models are muted. The vertical scale follows the displayed range with explicit ticks. It can display all 28 public models or the shared model selection. Lower Brier is better; no composite score is introduced.
- Chart points and curve segments show immediate pointer-local tooltips with model names and values, plus a visible highlight. Crosshair cursors are consistent across plots; tooltips remain inside the viewport and also support keyboard focus and touch. Line hit areas sit behind point markers.
- Charts interpolate matched geometry over 400 ms; charts with different axes use a 280 ms transition. Rapid switches cancel stale animations, and reduced-motion preferences disable these effects.
- The five default representatives, in figure order, are Perplexity Decider-V1.2, Jev 1.14.0, Microsoft Decision-1, Intern-Decision 4B, and OpenJev 4B. Their selection is shared through the exported provenance; charts retain the existing Morandi colors. Additional available models can be selected. WeMM and KnowLine retain blue-teal and plum; GPT-6 Luna Decisions uses ochre.
- Model display names follow the paper, including Jev 1.14.0 and the Decisio configurations. The same names appear in the leaderboard, chart legends, tooltips, and model selector.
- A vertical SVG category bar chart in the original paper-figure layout, with a #Tasks axis; donut and stacked bars for labels and Score.
- Context histograms switch between complete input and state + question. Tokens use Qwen3.5-4B, no special tokens; K is 1,024 tokens.
- Option-set size is shown in seven fixed grouped ranges (2–1,024).
- 48 authentic current-release examples, three per category across all 16 categories, browsed as one continuous sequence with Previous / Next and a global counter. Each example header shows its answer type, category, and option count. Inputs and reference answers are unmodified. Existing examples are retained; additions prioritize independent parents and complementary sources, subcategories, answer labels, and option-set sizes.
- Example JSON downloads use embedded data and work offline.

## Model visibility and metadata

`config/model-display.json` controls model eligibility, hidden model IDs, default representatives, release status, reported parameter scale, active MoE parameters, and primary source links. Eligible configurations return candidate probabilities by direct scoring or single-step decoding, without generated reasoning, adaptive thinking, or a generated textual probability vector. The rule applies to each native call; deterministic grouped evaluation may compose several such calls. Hidden models are excluded from exported results, calibration series, model selection and summary claims; their original evaluation records remain in the source report. `results_updated_at` records a change to the public result selection. The displayed results snapshot uses the later of this timestamp and the source report timestamp. To include a configuration, verify that its inference path meets `inference_policy`, add verified access and size metadata under `models`, remove its ID from the hidden list, and rebuild. AutoThink and generated-distribution runs remain archived in the source report.

Access and parameter-range filters compose with category selection and search. Filters use reported total/backbone scale, with active MoE scale displayed separately and undisclosed sizes kept separate. Best values are calculated within the displayed subset. Random remains as a reference row. Model metadata was checked against public model cards and API metadata through 2026-10-31; API access is not treated as evidence of closed-source status.

## Rebuild the page without changing results

```sh
python3 scripts/build_page.py
```

This packages the existing checked `data/benchmark.json` and current assets into one offline HTML. Use this for design and copy edits so newly running source evaluations do not alter the public snapshot. Overall metrics, category results, Hard Multi-select diagnostics, and calibration bins share the comparison snapshot recorded in provenance. Existing model metrics are preserved. Adding GPT-6 Luna Decisions updates the shared calibration cohort to the intersection with its eligible native predictions; all-eligible curves for existing models are unchanged.

## Add a verified supplemental run

GPT-6 Luna Decisions is pinned in `data/supplemental/gpt6-luna-decisions.json`, with its completed summary, independent verification, source hashes, and calibration bins computed from saved predictions. It is a closed-source native Decisions API model with undisclosed size. All 5,448 tasks were processed: 54 hard-label refusals count as incorrect, and four soft-label refusals are excluded from Soft Brier. The existing grouped evaluator handles 94 inputs above the API option cap. No evaluation is rerun when building this page.

```sh
python3 scripts/supplemental_results.py
```

This merges only the configured supplemental snapshots into the checked website data and rebuilds the page. It is idempotent. The full report exporter also merges these snapshots, so later updates retain Luna. Shared-cohort calibration uses 2,081 Hard Single-select and 192 Soft examples for every displayed model. Luna's all-eligible calibration uses 3,949 and 693 examples respectively. Existing overall/category scores and all-eligible curves remain unchanged.

`scripts/prepare_decisions_snapshot.py` prepares the snapshot from a verified run directory, the frozen baseline report and its calibration cache, and the matching dataset. It verifies artifact hashes and reproduces the old cohort bins before computing the extended cohort. Pass each hidden model with `--exclude-model` to omit its cached curve from the public artifact. Import refuses a mismatched dataset or calibration cohort rather than mix snapshots.

## Rebuild from updated reports

```sh
python3 scripts/export_v2.py \
  --source-root /Users/shamkwanho/Documents/Code_Project/omni-openjev
```

This reads `docs/reports/mmdm-v2-baselines-20261020/comparison.json`, the current `docs/reports/mmdm/` release metadata, and `benchmarks/mmdm-v2/mmdm.jsonl`. It checks the shared dataset SHA, category/label/option counts, and completed-run identity before writing `data/benchmark.json`, `data/provenance.json`, and `index.html`. Add display metadata for newly introduced model IDs before rebuilding; regeneration then includes their completed summaries. Existing exported source snapshots should be preserved if reproducibility across report updates is required.

Edit the source files, then rebuild:

- `templates/index.html`: page structure and prose
- `assets/style.css`: responsive layout
- `assets/app.js`: chart selection, leaderboard, and examples
- `assets/chart-hover.js`: shared immediate tooltips, pointer/focus/touch handling, and accessible readouts
- `assets/analysis-charts.js`: geometry transitions, Hard Multi-select diagnostics, and Pareto frontier
- `scripts/build_page.py`: standalone HTML packaging from the existing snapshot
- `scripts/export_v2.py`: checked data transformation and standalone packaging
- `config/model-display.json`: model visibility, public release metadata and parameter sizes
- `assets/mmdm-logo.png`: supplied original transparent logo
- `assets/institutions/`: vector CUHK and HKUST (Guangzhou) emblems rendered from the supplied PDFs, plus the unmodified supplied LIGHTSPEED image. All three are embedded before the footer text.

`index.html` is generated. `scripts/export_data.py` delegates to the current v2 exporter.

## Validation

Browser validation uses a copy of the single HTML file in an otherwise unrelated directory, in offline mode. It checks every category view, applicable metrics, all examples, chart controls, downloads, and 320/390/768/1440px layouts. A reference snapshot of the validation results is saved under `.preview/` (Git-ignored). The set/size update also checks all 58 Hard Multi-select metric points, 78 disclosed-size points across three metrics, Pareto ties and dominance, unknown-size references, empty selections, keyboard tabs, animation interpolation and cancellation, and reduced-motion behavior.

## GitHub Pages

Push this project to the Pages repository and set Settings → Pages → Deploy from a branch → main → /(root). The self-contained `index.html` also works unchanged on GitHub Pages. `.nojekyll` is included.

## Attribution

The page structure follows [MMMU](https://mmmu-benchmark.github.io/) and [MathVista](https://mathvista.github.io/). The interactive figures use MMDM's Morandi palette and data from the current release and baseline reports. Dataset sources retain their notices: [source notices](https://huggingface.co/datasets/shenjunhao/mmdm/blob/main/SOURCE_NOTICES.md).
