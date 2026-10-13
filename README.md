# MMDM project website

A lightweight, buildless project page for **MMDM: Measuring Massive Multitask Decision Making**. No author list is shown in this draft.

## Local preview

From the repository root:

```sh
python3 -m http.server 50813 --bind 127.0.0.1
```

Open http://127.0.0.1:50813. Use an HTTP server instead of opening `index.html` as a file, since interactive views load JSON with `fetch`.

## Contents

- `index.html`: project narrative, resources and section structure
- `assets/style.css`: responsive layout and restrained Morandi colors
- `assets/app.js`: sortable/filterable results, distributions, real example explorer
- `data/benchmark.json`: 19 configurations, 17 categories, 19 selected examples and recorded model outputs
- `data/provenance.json`: exact source hashes and pinned dataset revision
- `scripts/export_data.py`: reproducible export from the manuscript's pinned data

All assets are served locally. No framework, package install, analytics, account, or inference service is required. Source text and sample criteria are rendered as text. The explorer uses complete source records, including the long multi-hop example; expanding the context reveals the original text.

## Result definitions

The 12 October 2026 paper snapshot contains 4,961 examples: 4,351 hard and 610 soft. Overall Hard Accuracy includes invalid and unsupported hard requests as incorrect. Overall Brier uses the common valid cohort (4,014 hard, 558 soft). Category Brier is computed on each model's own valid outputs, with counts shown. No macro-accuracy is displayed. Predictions in the example explorer are recorded outputs, not live calls.

The public test combines the former 1,100 development and 3,861 test examples, as documented in the paper. These development roles should be considered when interpreting OpenJev results.

Re-export after updating the pinned manuscript inputs:

```sh
python3 scripts/export_data.py --paper-root /path/to/mmdm-composition
```

## GitHub Pages

The intended repository is `mmdm-benchmark/mmdm-benchmark.github.io`, producing `https://mmdm-benchmark.github.io/` when Pages is enabled. For publishing, push this static root and configure Settings → Pages → Deploy from a branch → main → /(root). `.nojekyll` preserves the static files. This draft has been prepared for local review; publication is a separate step.

## References and attribution

Original website implementation. Project-page organization is inspired by [MMMU](https://mmmu-benchmark.github.io/) and [MathVista](https://mathvista.github.io/); no reference-site code or images are copied. Figures, examples and baseline results are exported from the MMDM manuscript artifacts. Source datasets retain their notices: [MMDM source notices](https://huggingface.co/datasets/shenjunhao/mmdm/blob/main/SOURCE_NOTICES.md).
