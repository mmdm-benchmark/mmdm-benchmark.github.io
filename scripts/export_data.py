"""Export the paper's pinned results and real examples into the static website."""
import argparse, hashlib, json, shutil
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--paper-root', type=Path, required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
paper = args.paper_root
read = lambda name: json.loads((paper / name).read_text())
snapshot = 'data/experiments/20261012/'
comparison = read(snapshot + 'comparison.json')
sources = read(snapshot + 'model-sources.json')
analysis = read(snapshot + 'analysis.json')
stats = read('data/release/computed-stats.json')
selected = read('data/examples/selected.json')
responses = {r['row_index']: r for r in read('data/examples/responses.json')['rows']}
labels = {
 'knowledge_qa':'Knowledge QA', 'commonsense_context':'Commonsense & context',
 'reading_comprehension':'Reading comprehension', 'deductive_reasoning':'Deductive reasoning',
 'option_logic':'Option dependencies', 'constraint_planning':'Constraint planning',
 'quantitative_reasoning':'Quantitative reasoning', 'temporal_numeric':'Temporal & numeric rules',
 'multi_hop':'Multi-hop reasoning', 'policy_exception':'Policies & exceptions',
 'evidence_validation':'Evidence validation', 'code_database':'Code & databases',
 'intent_routing':'Intent & tool routing', 'answer_preference':'Answer preference',
 'score_rubric':'Score & rubrics', 'emotion_recognition':'Emotion recognition',
 'probabilistic_reasoning':'Probabilistic reasoning'}
# Preserve the exact palette from the paper, keyed by category.
import ast
style = ast.parse((paper/'scripts/plot_style.py').read_text())
category_colors = next(ast.literal_eval(n.value) for n in style.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='CATEGORY_COLORS' for t in n.targets))
models = []
for mid in analysis['ranked_models']:
 m = comparison['models'][mid]
 models.append({'id':mid,'name':sources[mid]['label'],'url':sources[mid]['url'],
   'hard_accuracy':m['metrics']['hard']['accuracy']*100,
   'hard_brier':m['common_valid_metrics']['hard']['brier'],
   'soft_brier':m['common_valid_metrics']['soft']['brier'],
   'valid':m['metrics']['all']['valid'],
   'category':{k:{'n':v['n'],'valid':v['valid'],'accuracy':v['accuracy'],'brier':v['brier']} for k,v in m['metrics'].items() if '/' in k}})
random = comparison['models']['random-uniform']
examples = []
for e in selected['examples']:
 r = e['record']; response = responses[e['row_index']]
 assert r['state'] == response['input']['state']
 assert r['options'] == response['input']['options']
 assert r['answer']['probabilities'] == response['input']['gold']
 q = r['answer']['probabilities']
 assert len(q)==len(r['options']) and abs(sum(q)-1)<1e-5
 predictions = {}
 for mid,p in response['predictions'].items():
  if p['ok']:
   assert len(p['probabilities'])==len(q) and abs(sum(p['probabilities'])-1)<1e-4
   predictions[mid] = p['probabilities']
 examples.append({'row_index':e['row_index'],'row_sha256':e['row_sha256'],**r,'predictions':predictions})
assert len(models)==19 and len(set(e['category'] for e in examples))==17
assert sum(sum(v.values()) for v in stats['category_counts'].values())==4961
categories = [{'id':k,'name':labels[k],'color':category_colors[k],'hard':v.get('hard',0),'soft':v.get('soft',0),'total':sum(v.values())} for k,v in stats['category_counts'].items()]
categories.sort(key=lambda c:-c['total'])
output = {'benchmark':'MMDM','snapshot_date':'2026-10-12','dataset':'https://huggingface.co/datasets/shenjunhao/mmdm',
 'revision':selected['revision'],'total':4961,'hard':4351,'soft':610,'score':165,
 'common_hard':4014,'common_soft':558,'models':models,'categories':categories,
 'option_counts':read('data/release/option-counts.json')['counts'],
 'highlighted_models':analysis['highlighted_models'], 'examples':examples,
 'random_accuracy':random['metrics']['hard']['accuracy']*100}
(root/'data').mkdir(exist_ok=True)
(root/'assets').mkdir(exist_ok=True)
(root/'data/benchmark.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'))+'\n')
for name in ['capability-radar']:
 shutil.copy2(paper/f'figures/{name}.png',root/f'assets/{name}.png')
files = [snapshot+'comparison.json',snapshot+'model-sources.json','data/examples/selected.json','data/examples/responses.json','data/release/computed-stats.json','data/release/option-counts.json','figures/capability-radar.png']
(root/'data/provenance.json').write_text(json.dumps({'release_revision':selected['revision'],'snapshot_date':'2026-10-12','sources':{f:hashlib.sha256((paper/f).read_bytes()).hexdigest() for f in files}},indent=2)+'\n')
print(f'Exported {len(models)} models, {len(categories)} categories, {len(examples)} authentic examples.')
