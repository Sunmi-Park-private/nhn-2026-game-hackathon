import json, math, random, itertools
from collections import Counter, deque
DIRS=[(1,0),(1,-1),(0,-1),(-1,0),(-1,1),(0,1)]
nb=lambda a:[(a[0]+d[0],a[1]+d[1]) for d in DIRS]
def dist(a,b):
    dq=a[0]-b[0]; dr=a[1]-b[1]; return (abs(dq)+abs(dq+dr)+abs(dr))//2
def ring(c,rad):
    out=[];h=(c[0]+DIRS[4][0]*rad,c[1]+DIRS[4][1]*rad)
    for i in range(6):
        for j in range(rad): out.append(h);h=(h[0]+DIRS[i][0],h[1]+DIRS[i][1])
    return out
COLS,ROWS,H=11,16,8
cell=lambda c,r:(c-math.floor(r/2),r)
colof=lambda a:a[0]+math.floor(a[1]/2)
inb=lambda a: 0<=a[1]<ROWS and 0<=colof(a)<COLS
MASS=[cell(c,r) for r in range(H) for c in range(COLS)]

def info(ctr):
    body=[ctr]+nb(ctr); per=ring(ctr,2)
    faces=[per[i:i+2] for i in range(0,12,2)]
    topi=min(range(6),key=lambda i: sum(p[1] for p in faces[i])/2)
    return {'center':ctr,'body':body,'per':per,'faces':faces,'topi':topi,
            'rule':[p for i,f in enumerate(faces) if i!=topi for p in f]}

CANDS=[(c,r) for r in range(2,H-2) for c in range(COLS)]
def valid(trip):
    ctrs=[cell(c,r) for c,r in trip]; I=[info(x) for x in ctrs]
    for a,b in itertools.combinations(ctrs,2):
        if dist(a,b)<4: return None
    bodies=[set(x['body']) for x in I]
    if len(set().union(*bodies))!=sum(len(b) for b in bodies): return None
    for i,a in enumerate(I):
        for j,b in enumerate(I):
            if i==j: continue
            for p in b['rule']:
                if not inb(p): continue
                for bp in a['body']:
                    if colof(bp)==colof(p) and bp[1]<p[1]: return None
    oob=sum(1 for x in I for p in x['rule'] if not inb(p))
    rules=set(p for x in I for p in x['rule'] if inb(p))
    rows=len(set(r for c,r in trip))
    return {'trip':trip,'I':I,'oob':oob,'cells':len(rules),'rows':rows}

def best(n, scattered=True):
    out=[]
    for t in itertools.combinations(CANDS,n):
        v=valid(t)
        if v and (not scattered or n==1 or v['rows']>1): out.append(v)
    # 흩어짐 우선 → 보드 밖 최소 → 규칙칸 적은 순(작업량)
    out.sort(key=lambda v:(-v['rows'], v['oob'], v['cells']))
    return out[0]

def comps(a):
    seen=set(); out=[]
    for x in a:
        if x in seen: continue
        q=deque([x]); comp=[]; seen.add(x)
        while q:
            cur=q.popleft(); comp.append(cur)
            for n in nb(cur):
                if n in a and n not in seen and a[n]==a[cur]: seen.add(n); q.append(n)
        out.append(comp)
    return out

def gen(k, tpl, want, tries=9000, skew=0.0):
    RU=sorted(set(p for x in tpl['I'] for p in x['rule'] if inb(p)))
    bodies=set(p for x in tpl['I'] for p in x['body'])
    FREE=[x for x in MASS if x not in bodies]
    bestv=None
    for s in range(tries):
        rnd=random.Random(s*997+k*37+len(tpl['I'])*11)
        a={x:rnd.randrange(k) for x in FREE}
        pairs=sum(1 for i,p in enumerate(RU) for j in range(i+1,len(RU))
                  if RU[j] in nb(p) and a[RU[j]]==a[p])
        big=max(len(c) for c in comps(a))
        cnt=Counter(a[p] for p in RU)
        tot=sum(cnt.values()); top=max(cnt.values())/tot if tot else 0
        sc=abs(pairs-want)*10+max(0,big-6)*3+(0 if len(cnt)==k else 25)
        if skew>0: sc+=max(0.0,skew-top)*120
        if sc==0: return s,a,pairs,big,cnt,RU
        if bestv is None or sc<bestv[0]: bestv=(sc,s,a,pairs,big,cnt,RU)
    return bestv[1],bestv[2],bestv[3],bestv[4],bestv[5],bestv[6]

def weights(cnt,k,matched):
    tot=sum(cnt.values()); p=[cnt.get(c,0)/tot for c in range(k)]
    w=[max(x,1e-6) for x in p] if matched else [1.0/(x+0.15) for x in p]
    s=sum(w); w=[x/s for x in w]; w=[max(x,0.08) for x in w]; s=sum(w); w=[x/s for x in w]
    pres=[c for c in range(k) if p[c]>0]
    return p,w,sum(p[c]/w[c] for c in pres)/len(pres)

ANIM=[('rabbit','토끼'),('monkey','원숭이'),('deer','사슴'),
      ('sheep','양'),('zebra','얼룩말'),('elephant','코끼리')]
# 판 = (창살수, 목표, 색수, 맞춤, 목표여유율, 샷 예산)
PLAN=[(1,1,1,3,True ,1.90,20),
      (2,1,1,3,False,1.70,25),
      (3,2,2,4,True ,1.50,32),
      (4,2,2,4,False,1.30,38),
      (5,3,2,5,True ,1.45,42),
      (6,3,3,4,False,1.05,48)]
TPL={n:best(n) for n in (1,2,3)}
# 판별 창살 자리 예외. 1판(토끼)만 덩어리 바닥 중앙으로 내려 첫 발부터 둘레에 닿게 한다.
# 나머지 판은 템플릿 기본 자리를 쓴다 — 한 판의 난이도 조정을 다른 판에 옮기지 않는다.
PLACE={
  1: valid(((5,H-3),)),          # 토끼 — 바닥 중앙. 첫 발부터 둘레에 닿는다
  3: valid(((6,4),(2,5))),       # 사슴 — 열은 4판과 같고 행만 내렸다. 접근이 빠르다
}
stages=[]
for num,ncage,obj,k,matched,target,budget in PLAN:
    tpl=PLACE.get(num) or TPL[ncage]
    RU=sorted(set(p for x in tpl['I'] for p in x['rule'] if inb(p)))
    cells=len(RU)
    # 색 계수는 가중 확정 전이라 근사로 2패스: 1차 생성 → idx 확정 → 필요 2연결 재계산
    want=max(1,min(cells//2, round(cells*0.25)))
    for _ in range(3):
        seed,a,pairs,big,cnt,_=gen(k,tpl,want,skew=0.0 if matched else 0.42)
        p,w,idx=weights(cnt,k,matched)
        factor=(k/3.0)*idx*target
        need=(2*cells-budget/factor)/3.0
        want=max(1,min(cells//2,int(round(need))))
    est_s=2*cells-3*pairs
    est=est_s*(k/3.0)*idx
    shots=int(round(est*target))
    aid,aname=ANIM[num-1]
    grid=[{'q':x[0],'r':x[1],'kind':'tile','tier':t} for x,t in a.items()]
    grid+=[{'q':x[0],'r':x[1],'kind':'cage','tier':None} for x in tpl['I'] for x in x['body']] if False else \
          [{'q':bp[0],'r':bp[1],'kind':'cage','tier':None} for x in tpl['I'] for bp in x['body']]
    cages=[]
    for ci,x in enumerate(tpl['I']):
        pl=[]
        rl=x['rule']
        for i,pp in enumerate(rl):
            for j in range(i+1,len(rl)):
                n=rl[j]
                if n in nb(pp) and inb(n) and inb(pp) and a.get(n)==a.get(pp) and a.get(n) is not None:
                    pl.append([list(pp),list(n),a[pp]])
        free=sum(1 for j,f in enumerate(x['faces']) if j!=x['topi'] and all(not inb(q) for q in f))
        cages.append({'id':'c%d'%(ci+1),'animal':aid,'animalName':aname,
            'center':list(x['center']),'perimeter':[list(q) for q in x['per']],
            'topFace':[list(q) for q in x['faces'][x['topi']]],'pairs':pl,
            'freeFaces':free,'filled':sum(1 for q in x['rule'] if inb(q)),
            'isolated':0,'est':0,
            'cells':[{'q':q[0],'r':q[1],'tier':a.get(q),'kind':'tile' if inb(q) else 'oob',
                      'outside':0,'paired':False} for q in x['rule']]})
    stages.append({'id':'stage-%02d'%num,'num':num,'cols':COLS,'rows':ROWS,'H':H,
        'objective':obj,'cageCount':ncage,'animal':aid,'animalName':aname,'shots':shots,
        'budget':budget,'k':k,'matched':matched,'seed':seed,'colors':list(range(k)),
        'weights':[round(x,4) for x in w],'wPct':[int(round(x*100)) for x in w],
        'pPct':[int(round(x*100)) for x in p],'idx':round(idx,3),
        'estStatic':est_s,'est':round(est,1),'target':target,'ruleCells':cells,
        'pairs':pairs,'iso':max(0,cells-2*pairs),'biggest':big,
        'centers':[list(x['center']) for x in tpl['I']],
        'rowsUsed':tpl['rows'],'oob':tpl['oob'],
        'inv':{'S1':True,'S2':True,'S3':True,'S4':True,'S5':True},
        'grid':grid,'cages':cages,'tileCount':len(a)})
print(json.dumps({'stages':stages,'names':['빨강','노랑','초록','파랑','보라','황금']},ensure_ascii=False))
