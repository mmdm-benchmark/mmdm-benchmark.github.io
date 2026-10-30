"""Build an offline, self-contained MMDM page from the pinned v2 reports."""
import argparse, hashlib, json, math
from build_page import build_page
from collections import Counter
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

LABELS = {
 'agent_state_tracking':('Agent state tracking','Agent state|tracking','#B5AD93'),
 'answer_preference':('Answer preference','Answer|preference','#B2A5B2'),
 'code_database':('Code & databases','Code &|databases','#9BA8BA'),
 'constraint_planning':('Constraint planning','Constraint|planning','#8FA7A2'),
 'deductive_reasoning':('Deductive reasoning','Deductive|reasoning','#899C91'),
 'emotion_recognition':('Emotion recognition','Emotion','#AAA891'),
 'evidence_validation':('Evidence validation','Evidence|validation','#A1A79E'),
 'intent_routing':('Intent routing','Intent|routing','#B59C8F'),
 'option_logic':('Option logic','Option|logic','#A6AF97'),
 'policy_exception':('Policies & exceptions','Policies &|exceptions','#ADA28F'),
 'quantitative_temporal_reasoning':('Quantitative & temporal reasoning','Quantitative &|temporal','#9C9AAF'),
 'reading_comprehension':('Reading comprehension','Reading','#B7A2A5'),
 'score_rubric':('Score & rubrics','Score &|rubrics','#9AAFB2'),
 'tool_skill_selection':('Tool & skill selection','Tool & skill|selection','#94A7B0'),
 'workflow_decision':('Workflow decision','Workflow|decision','#AD959E'),
 'world_knowledge':('World knowledge','World|knowledge','#8E9EAC'),
}
ORDER=['world_knowledge','reading_comprehension','deductive_reasoning','option_logic','constraint_planning','quantitative_temporal_reasoning','workflow_decision','agent_state_tracking','policy_exception','evidence_validation','code_database','intent_routing','tool_skill_selection','answer_preference','score_rubric','emotion_recognition']
COLORS={'jev':'#4C6A85','microsoft':'#B27460','openjev':'#507C68','intern':'#887498','semif':'#B19A56','tiny':'#8A5D70','27b':'#77856A','pplx':'#5C9896','h2o':'#A27A73','clef':'#898BB1'}
# Keep source-report names, with the requested short public name for Jev.
NAMES={'jev':'Jev 1.14.0'}
URLS={
 'liquid':'https://openrouter.ai/liquid/d1','liquid-ultra':'https://openrouter.ai/liquid/d1-ultra',
 'clef-omni':'https://openrouter.ai/cloudflare/clef-omni','clef-flash':'https://openrouter.ai/cloudflare/clef-flash',
 'pplx12':'https://openrouter.ai/perplexity/pplx-decider-v1.2','pplx-flash12':'https://openrouter.ai/perplexity/pplx-decider-flash-v1.2',
 'jev':'https://typesafe.ai/', 'microsoft':'https://commandline.microsoft.com/microsoft-decision-1-model-foundry/',
 'openjev':'https://huggingface.co/shenjunhao/OpenJev-4B', 'intern':'https://huggingface.co/internlm/Intern-Decision-4B',
 'intern2':'https://huggingface.co/internlm/Intern-Decision-2B','intern08':'https://huggingface.co/internlm/Intern-Decision-0.8B',
 'semif':'https://github.com/TheoLeeCJ/SemIf-OpenJev','clef':'https://huggingface.co/Cloudflare/clef',
 'pplx':'https://huggingface.co/perplexity-ai/pplx-decider-v1-27b','h2o':'https://huggingface.co/h2oai/h2o-lightning-4b',
 'nano':'https://huggingface.co/C-Tianyu/NanoJev','quyet':'https://huggingface.co/chinhnc/Quyet-1.0-Large',
 'decisio12':'https://huggingface.co/google/gemma-4-12B-it','decisio31':'https://huggingface.co/google/gemma-4-31B-it',
 'decisioqwen':'https://huggingface.co/Qwen/Qwen3.6-35B-A3B-FP8','diffusion':'https://huggingface.co/google/diffusiongemma-26B-A4B-it',
 'strands':'https://huggingface.co/StrandsAgents/strands-decider-2B-qwen3.5-v1-2610',
 'jevk5':'https://huggingface.co/alibiserikbay/JevK5','autotrust':'https://huggingface.co/autotrust/JEV-27B-VL','decider':'https://huggingface.co/Mapika/decider-4b'}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def kind(r):
 if r['supervision_kind']=='soft':return 'soft'
 return 'hard_set' if r['label_semantics']=='set_hard' else 'hard_single'
def metrics(o):
 return {'single':o['hard_single']['accuracy_all'],'set':o['hard_set']['accuracy_all'],'soft':o['soft_brier']['mean'],
         'single_n':o['hard_single']['rows'],'set_n':o['hard_set']['rows'],'soft_n':o['soft_brier']['n']}
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--source-root',type=Path,required=True);ap.add_argument('--output-root',type=Path,default=Path(__file__).resolve().parents[1]);args=ap.parse_args()
 src=args.source_root;out=args.output_root
 policy_path=out/'config/model-display.json';policy=json.loads(policy_path.read_text());hidden=set(policy['hidden_model_ids'])
 files={'comparison':src/'docs/reports/mmdm-v2-baselines-20261020/comparison.json','summary':src/'docs/reports/mmdm/summary.json','current':src/'docs/reports/mmdm/CURRENT.json','validation':src/'docs/reports/mmdm/release-validation.json','dataset':src/'benchmarks/mmdm-v2/mmdm.jsonl'}
 raw={k:p.read_bytes() for k,p in files.items()};comp=json.loads(raw['comparison']);summary=json.loads(raw['summary']);current=json.loads(raw['current']);validation=json.loads(raw['validation'])
 assert comp['dataset_sha256']==summary['dataset_sha256']==current['dataset_sha256']==hashlib.sha256(raw['dataset']).hexdigest()
 assert validation['status']=='passed'
 rows=[json.loads(line) for line in raw['dataset'].splitlines()];total=len(rows);assert total==comp['rows']==summary['distribution']['rows']
 counts=Counter(kind(r) for r in rows);assert all(counts[k]==comp[k] for k in counts)
 categories=[]
 for k in ORDER:
  d=summary['categories'][k]['distribution'];n=Counter(kind(r) for r in rows if r['category']==k)
  assert all(n[x]==d[x] for x in counts)
  name,short,color=LABELS[k]
  categories.append(dict(id=k,name=name,short=short,color=color,total=d['rows'],single=d['hard_single'],set=d['hard_set'],soft=d['soft'],score=d['score'],subcategories=d['subcategories']))
 assert sum(c['total'] for c in categories)==total
 models=[];pending=[]
 for i,m in enumerate(comp['models']):
  if m['key'] in hidden:continue
  s=m.get('summary')
  if not s or s['processed']!=total:
   pending.append(dict(id=m['key'],name=m['name'],processed=m['processed'],status=m['status']['state']));continue
  metadata=policy['models'][m['key']]
  assert s['identity']['dataset_sha256']==comp['dataset_sha256']
  cm={k:metrics(s['categories'][k]) for k in ORDER}
  for k in ORDER:
   assert cm[k]['single_n']==summary['categories'][k]['distribution']['hard_single']
   assert cm[k]['set_n']==summary['categories'][k]['distribution']['hard_set']
  other=[v for k,v in cm.items() if k!='score_rubric' and v['soft'] is not None]
  n=sum(v['soft_n'] for v in other)
  models.append(dict(id=m['key'],name=NAMES.get(m['key'],m['name']),url=metadata.get('source') or URLS.get(m['key']),metadata=metadata,color=COLORS.get(m['key'],['#6D8A99','#9E8772','#9A7185','#7D8E78','#8D91A3'][i%5]),
   review=m.get('verification')=='needs_review',metrics=metrics(s['overall']),categories=cm,
   set_diagnostics={'exact':s['overall']['hard_set'],'native_balance':s['overall']['native_set_balance']},
   scatter={'all':{'value':s['overall']['soft_brier']['mean'],'n':s['overall']['soft_brier']['n']},'score':{'value':cm['score_rubric']['soft'],'n':cm['score_rubric']['soft_n']},'other':{'value':sum(v['soft']*v['soft_n'] for v in other)/n if n else None,'n':n}}))
 options=Counter(len(r['options']) for r in rows);assert {str(k):v for k,v in options.items()}==summary['distribution']['option_counts']
 examples=[]
 for cat in categories:
  pool=[r for r in rows if r['category']==cat['id']]
  for label in ['hard_single','hard_set','soft']:
   choices=[r for r in pool if kind(r)==label and len(r['options'])<=16]
   if not choices:continue
   # Pick a readable, unmodified record close to a useful context length.
   desired=1800 if cat['id']=='reading_comprehension' else 550
   r=min(choices,key=lambda r:abs(r['lengths']['visible_task_tokens']-desired))
   assert len(r['gold'])==len(r['options']) and abs(sum(r['gold'])-1)<1e-5
   examples.append({k:r[k] for k in ['id','category','state','question','options','gold','correct_option_ids','score_values','source','task_subcategory','lengths','label_semantics','task']}|{'kind':label})
 stamp=datetime.fromtimestamp(comp['updated'],ZoneInfo('Asia/Shanghai'))
 provenance={'version':'mmdm-v2','dataset_sha256':comp['dataset_sha256'],'snapshot_at':stamp.isoformat(),'sources':{str(p.relative_to(src)):hashlib.sha256(raw[k]).hexdigest() for k,p in files.items()},'metrics':{'hard':'accuracy_all; failed requests count as incorrect','hard_set':'Top-N exact set match, N = gold set size','soft':'per-model native valid full-distribution Brier; no hard Brier or soft accuracy'},'representative_models':policy['representative_models'],'model_metadata_checked_at':policy['checked_at'],'display_policy_sha256':sha(policy_path),'examples':'Unmodified input and gold from the current 5,448-row release. No historical model response is attached.'}
 # Preserve the source report's fixed cohorts. Plot selection never recomputes them.
 calibration={'method':comp['calibration']['method'],'excluded':comp['calibration']['excluded'],'views':{}}
 visible={m['id'] for m in models}
 for mode,view in comp['calibration']['views'].items():
  selected={key:value for key,value in view['models'].items() if key in visible and key!='random'}
  for key,value in selected.items():
   for population in ['common','all']:
    stats=value[population];bins=stats['bins']
    assert len(bins)==10 and sum(b['n'] for b in bins)==stats['n']
    if population=='common':assert stats['n']==view['common_n'] and stats['ids_sha256']==view['ids_sha256']
    if stats['n']:
     expected=sum(b['n']*abs(b['confidence']-b['target']) for b in bins if b['n'])/stats['n']
     assert abs(expected-stats['ece'])<1e-10
  calibration['views'][mode]={'common_n':view['common_n'],'ids_sha256':view['ids_sha256'],'models':selected}
 assert all(key in visible for key in policy['representative_models'])
 data={'version':'mmdm-v2','total':total,'single':counts['hard_single'],'set':counts['hard_set'],'soft':counts['soft'],'score':comp['score'],'score_single':sum(c['single'] for c in categories if c['id']=='score_rubric'),'score_soft':sum(c['soft'] for c in categories if c['id']=='score_rubric'),
  'sources':len(summary['distribution']['sources']),'subcategories':len({(r['category'],r['task_subcategory']) for r in rows}),'parents':validation['independent_parents'],
  'snapshot_date':stamp.strftime('%B %d, %Y'),'snapshot_time':stamp.strftime('%Y-%m-%d %H:%M CST'),'dataset_sha256':comp['dataset_sha256'],
  'categories':categories,'models':models,'pending':pending,'calibration':calibration,'length_profile':summary['length_profile'],'option_counts':[{'options':k,'total':options[k]} for k in sorted(options)],'examples':examples,'provenance':provenance}
 # The distributions and figures are generated from the same exported data as the table.
 (out/'data').mkdir(exist_ok=True)
 (out/'data/benchmark.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 (out/'data/provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
 html_bytes=build_page(out)
 print(json.dumps({'rows':total,'categories':len(categories),'models_with_results':len(models),'pending':len(pending),'examples':len(examples),'dataset_sha256':comp['dataset_sha256'],'html_bytes':html_bytes},indent=2))
if __name__=='__main__':main()
