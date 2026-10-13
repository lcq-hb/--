// 生成带种子数据的测试页（仅用于本地验证，不属于交付物）
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const SEED = `
<script>
(function(){
  const now = Date.now(), D = 86400000;
  const sod = ts => { const d=new Date(ts); d.setHours(0,0,0,0); return d.getTime(); };
  const subs = [
    {id:'s_math', name:'数学',   color:'#3b7dd8'},
    {id:'s_eng',  name:'英语',   color:'#2f9e78'},
    {id:'s_major',name:'专业课', color:'#e08a2b'},
    {id:'s_read', name:'阅读',   color:'#9b5de5'}
  ];
  let sd = 20240611;
  const rnd = () => { sd = (sd*1103515245 + 12345) & 0x7fffffff; return sd/0x7fffffff; };
  const sessions = [];
  for(let i=1;i<=96;i++){
    const base = sod(now - i*D);
    const dow = new Date(base).getDay();
    const weekend = (dow===0 || dow===6);
    let n = weekend ? (rnd()<0.5?1:0) : Math.floor(rnd()*3.3);
    let cursor = base + (8 + Math.floor(rnd()*3))*3600000;
    for(let j=0;j<n;j++){
      const dur = (25 + Math.floor(rnd()*80))*60000;
      const gap = (10 + Math.floor(rnd()*70))*60000;
      const st = cursor, en = st + dur;
      if(en >= sod(now)) break;
      sessions.push({id:'x'+i+'_'+j, subjectId: subs[Math.floor(rnd()*subs.length)].id, start: st, end: en});
      cursor = en + gap;
      if(cursor > base + 23*3600000) break;
    }
  }
  // 一段跨午夜的记录
  const two = sod(now - 2*D);
  sessions.push({id:'mid', subjectId:'s_major', start: two + 23*3600000 + 1800000, end: two + 24*3600000 + 45*60000});
  // 今天：若干已完成 + 一段进行中
  const today = sod(now);
  let cursor = Math.max(today + 8*3600000, now - 5*3600000);
  for(const t of [{sid:'s_math',dur:62},{sid:'s_eng',dur:48},{sid:'s_major',dur:35}]){
    const st = cursor, en = st + t.dur*60000;
    if(en > now - 26*60000) break;
    sessions.push({id:'td'+st, subjectId:t.sid, start:st, end:en});
    cursor = en + 22*60000;
  }
  sessions.push({id:'run', subjectId:'s_math', start: now - 17*60000, end: null});
  sessions.sort((a,b)=>a.start-b.start);
  localStorage.setItem('focus-tracker/v1', JSON.stringify({
    version:1, subjects:subs, sessions:sessions,
    ui:{ subjectId:'s_math', view:'__VIEW__', trendMode:'__MODE__' }
  }));
})();
</script>
`;

const cases = [
  ['today',     'today',    'day'],
  ['trend-day', 'trend',    'day'],
  ['trend-week','trend',    'week'],
  ['trend-month','trend',   'month'],
  ['settings',  'settings', 'day']
];

fs.mkdirSync(__dirname, { recursive: true });
for (const [name, view, mode] of cases) {
  const seed = SEED.replace('__VIEW__', view).replace('__MODE__', mode);
  const out = html.replace('<script>\n(function(){', seed + '<script>\n(function(){');
  if (out === html) { console.error('注入点未找到！'); process.exit(1); }
  fs.writeFileSync(path.join(__dirname, name + '.html'), out, 'utf8');
  console.log('wrote', name + '.html');
}
