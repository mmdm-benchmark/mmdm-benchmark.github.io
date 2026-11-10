"""Export a verified Decisions run and extend a pinned calibration cohort."""
import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path

def read(path):
    return json.loads(Path(path).read_text())

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def id_hash(ids):
    return hashlib.sha256(('\n'.join(sorted(ids)) + '\n').encode()).hexdigest()

def aggregate(points, ids):
    ids = sorted(ids)
    bins = [[] for _ in range(10)]
    for rid in ids:
        c, t = points[rid]
        bins[min(9, int(c * 10))].append((c, t))
    values = []
    for i, bucket in enumerate(bins):
        n = len(bucket)
        c = math.fsum(x[0] for x in bucket) / n if n else None
        t = math.fsum(x[1] for x in bucket) / n if n else None
        values.append(dict(index=i, n=n, confidence=c, target=t,
                           gap=c-t if n else None, low_count=0 < n < 20))
    return dict(n=len(ids), ids_sha256=id_hash(ids), bins=values,
                ece=math.fsum(b['n'] * abs(b['gap']) for b in values if b['n']) / len(ids) if ids else None)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('run-root', 'baseline-report', 'dataset', 'output'):
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--model-id', default='gpt6-luna')
    parser.add_argument('--name', default='GPT-6 Luna Decisions')
    parser.add_argument('--exclude-model', action='append', default=[])
    args = parser.parse_args()
    root = args.run_root
    manifest = read(root / 'manifest.json')
    for name in ('summary.json', 'identity.json', 'verification.json', 'predictions.jsonl'):
        assert sha(root / name) == manifest['files'][name], name
    summary = read(root / 'summary.json')
    identity = read(root / 'identity.json')
    verification = read(root / 'verification.json')
    assert verification['passed'] and verification['all_category_metrics_recomputed']
    assert verification['raw_probabilities_checked'] and verification['gold_fields_excluded']
    assert identity['dataset_sha256'] == summary['identity']['dataset_sha256'] == sha(args.dataset)
    assert summary['processed'] == summary['planned'] and not summary['pending']
    dataset = {r['id']: r for r in map(json.loads, args.dataset.open())}
    predictions = [json.loads(s) for s in (root / 'predictions.jsonl').open()]
    assert len(predictions) == len(dataset) == summary['processed']
    assert len({p['id'] for p in predictions}) == len(predictions)
    points = dict(hard={}, soft={})
    exclusions = Counter()
    for rec in predictions:
        row = dataset[rec['id']]
        kind = 'soft' if row['supervision_kind'] == 'soft' else 'hard_set' if row['label_semantics'] == 'set_hard' else 'hard'
        if kind == 'hard_set':
            exclusions['hard_set'] += 1
            continue
        if not rec['ok']:
            exclusions['invalid_output'] += 1
            continue
        if rec['mode'] != 'native':
            exclusions['grouped_probabilities'] += 1
            continue
        p, q = rec['probabilities'], row['gold']
        assert len(p) == len(q) and all(math.isfinite(v) and 0 <= v <= 1 for v in p)
        mass = math.fsum(p)
        assert mass > 0 and abs(mass-1) <= .020000001
        p = [v/mass for v in p]
        peak = max(p)
        winners = [i for i, v in enumerate(p) if abs(v-peak) <= 1e-12]
        if len(winners) != 1:
            exclusions['tied_maximum'] += 1
            continue
        points[kind][rec['id']] = [peak, q[winners[0]]]
        exclusions['eligible'] += 1
    report = read(args.baseline_report)
    assert report['dataset_sha256'] == identity['dataset_sha256']
    members = report['calibration']['members']
    cache_root = args.baseline_report.parent / 'cache'
    caches = {key: read(cache_root / (key + '.json'))['points'] for key in members}
    calibration = {}
    for kind, view in report['calibration']['views'].items():
        common = set.intersection(*(set(caches[key][kind]) for key in members))
        assert id_hash(common) == view['ids_sha256'] and len(common) == view['common_n']
        updated = common & set(points[kind])
        models = {}
        for key in members:
            # Verify the cached native predictions really reproduce the frozen bins.
            old = aggregate(caches[key][kind], common)
            recorded = view['models'][key]['common']
            assert old['n'] == recorded['n'] and old['ids_sha256'] == recorded['ids_sha256']
            for x, y in zip(old['bins'], recorded['bins']):
                assert x['n'] == y['n']
                if x['n']:
                    assert abs(x['confidence']-y['confidence']) < 1e-12
                    assert abs(x['target']-y['target']) < 1e-12
            if key not in args.exclude_model:
                models[key] = aggregate(caches[key][kind], updated)
        calibration[kind] = dict(
            base_common_n=view['common_n'], base_ids_sha256=view['ids_sha256'],
            common_n=len(updated), ids_sha256=id_hash(updated),
            removed_from_common=len(common-updated), existing_common=models,
            existing_all_sha256={key: hashlib.sha256(json.dumps(view['models'][key]['all'], sort_keys=True, separators=(',', ':')).encode()).hexdigest() for key in models},
            model=dict(common=aggregate(points[kind], updated),
                       all=aggregate(points[kind], points[kind])))
    snapshot = dict(
        schema_version=1, id=args.model_id, name=args.name, color='#B07835',
        completed_at=manifest['completed_at'], dataset_sha256=identity['dataset_sha256'],
        identity=identity, summary=summary,
        verification={k:v for k,v in verification.items() if k != 'api_refusal_ids'},
        source_sha256={k:manifest['files'][k] for k in ('summary.json', 'identity.json', 'verification.json', 'predictions.jsonl')},
        calibration_method=report['calibration']['method'],
        calibration_exclusions=dict(exclusions), calibration=calibration)
    args.output.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(dict(output=str(args.output), bytes=args.output.stat().st_size,
        views={k:{field:v[field] for field in ('base_common_n','common_n','removed_from_common')} | {'all_n':v['model']['all']['n']} for k,v in calibration.items()})))

if __name__ == '__main__':
    main()
