# Merges a Google Keyword Planner paste into docs/seo/keywords-2026-09-27.csv
# (phrase, monthly_searches, low_cpc_sek, high_cpc_sek). Existing rows win,
# new phrases are appended, the file is re-sorted by volume.
#   python3 docs/seo/kwp-merge.py paste.txt [more.txt ...]
import re, csv, sys
import os
CSV=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'keywords-2026-09-27.csv')
def is_value(l):
    l=l.strip()
    return l=='' or l=='—' or l in ('Låg','Medel','Hög') or l.endswith('%') or l.endswith('kr') or l.startswith('+∞') or bool(re.fullmatch(r'[\d ]+',l))
rows={}
for r in csv.DictReader(open(CSV)):
    rows[r['phrase']]=(r['phrase'],int(r['monthly_searches']),r['low_cpc_sek'],r['high_cpc_sek'])
added=0
for path in sys.argv[1:]:
    recs=[];cur=None
    for l in open(path).read().split('\n'):
        if l.strip() in ('Sökord som du har angett','Sökordsförslag'): continue
        if not is_value(l): cur={'p':l.strip(),'v':[]}; recs.append(cur)
        elif cur and l.strip(): cur['v'].append(l.strip())
    for r in recs:
        v=r['v']; vol=v[0] if v else '—'
        vol=int(vol.replace(' ','')) if re.fullmatch(r'[\d ]+',vol) else 0
        kr=[x.replace(' kr','').replace(',','.') for x in v if x.endswith('kr')]
        if r['p'] in rows: continue
        rows[r['p']]=(r['p'],vol,kr[0] if kr else '0',kr[1] if len(kr)>1 else '0'); added+=1
out=sorted(rows.values(), key=lambda x:(-x[1],x[0]))
with open(CSV,'w',newline='') as f:
    w=csv.writer(f); w.writerow(['phrase','monthly_searches','low_cpc_sek','high_cpc_sek']); w.writerows(out)
print(f'added {added}, total {len(out)}')
