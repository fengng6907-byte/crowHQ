'use strict';
(() => {
  const restricted = new Set(['chat', 'tasks', 'approvals', 'notes']);
  const leave = async () => {
    try { await fetch('/api/invitation', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'leave' }) }); }
    finally { location.assign('/join.html'); }
  };
  async function identify() {
    try {
      const response = await fetch('/api/invitation', { cache: 'no-store', credentials: 'same-origin' });
      const data = await response.json();
      if (!response.ok || !['founder', 'guest'].includes(data.role)) { location.replace('/join.html'); return; }
      document.body.dataset.access = data.role;
      document.body.classList.toggle('guest-view', data.role !== 'founder');
      const controls = document.createElement('div'); controls.className = 'visit-controls';
      const role = document.createElement('span'); role.textContent = data.role === 'founder' ? 'FOUNDER WORKSPACE' : 'INVITED GUEST'; controls.append(role);
      if (data.role === 'founder') {
        const link = document.createElement('a'); link.href = '/founder.html'; link.textContent = 'Invitation desk ↗'; controls.append(link);
      } else {
        const button = document.createElement('button'); button.textContent = 'Leave'; button.onclick = leave; controls.append(button);
        if (restricted.has(view)) showView('office');
        window.CrowGuestViewGuard = name => restricted.has(name);
        headings.office[1] = 'A little world. <span>Good company.</span>'; headings.office[2] = 'Welcome to Crow Quarter. Take a walk, find a table, and make yourself at home.'; const title = $('#page-title'); title.innerHTML = headings.office[1];
        $('#page-desc').textContent = 'Welcome to Crow Quarter. Take a walk, find a table, and make yourself at home.';
        $('#owner-profile').classList.add('hidden');
      }
      $('.header-right').prepend(controls);
      const badge = $('.local-badge'); if (badge) badge.classList.add('hidden');
    } catch {
      // A failed identity check never reveals founder controls.
      document.body.classList.add('guest-view');
      if (restricted.has(view)) showView('office');
      toast('Your visit could not be checked. Please refresh or re-enter your invitation code.');
    }
  }
  identify();
})();
