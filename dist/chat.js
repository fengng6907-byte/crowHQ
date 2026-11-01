'use strict';
(() => {
  const teamIds = ['jiayee', 'greentea', 'matthew'];
  const room = { messages: [], jobs: [], csrf: null, ready: false, busy: false, loading: false, locked: false, revision: -1, hasEarlier: false, pending: null, seenAt: 0, shownCompletions: new Set(), firstLoad: true, mode: 'live' };
  try { room.seenAt = Number(localStorage.getItem('crow-chat-seen-at') || 0); } catch {}
  let timer, lastMessageSignature = '';
  window.crowAiBusy = new Set();
  const id = () => 'crow_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12);
  const activeJob = () => room.jobs.find(j => ['queued', 'running'].includes(j.status));
  const time = value => new Date(value).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Singapore' });
  const day = value => new Date(value).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', timeZone: 'Asia/Singapore' });
  const markup = text => safe(text).replace(/\*\*([^*\n]{1,200})\*\*/g, '<strong>$1</strong>');

  function notice(message, retry = false) {
    const el = $('#chat-notice'); el.classList.toggle('hidden', !message); el.textContent = message || '';
    if (message && retry) { const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Reconnect'; button.onclick = () => refresh(); el.append(button); }
  }
  function connection(label, error = false) { $('#chat-connection').textContent = label; $('#chat-connection').classList.toggle('error', error); }
  function markRead() {
    if (view !== 'chat' || document.visibilityState === 'hidden') return;
    room.seenAt = Math.max(room.seenAt, ...room.messages.map(m => m.at));
    try { localStorage.setItem('crow-chat-seen-at', String(room.seenAt)); } catch {}
    unread();
  }
  function unread() {
    const count = room.messages.filter(m => m.who !== 'bobby' && m.at > room.seenAt).length;
    $('#chat-unread').textContent = Math.min(count, 99); $('#chat-unread').classList.toggle('hidden', count === 0);
  }
  function renderRoster() {
    const current = activeJob();
    $('#chat-roster').innerHTML = people.map(p => `<div class="chat-roster-person"><canvas class="avatar" data-person="${p.id}" width="40" height="40"></canvas><span><strong>${p.name}</strong><small>${p.id === 'bobby' ? 'Founder · final say' : current?.current === p.id ? 'Writing a reply…' : p.role}</small></span><span class="roster-state ${current?.current === p.id ? 'busy' : ''}"></span></div>`).join('');
    paintAvatars();
  }
  function renderMessages(force = false) {
    const signature = room.messages.map(m => m.id).join('|') + room.jobs.filter(j => j.status === 'failed').map(j => j.id).join('|');
    if (!force && signature === lastMessageSignature) return;
    lastMessageSignature = signature;
    const transcript = $('#chat-transcript'), nearBottom = transcript.scrollHeight - transcript.clientHeight - transcript.scrollTop < 90;
    $('#chat-messages').innerHTML = room.messages.map(m => {
      const p = person(m.who), system = !p;
      const job = room.jobs.find(j => j.id === m.jobId);
      const retry = m.kind === 'error' && job?.status === 'failed' ? `<button class="retry-chat" data-retry-job="${safe(job.id)}">Retry full run ↗</button>` : '';
      const taskLink = m.task ? `<button class="message-task-link" data-chat-task="${safe(m.task.id)}">Open task on your work board ↗</button>` : '';
      if (system) return `<article class="chat-message system ${m.kind === 'error' ? 'error' : ''}"><span class="system-mark">${m.kind === 'error' ? '!' : '◇'}</span><div><div class="message-meta"><strong>${m.kind === 'completion' ? 'FOUNDER REVIEW' : 'ROOM UPDATE'}</strong><time>${day(m.at)} · ${time(m.at)}</time></div><div class="message-body">${markup(m.text)}</div>${retry}${taskLink}</div></article>`;
      return `<article class="chat-message ${m.who === 'bobby' ? 'founder' : ''}"><canvas class="avatar" data-person="${m.who}" width="40" height="40"></canvas><div><div class="message-meta"><strong style="color:${p.color}">${p.name}</strong><span class="message-kind">${m.who === 'bobby' ? (m.kind === 'task' ? 'ASSIGNMENT' : 'FOUNDER') : m.kind === 'deliverable' ? 'TASK DRAFT' : 'AI REPLY'}</span><time>${day(m.at)} · ${time(m.at)}</time></div><div class="message-body">${markup(m.text)}</div>${taskLink}</div></article>`;
    }).join('');
    $('#chat-welcome').classList.toggle('hidden', room.messages.length > 0 || room.locked);
    $('#chat-earlier').classList.toggle('hidden', !room.hasEarlier);
    $$('[data-retry-job]').forEach(button => { button.onclick = () => retryJob(button.dataset.retryJob); });
    $$('[data-chat-task]').forEach(button => { button.onclick = () => { const task = state.tasks.find(t => t.id === button.dataset.chatTask); if (task) openTask(task.id); else toast('The task will appear after the next room refresh.'); }; });
    paintAvatars();
    if (nearBottom || room.firstLoad) transcript.scrollTop = transcript.scrollHeight;
  }
  function syncTasks() {
    if (!state.chatAppliedJobs || typeof state.chatAppliedJobs !== 'object') state.chatAppliedJobs = {};
    let changed = false;
    for (const job of [...room.jobs].sort((a, b) => a.createdAt - b.createdAt)) {
      if (job.kind !== 'task' || !job.task) continue;
      let task = state.tasks.find(t => t.id === job.task.id);
      if (!task) { task = { ...job.task, state: 'working' }; state.tasks.unshift(task); changed = true; }
      if (['queued', 'running'].includes(job.status) && task.state !== 'working') { task.state = 'working'; changed = true; }
      if (job.status === 'done' && !state.chatAppliedJobs[job.id]) {
        task.result = job.result; task.resultAt = job.updatedAt; task.state = 'review'; task.workJobId = job.id;
        state.chatAppliedJobs[job.id] = true; changed = true;
      }
      if (job.status === 'failed' && task.state === 'working' && !state.chatAppliedJobs[job.id]) { task.state = 'todo'; state.chatAppliedJobs[job.id] = true; changed = true; }
    }
    if (changed) { save(); render(); }
  }
  function updateRunning() {
    const job = activeJob();
    const oldBusy = window.crowAiBusy;
    window.crowAiBusy = new Set(job?.current ? [job.current] : []);
    for (const employee of window.crowAiBusy) if (!oldBusy.has(employee)) setMode(employee, 'work', true);
    updateStatus();
    const strip = $('#chat-job-strip'); strip.classList.toggle('hidden', !job);
    if (job) strip.innerHTML = `<span class="typing-square"></span>${job.current ? person(job.current).name + ' is writing' : 'The team is picking up your brief'}${job.kind === 'task' ? ' · task draft in progress' : ''}. You can keep exploring the neighbourhood.`;
    $('#chat-run-summary').innerHTML = job ? `<p class="rail-empty">${safe(job.task?.title || job.text.slice(0, 100))}</p>${job.responders.map(employee => `<div class="run-person"><span class="dot" style="background:${person(employee).color}"></span>${person(employee).name}<i>${job.completed.includes(employee) ? 'READY' : job.current === employee ? 'WRITING' : 'NEXT'}</i></div>`).join('')}` : '<p class="rail-empty">A little breathing room. No run in progress.</p>';
    $('#chat-send').disabled = !room.ready || room.busy || !!job;
    $('#chat-send').textContent = room.busy ? 'Sending…' : job ? 'Team is working…' : $('#chat-kind').value === 'task' ? 'Assign work ↗' : 'Send to team ↗';
    $$('[data-run-task]').forEach(button => { button.disabled = !!job || room.busy; });
    renderRoster();
  }
  function setLocked(data) {
    room.locked = true; room.ready = false; connection('PRIVATE ROOM');
    $('#chat-private').classList.remove('hidden'); $('#chat-transcript').classList.add('hidden'); $('#chat-form').classList.add('hidden'); $('#chat-job-strip').classList.add('hidden');
    const link = $('#chat-private-link');
    try { const url = new URL(data.privateUrl); if (url.protocol !== 'https:' || !url.hostname.endsWith('.vercel.app')) throw new Error(); link.href = url.href; link.classList.remove('hidden'); }
    catch { link.classList.add('hidden'); notice('The private deployment URL is unavailable. Please open the latest deployment from your Vercel project.'); }
    $('#chat-run-summary').innerHTML = '<p class="rail-empty">Open the private room to start an AI run.</p>'; renderRoster();
  }
  async function refresh({ earlier = false } = {}) {
    if (room.loading) return;
    room.loading = true;
    try {
      const before = earlier && room.messages.length ? '?before=' + Math.min(...room.messages.map(m => m.at)) : '';
      const response = await fetch('/api/team' + before, { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(18000) });
      let data; try { data = await response.json(); } catch { throw new Error('The room endpoint is unavailable. Open the deployed Crow HQ site or reconnect.'); }
      if (response.status === 403 && data.code === 'PRIVATE_ROOM_REQUIRED') { setLocked(data); return; }
      if (!response.ok) throw new Error(data.message || 'The room could not connect.');
      room.ready = true; room.locked = false; room.csrf = data.csrf; room.mode = data.mode;
      room.messages = [...new Map([...room.messages, ...data.messages].map(m => [m.id, m])).values()].sort((a, b) => a.at - b.at);
      room.jobs = data.jobs; room.revision = data.revision;
      if (earlier || room.firstLoad) room.hasEarlier = data.hasEarlier;
      connection(data.mode === 'test' ? 'LOCAL QA' : 'CONNECTED');
      notice(data.mode === 'test' ? 'Local QA mode. Replies below are test fixtures; no live AI request is made.' : null);
      $('#chat-private').classList.add('hidden'); $('#chat-transcript').classList.remove('hidden'); $('#chat-form').classList.remove('hidden');
      syncTasks(); renderMessages(); updateRunning();
      if (!room.firstLoad) for (const job of room.jobs) {
        if (job.status === 'done' && job.kind === 'task' && job.updatedAt > room.seenAt && !room.shownCompletions.has(job.id)) { room.shownCompletions.add(job.id); toast('A task draft is ready for your review.'); }
      }
      room.firstLoad = false; markRead(); unread();
    } catch (error) { connection('OFFLINE', true); notice(error.name === 'TimeoutError' ? 'The private room took too long to respond. Your draft is still here.' : error.message, true); }
    finally { room.loading = false; schedule(); }
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(() => { if (!room.locked && document.visibilityState !== 'hidden') refresh(); else schedule(); }, activeJob() ? 3500 : view === 'chat' ? 16000 : 60000); }
  async function submit(command) {
    if (room.locked) { showView('chat'); toast('Open the private team room to run AI work.'); return; }
    if (!room.ready) { showView('chat'); await refresh(); if (!room.ready) return; }
    if (room.busy || activeJob()) { toast('The team is finishing the current run. Your next draft is safe.'); return; }
    room.busy = true; updateRunning(); notice(null);
    command.workspace = state.tasks.slice(0, 12).map(t => ({ title: t.title, assignee: t.assignee, state: t.state, details: t.details.slice(0, 300) }));
    try {
      const response = await fetch('/api/team', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Crow-Csrf': room.csrf }, body: JSON.stringify(command), signal: AbortSignal.timeout(20000) });
      const data = await response.json();
      if (!response.ok) { if (data.code === 'PRIVATE_ROOM_REQUIRED') setLocked(data); throw new Error(data.message || 'The message was not sent.'); }
      room.pending = null; $('#chat-input').value = ''; saveDraft();
      room.jobs = [...room.jobs.filter(j => j.id !== data.job.id), data.job]; updateRunning();
      showView('chat'); await refresh();
    } catch (error) { room.pending = command; notice(error.name === 'TimeoutError' ? 'Sending timed out. The message may be processing. Reconnect before retrying; the same message ID prevents duplicate runs.' : error.message, true); }
    finally { room.busy = false; updateRunning(); schedule(); }
  }
  function saveDraft() { try { localStorage.setItem('crow-chat-draft', JSON.stringify({ text: $('#chat-input').value, target: $('#chat-target').value, kind: $('#chat-kind').value })); } catch {} }
  function openFor(target = 'team', text = '') { showView('chat'); $('#chat-target').value = teamIds.includes(target) ? target : 'team'; if (text) $('#chat-input').value = text; saveDraft(); $('#chat-input').focus(); if (!room.ready && !room.locked) refresh(); }
  function runTask(taskId) {
    const task = state.tasks.find(t => t.id === taskId); if (!task) return;
    showView('chat');
    if (room.locked) { toast('Open the private room, then run this task from its work board.'); return; }
    const target = teamIds.includes(task.assignee) ? task.assignee : 'team';
    $('#chat-target').value = target; $('#chat-kind').value = 'task';
    const text = `Please prepare a draft for founder review: ${task.title}\n\n${task.details}`.slice(0, 4000);
    $('#chat-input').value = text; saveDraft();
    submit({ requestId: id(), text, target, kind: 'task', task: { id: task.id, title: task.title, details: task.details, priority: task.priority, date: task.date } });
  }
  function retryJob(jobId) { const job = room.jobs.find(j => j.id === jobId); if (!job) return; submit({ requestId: id(), text: job.text, target: job.target, kind: job.kind, task: job.task }); }
  $('#chat-form').onsubmit = event => {
    event.preventDefault(); const text = $('#chat-input').value.trim(); if (!text) { $('#chat-input').focus(); return; }
    const target = $('#chat-target').value, kind = $('#chat-kind').value;
    const pending = room.pending?.text === text && room.pending?.target === target && room.pending?.kind === kind ? room.pending : { requestId: id(), text, target, kind };
    submit(pending);
  };
  $('#chat-input').onkeydown = event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); $('#chat-form').requestSubmit(); } };
  $('#chat-input').oninput = saveDraft; $('#chat-target').onchange = saveDraft; $('#chat-kind').onchange = () => { saveDraft(); updateRunning(); };
  $('#chat-earlier').onclick = () => refresh({ earlier: true });
  $$('[data-chat-prompt]').forEach(button => { button.onclick = () => openFor('team', button.dataset.chatPrompt); });
  $('#chat-export').onclick = () => {
    if (!room.ready) { toast('Connect to the private room before exporting.'); return; }
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), note: 'Loaded conversation history. Load earlier messages before exporting a longer history.', messages: room.messages }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'crow-hq-conversation-' + new Date().toISOString().slice(0, 10) + '.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  try { const draft = JSON.parse(localStorage.getItem('crow-chat-draft') || 'null'); if (draft && typeof draft.text === 'string') { $('#chat-input').value = draft.text.slice(0, 4000); $('#chat-target').value = ['team', ...teamIds].includes(draft.target) ? draft.target : 'team'; $('#chat-kind').value = draft.kind === 'task' ? 'task' : 'question'; } } catch {}
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { markRead(); if (!room.locked) refresh(); } });
  window.CrowChat = { openFor, runTask, refresh, onView: name => { if (name === 'chat') { markRead(); if (!room.ready && !room.locked) refresh(); } } };
  renderRoster(); refresh();
})();
