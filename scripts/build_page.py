"""Package the checked website snapshot and assets without refreshing evaluations."""
import argparse
import base64
import hashlib
import json
from pathlib import Path


def build_page(out):
    data = json.loads((out / 'data/benchmark.json').read_text())
    sbf = json.loads((out / 'data/multiselect-sbf.json').read_text())
    assert sbf['dataset_sha256'] == data['dataset_sha256']
    for model in data['models']:
        diagnostics = model.get('set_diagnostics')
        if diagnostics is None:
            continue
        result = sbf['models'][model['id']]
        fingerprint = hashlib.sha256(json.dumps(diagnostics, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        assert fingerprint == result['diagnostics_sha256'], 'Refresh SB-F for the updated model run'
        assert result['n'] == diagnostics['native_balance']['n'] and 0 <= result['mean'] <= 1
        diagnostics['sbf'] = dict(n=result['n'], mean=result['mean'])
    page = (out / 'templates/index.html').read_text()
    replacements = {
        '@@DATA@@': json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c'),
        '@@CSS@@': (out / 'assets/style.css').read_text(),
        '@@HOVERJS@@': (out / 'assets/chart-hover.js').read_text(),
        '@@CHARTJS@@': (out / 'assets/analysis-charts.js').read_text(),
        '@@JS@@': (out / 'assets/app.js').read_text(),
    }
    for token, name, mime in [
        ('@@LOGO@@', 'mmdm-logo.png', 'image/png'),
        ('@@CUHK@@', 'institutions/cuhk.svg', 'image/svg+xml'),
        ('@@HKUST@@', 'institutions/hkustgz.svg', 'image/svg+xml'),
        ('@@LIGHTSPEED@@', 'institutions/lightspeed.jpg', 'image/jpeg'),
    ]:
        replacements[token] = 'data:' + mime + ';base64,' + base64.b64encode((out / 'assets' / name).read_bytes()).decode()
    for token, value in replacements.items():
        page = page.replace(token, value)
    assert '@@' not in page
    (out / 'index.html').write_text(page)
    return len(page.encode())


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-root', type=Path, default=Path(__file__).resolve().parents[1])
    print(json.dumps({'html_bytes': build_page(parser.parse_args().output_root)}))
