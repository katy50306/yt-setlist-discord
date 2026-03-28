export const CHANNELS_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>yt-setlist-discord — 頻道管理</title>
<style>
  body{font-family:sans-serif;max-width:650px;margin:40px auto;padding:0 20px}
  h1{font-size:1.3em} h2{font-size:1.1em;margin-top:24px}
  ul{list-style:none;padding:0}
  li{padding:8px 0;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center}
  button{cursor:pointer;padding:6px 14px} .rm{background:none;border:none;color:#c00;font-size:1.2em;padding:0}
  textarea{width:100%;font-family:monospace;font-size:0.85em;margin-top:8px;box-sizing:border-box;padding:8px}
  .input-area{height:80px} .export-area{height:100px}
  .empty{color:#999}
  .msg{margin-top:8px;padding:8px;border-radius:4px}
  .msg.ok{background:#e8f5e9;color:#2e7d32}
  .msg.err{background:#fce4ec;color:#c62828}
  .count{color:#666;font-size:0.9em}
</style>
</head><body>
<h1>📺 頻道管理</h1>

<h2>➕ 新增頻道</h2>
<textarea id="input" class="input-area" placeholder="輸入 @handle 或 YouTube URL&#10;支援：每行一個、逗號分隔、JSON 陣列"></textarea>
<button onclick="add()">新增</button>
<div id="msg"></div>

<h2>📋 匯出</h2>
<textarea id="export" class="export-area" readonly></textarea>
<button onclick="copyExport()">複製</button>

<h2>📺 頻道列表 <span id="count" class="count"></span></h2>
<ul id="list"><li class="empty">載入中...</li></ul>

<script>
const token=new URLSearchParams(location.search).get('token');
const api=(q='',opt)=>fetch('/api/channels?token='+token+q,opt).then(r=>r.json());
function render(channels){
  const ul=document.getElementById('list');
  document.getElementById('count').textContent=channels.length?'('+channels.length+')':'';
  if(!channels.length){ul.innerHTML='<li class="empty">尚未設定頻道</li>';document.getElementById('export').value='';return}
  ul.innerHTML=channels.map(ch=>'<li><span>'+(ch.name||ch.id)+'</span><button class="rm" onclick="rm(\\''+ch.id+'\\')">✕</button></li>').join('');
  document.getElementById('export').value=JSON.stringify(channels,null,2);
}
function msg(t,ok){const e=document.getElementById('msg');e.className='msg '+(ok?'ok':'err');e.textContent=t;setTimeout(()=>e.textContent='',3000)}
async function load(){render((await api()).channels)}
async function add(){
  const v=document.getElementById('input').value.trim();if(!v)return;
  try{
    const r=await fetch('/api/channels?token='+token,{method:'POST',headers:{'Content-Type':'text/plain'},body:v});
    const d=await r.json();render(d.channels);document.getElementById('input').value='';msg('已新增',true)
  }catch(e){msg('新增失敗: '+e.message,false)}
}
async function rm(id){
  try{const r=await api('&remove='+encodeURIComponent(id));render(r.channels);msg('已移除',true)}
  catch(e){msg('移除失敗: '+e.message,false)}
}
function copyExport(){document.getElementById('export').select();document.execCommand('copy');msg('已複製',true)}
load();
</script>
</body></html>`
