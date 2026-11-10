"""Merge verified supplemental runs into the website's frozen result snapshot."""
import argparse
import hashlib
import json
import math
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def metrics(summary):
    return dict(single=summary['hard_single']['accuracy_all'],
                set=summary['hard_set']['accuracy_all'], soft=summary['soft_brier']['mean'],
                single_n=summary['hard_single']['rows'], set_n=summary['hard_set']['rows'],
                soft_n=summary['soft_brier']['n'])


def check_bins(stats):
    bins = stats['bins']
    assert len(bins) == 10 and sum(b['n'] for b in bins) == stats['n']
    assert [b['index'] for b in bins] == list(range(10))
    for b in bins:
        if b['n']:
            assert 0 <= b['confidence'] <= 1 and 0 <= b['target'] <= 1
            assert abs(b['gap'] - (b['confidence'] - b['target'])) < 1e-12
        else:
            assert b['confidence'] is None and b['target'] is None
    if stats['n']:
        ece = math.fsum(b['n'] * abs(b['gap']) for b in bins if b['n']) / stats['n']
        assert abs(ece - stats['ece']) < 1e-12


def merge_supplements(data, root, policy):
    paths = policy.get('supplemental_results', [])
    for relative in paths:
        path = root / relative
        extra = json.loads(path.read_text())
        key = extra['id']
        if key in policy['hidden_model_ids']:
            continue
        summary = extra['summary']
        assert extra['schema_version'] == 1
        assert extra['verification']['passed']
        assert extra['dataset_sha256'] == summary['identity']['dataset_sha256'] == data['dataset_sha256']
        assert summary['processed'] == summary['planned'] == data['total'] and summary['pending'] == 0
        overall = metrics(summary['overall'])
        assert (overall['single_n'], overall['set_n']) == (data['single'], data['set'])
        category_metrics = {}
        for category in data['categories']:
            c = category_metrics[category['id']] = metrics(summary['categories'][category['id']])
            assert c['single_n'] == category['single'] and c['set_n'] == category['set']
            assert 0 <= c['soft_n'] <= category['soft']
        other = [v for k, v in category_metrics.items() if k != 'score_rubric' and v['soft'] is not None]
        n = sum(v['soft_n'] for v in other)
        score = category_metrics['score_rubric']
        model = dict(id=key, name=extra['name'], url=policy['models'][key]['source'],
                     metadata=policy['models'][key], color=extra['color'], review=False,
                     metrics=overall, categories=category_metrics,
                     set_diagnostics=dict(exact=summary['overall']['hard_set'],
                                          native_balance=summary['overall']['native_set_balance']),
                     scatter=dict(all=dict(value=overall['soft'], n=overall['soft_n']),
                                  score=dict(value=score['soft'], n=score['soft_n']),
                                  other=dict(value=math.fsum(v['soft']*v['soft_n'] for v in other)/n if n else None, n=n)))
        existing = next((i for i, m in enumerate(data['models']) if m['id'] == key), None)
        if existing is None:
            data['models'].append(model)
        else:
            data['models'][existing] = model
        data['pending'] = [p for p in data['pending'] if p['id'] != key]
        for mode, supplement in extra['calibration'].items():
            view = data['calibration']['views'][mode]
            # Reject stale calibration rather than combine different cohorts.
            assert view['ids_sha256'] in (supplement['base_ids_sha256'], supplement['ids_sha256'])
            for model_id in list(view['models']):
                if model_id == key:
                    continue
                all_sha = hashlib.sha256(json.dumps(view['models'][model_id]['all'], sort_keys=True, separators=(',', ':')).encode()).hexdigest()
                assert all_sha == supplement['existing_all_sha256'][model_id], 'Baseline calibration changed; prepare a new supplemental snapshot'
                stats = supplement['existing_common'][model_id]
                check_bins(stats)
                assert stats['ids_sha256'] == supplement['ids_sha256']
                assert stats['n'] == supplement['common_n']
                view['models'][model_id]['common'] = stats
            for stats in supplement['model'].values():
                check_bins(stats)
            assert supplement['model']['common']['n'] == supplement['common_n']
            assert supplement['model']['common']['ids_sha256'] == supplement['ids_sha256']
            view['models'][key] = supplement['model']
            view['common_n'] = supplement['common_n']
            view['ids_sha256'] = supplement['ids_sha256']
        data['provenance'].setdefault('supplemental_results', {})[key] = dict(
            path=relative, sha256=sha(path), completed_at=extra['completed_at'],
            model=extra['identity']['model'], endpoint=extra['identity']['endpoint'],
            protocol=extra['identity']['protocol'], source_sha256=extra['source_sha256'],
            verification_passed=True)
    if paths:
        provenance = data['provenance']
        timestamps = [provenance['snapshot_at'], policy['results_updated_at']]
        timestamps += [s['completed_at'] for s in provenance.get('supplemental_results', {}).values()]
        stamp = max(map(datetime.fromisoformat, timestamps)).astimezone(ZoneInfo('Asia/Hong_Kong'))
        provenance['snapshot_at'] = stamp.isoformat()
        provenance['display_policy_sha256'] = sha(root / 'config/model-display.json')
        provenance['model_metadata_checked_at'] = policy['checked_at']
        data['snapshot_date'] = stamp.strftime('%B %d, %Y')
        data['snapshot_time'] = stamp.strftime('%Y-%m-%d %H:%M CST')
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-root', type=Path, default=Path(__file__).resolve().parents[1])
    root = parser.parse_args().output_root
    data = json.loads((root / 'data/benchmark.json').read_text())
    policy = json.loads((root / 'config/model-display.json').read_text())
    merge_supplements(data, root, policy)
    (root / 'data/benchmark.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    (root / 'data/provenance.json').write_text(json.dumps(data['provenance'], indent=2) + '\n')
    from build_page import build_page
    print(json.dumps(dict(models=len(data['models']), snapshot=data['snapshot_time'], html_bytes=build_page(root))))


if __name__ == '__main__':
    main()
