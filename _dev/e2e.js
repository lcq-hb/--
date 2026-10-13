// 生成端到端交互测试页（仅本地验证用）
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// 1) 主脚本之前：固定时钟 + 清空存储
const PRE = `
<script>
(function(){
  var T0 = new Date(2026, 5, 17, 10, 0, 0).getTime();  // 2026-06-17 周三 10:00
  window.__CLOCK = T0;
  window.__T0 = T0;
  Date.now = function(){ return window.__CLOCK; };
  try{ localStorage.removeItem('focus-tracker/v1'); }catch(e){}
})();
</script>
`;

// 2) 主脚本之后：驱动 UI 并断言
const POST = `
<script>
(function(){
  var R = [], failed = 0, idx = 0, steps = [];
  var KEY = 'focus-tracker/v1';
  var MIN = 60000;
  function ok(name, cond, extra){
    if(!cond) failed++;
    R.push((cond?'PASS':'FAIL') + ' | ' + name + (extra!==undefined ? (' | ' + extra) : ''));
  }
  function S(){ try{ return JSON.parse(localStorage.getItem(KEY)||'null'); }catch(e){ return null; } }
  function q(s){ return document.querySelector(s); }
  function qa(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function click(el){ el.dispatchEvent(new MouseEvent('click',{bubbles:true})); }
  function mins(ms){ return Math.round(ms/MIN); }
  function flat(el){ return (el?el.textContent:'').replace(/\\s+/g,' ').trim(); }
  function step(fn, wait){ steps.push([fn, wait||30]); }
  function run(){
    if(idx >= steps.length){
      var pre = document.createElement('pre');
      pre.id='RESULTS';
      pre.textContent = '\\n<<<E2E>>>\\n' + R.join('\\n') + '\\nTOTAL=' + R.length + ' FAILED=' + failed + '\\n<<<END>>>\\n';
      document.body.appendChild(pre);
      return;
    }
    var cur = steps[idx++];
    try{ cur[0](); }catch(e){ ok('步骤 '+(idx-1)+' 抛异常', false, e.name+': '+e.message); }
    setTimeout(run, cur[1]);
  }
  window.confirm = function(){ return true; };

  /* ---------- 1. 初始状态 ---------- */
  step(function(){
    var st = S();
    ok('初始无任何记录', st && st.sessions.length===0, 'sessions='+(st?st.sessions.length:'null'));
    ok('默认 4 个科目', st && st.subjects.length===4, st?st.subjects.length:0);
    ok('按钮文案 = 开始专注', flat(q('#mainBtn'))==='开始专注', flat(q('#mainBtn')));
    ok('空状态文案可见', flat(q('#todayList')).indexOf('还没有记录')>=0);
    ok('标签页在「今日」', q('#view-today').hidden===false && q('#view-trend').hidden===true);
  });

  /* ---------- 2. 开始计时 ---------- */
  step(function(){
    click(q('#mainBtn'));
    var st = S();
    ok('点击开始 → 1 条未结束记录', st.sessions.length===1 && st.sessions[0].end===null, JSON.stringify(st.sessions));
    ok('按钮变成 结束专注', flat(q('#mainBtn'))==='结束专注', flat(q('#mainBtn')));
    ok('状态显示正在专注', flat(q('#statusText')).indexOf('正在专注')>=0, flat(q('#statusText')));
    ok('计时器从 00:00:00 起', /^00:00:0\\d$/.test(flat(q('#timerText'))), flat(q('#timerText')));
    ok('标签页标题带 ▶', document.title.indexOf('▶')===0, document.title);
  });

  /* ---------- 3. 30 分钟后结束 ---------- */
  step(function(){
    window.__CLOCK = window.__T0 + 30*MIN;
    click(q('#mainBtn'));
    var st = S();
    ok('结束 → 记录已闭合', st.sessions.length===1 && st.sessions[0].end!==null, JSON.stringify(st.sessions));
    ok('这段时长 = 30 分钟', mins(st.sessions[0].end - st.sessions[0].start)===30, mins(st.sessions[0].end-st.sessions[0].start));
    ok('「今日专注」= 30 分钟', flat(q('#todayStats')).indexOf('30 分钟')>=0, flat(q('#todayStats')).slice(0,60));
    ok('时间轴出现 1 段', qa('#timeline .seg').length===1, qa('#timeline .seg').length);
    ok('今日记录 1 行', qa('#todayList .row').length===1, qa('#todayList .row').length);
    ok('图例列出科目', flat(q('#legend')).indexOf('数学')>=0, flat(q('#legend')));
  });

  /* ---------- 4. 短于 10 秒应被丢弃 ---------- */
  step(function(){
    window.__CLOCK = window.__T0 + 40*MIN;
    click(q('#mainBtn'));
    window.__CLOCK += 4000;
    click(q('#mainBtn'));
    var st = S();
    ok('4 秒的记录被丢弃', st.sessions.length===1, 'sessions='+st.sessions.length);
    ok('丢弃后无未结束记录', st.sessions.every(function(s){return s.end!==null;}));
  });

  /* ---------- 5. 计时中切换科目 → 自动切开 ---------- */
  step(function(){
    window.__CLOCK = window.__T0 + 60*MIN;              // 11:00
    click(q('#mainBtn'));
    window.__CLOCK = window.__T0 + 70*MIN;              // 11:10
    var chip = q('#chips .chip[data-sid="s_eng"]');
    ok('找得到英语标签', !!chip);
    click(chip);
    var st = S();
    ok('切换后共 3 条记录', st.sessions.length===3, 'sessions='+st.sessions.length);
    ok('前一段被切开且闭合', st.sessions[1].end!==null && mins(st.sessions[1].end-st.sessions[1].start)===10,
       JSON.stringify(st.sessions[1]));
    ok('新起一段仍是 英语 未结束', st.sessions[2].subjectId==='s_eng' && st.sessions[2].end===null,
       JSON.stringify(st.sessions[2]));
    // renderChips 会重建 DOM，必须重新查询
    var chip2 = q('#chips .chip[data-sid="s_eng"]');
    ok('英语标签已选中', chip2 && chip2.getAttribute('aria-pressed')==='true',
       chip2 ? chip2.getAttribute('aria-pressed') : 'gone');
    ok('数学标签已取消选中', q('#chips .chip[data-sid="s_math"]').getAttribute('aria-pressed')==='false');
  });

  /* ---------- 6. 结束英语 ---------- */
  step(function(){
    window.__CLOCK = window.__T0 + 80*MIN;              // 11:20
    click(q('#mainBtn'));
    var st = S();
    ok('共 3 段全部闭合', st.sessions.length===3 && st.sessions.every(function(s){return s.end!==null;}));
    var total = st.sessions.reduce(function(a,s){ return a + (s.end-s.start); }, 0);
    ok('今日总计 = 50 分钟', mins(total)===50, mins(total));
    ok('「今日专注」显示 50 分钟', flat(q('#todayStats')).indexOf('50 分钟')>=0, flat(q('#todayStats')).slice(0,60));
    ok('时间轴 3 段', qa('#timeline .seg').length===3, qa('#timeline .seg').length);
    ok('今日记录 3 行', qa('#todayList .row').length===3, qa('#todayList .row').length);
  });

  /* ---------- 7. 编辑时间 ---------- */
  step(function(){
    var id = S().sessions[0].id;
    click(q('[data-act="edit"][data-id="'+id+'"]'));
    var row = q('.editrow');
    ok('出现编辑行', !!row);
    row.querySelector('[data-f=start]').value = '09:00';
    row.querySelector('[data-f=end]').value   = '09:45';
    click(row.querySelector('[data-act=save]'));
    var s = S().sessions.filter(function(x){return x.id===id;})[0];
    ok('改后时长 = 45 分钟', mins(s.end-s.start)===45, mins(s.end-s.start));
    ok('编辑行已关闭', !q('.editrow'));
  });

  /* ---------- 8. 编辑成跨午夜 ---------- */
  step(function(){
    var id = S().sessions[1].id;
    click(q('[data-act="edit"][data-id="'+id+'"]'));
    var row = q('.editrow');
    row.querySelector('[data-f=start]').value = '23:30';
    row.querySelector('[data-f=end]').value   = '01:00';
    click(row.querySelector('[data-act=save]'));
    var s = S().sessions.filter(function(x){return x.id===id;})[0];
    ok('跨午夜时长 = 90 分钟', mins(s.end-s.start)===90, mins(s.end-s.start));
    // 23:30–24:00 归 6/17（30 分），00:00–01:00 归 6/18（60 分）
    // 今日（6/17）= 45 + 30 + 10 = 85 分钟 → 显示为「1 小时 25 分」
    var stats = flat(q('#todayStats'));
    ok('6/17 总计 = 85 分钟（跨午夜只算当天那半段）',
       stats.indexOf('1 小时 25 分')>=0, stats.slice(0,60));
    // 本周（周一起）= 85 + 60 = 145 分钟 → 独立印证午夜后的 60 分钟被算进了 6/18
    ok('本周累计 = 145 分钟（含 6/18 的 60 分钟）',
       stats.indexOf('2 小时 25 分')>=0, stats.slice(0,80));
  });

  /* ---------- 9. 删除一段 ---------- */
  step(function(){
    var before = S().sessions.length;
    var id = S().sessions[2].id;
    click(q('[data-act="del"][data-id="'+id+'"]'));
    ok('删除后少一条', S().sessions.length===before-1, before+' → '+S().sessions.length);
    ok('无法再找到该条', !q('[data-act="del"][data-id="'+id+'"]'));
  });

  /* ---------- 10. 空格快捷键 ---------- */
  step(function(){
    var before = S().sessions.length;
    document.body.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));
    ok('空格开始了一段新计时', S().sessions.length===before+1 && S().sessions[S().sessions.length-1].end===null,
       'sessions='+S().sessions.length);
  });

  /* ---------- 11. 趋势视图 ---------- */
  step(function(){
    click(q('.tabs button[data-view="trend"]'));
    ok('切到趋势视图', q('#view-trend').hidden===false && q('#view-today').hidden===true);
    ok('日视图画出了折线', qa('#trendMain svg path.mainline').length===1, qa('#trendMain svg path.mainline').length);
    ok('日视图有 14 个数据点', qa('#trendMain svg .hit').length===14, qa('#trendMain svg .hit').length);
    ok('科目分布有内容', flat(q('#trendLong')).indexOf('数学')>=0, flat(q('#trendLong')).slice(0,50));
    click(q('#trendMode button[data-mode="week"]'));
    ok('周视图出现导航', q('#trendNav').hidden===false);
    ok('周视图 7 根柱子', qa('#trendMain svg rect.bar').length>=1 && qa('#trendMain svg .hit').length===7,
       qa('#trendMain svg .hit').length);
    click(q('#navPrev'));
    ok('可以翻到上一周', flat(q('#navLabel')).length>5, flat(q('#navLabel')));
    click(q('#trendMode button[data-mode="month"]'));
    ok('月视图渲染日历', qa('#trendMain .cal .cell').length>=28, qa('#trendMain .cal .cell').length);
    ok('12 个月曲线有 12 点', qa('#trendLong svg .hit').length===12, qa('#trendLong svg .hit').length);
  });

  /* ---------- 12. 设置：改科目名 / 删除科目 ---------- */
  step(function(){
    click(q('.tabs button[data-view="settings"]'));
    ok('切到设置视图', q('#view-settings').hidden===false);
    var nameInput = q('#subjectList .srow[data-sid="s_math"] input[data-f=name]');
    nameInput.value = '高数';
    nameInput.dispatchEvent(new Event('change',{bubbles:true}));
    ok('改名生效', q('#chips .chip[data-sid="s_math"]').textContent.trim()==='高数',
       q('#chips .chip[data-sid="s_math"]').textContent.trim());

    var n = S().sessions.filter(function(s){return s.subjectId==='s_eng';}).length;
    ok('删除前英语有记录', n>0, n);
    click(q('[data-act="delsub"][data-id="s_eng"]'));
    var st = S();
    ok('科目已删除', !st.subjects.some(function(s){return s.id==='s_eng';}));
    ok('原英语记录归入未分类', st.sessions.filter(function(s){return s.subjectId===null;}).length===n, n);
    ok('标签栏不再有英语', !q('#chips .chip[data-sid="s_eng"]'));
  });

  /* ---------- 13. 新增科目 ---------- */
  step(function(){
    q('#newSubject').value = '线性代数';
    click(q('#addSubject'));
    ok('新增科目成功', S().subjects.some(function(s){return s.name==='线性代数';}));
    ok('新科目出现在标签栏', flat(q('#chips')).indexOf('线性代数')>=0);
    ok('输入框已清空', q('#newSubject').value==='');
  });

  /* ---------- 14. 长时间未结束 → 自动弹出提醒 ---------- */
  step(function(){
    ok('提醒尚未出现', !q('#bannerHost .banner.warn'));
    window.__CLOCK += 9*3600000;                 // 模拟忘了停，页面一直开着
  }, 1400);
  step(function(){
    var b = q('#bannerHost .banner.warn');
    ok('计时超过 8 小时后自动弹出提醒', !!b, b ? flat(b).slice(0,50) : 'no banner');
    if(b){
      click(b.querySelector('[data-b="stopnow"]'));
      var last = S().sessions[S().sessions.length-1];
      ok('「现在结束」把这段闭合', last.end!==null);
      ok('结束后提醒消失', !q('#bannerHost .banner.warn'));
    }
  });

  setTimeout(run, 150);
})();
</script>
`;

let out = html.replace('<script>\n(function(){', PRE + '<script>\n(function(){');
if (out === html) { console.error('注入点未找到'); process.exit(1); }
out = out.replace('</body>', POST + '</body>');
fs.writeFileSync(path.join(__dirname, 'e2e.html'), out, 'utf8');
console.log('wrote e2e.html');
