'use strict';
(() => {
  const restricted = new Set(['founder', 'chat', 'tasks', 'approvals', 'notes']);
  window.CrowGuestViewGuard = name => !window.CrowAccess || window.CrowAccess.role !== 'founder' ? restricted.has(name) : false;
  const signOut = async () => {
    try { await window.CrowCommunity?.leave(); await fetch('/api/invitation', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'leave' }) }); }
    finally { location.assign('/join.html'); }
  };
  async function identify() {
    try {
      const response = await fetch('/api/invitation', { cache: 'no-store', credentials: 'same-origin' });
      const data = await response.json();
      if (!response.ok || !['founder', 'guest'].includes(data.role)) { location.replace('/join.html'); return; }
      window.CrowAccess = data;
      document.body.dataset.access = data.role;
      document.body.classList.toggle('guest-view', data.role !== 'founder');
      const controls = document.createElement('div'); controls.className = 'visit-controls';
      const role = document.createElement('span'); role.textContent = data.role === 'founder' ? 'BOBBY · FOUNDER' : 'GUEST · SIGN-IN REMEMBERED'; controls.append(role);
      if (data.role === 'founder') {
        const link = document.createElement('a'); link.href = '/founder.html'; link.textContent = 'Invite friends ↗'; controls.append(link);
        headings.office[1] = 'Your world. <span>Your people.</span>';
        headings.office[2] = 'Your founder character is Bobby. Settle in, meet your guests, or get back to the team.';
        $('#owner-profile').onclick = () => showView('founder');
        if (view === 'office') showView('founder');
      } else {
        const link = document.createElement('a'); link.href = '/api/invitation?action=founder-start'; link.textContent = 'I’m Bobby · Founder sign-in ↗'; link.onclick = async event => { event.preventDefault(); await window.CrowCommunity?.leave(); location.assign(link.href); }; controls.append(link);
        if (restricted.has(view)) showView('office');
        headings.office[1] = 'A little world. <span>Good company.</span>';
        headings.office[2] = 'Your visit is remembered on this browser. Settle in, close the tab when you’re done, and come back any time.';
        if(view === 'office') { $('#page-title').innerHTML = headings.office[1]; $('#page-desc').textContent = headings.office[2]; }
        $('#owner-profile').classList.add('hidden');
      }
      const button = document.createElement('button'); button.textContent = 'Sign out'; button.title = 'Sign out on this browser. Closing the tab keeps you signed in.'; button.onclick = signOut; controls.append(button);
      $('.header-right').prepend(controls);
      const badge = $('.local-badge'); if (badge) badge.classList.add('hidden');
      $$('[data-founder-open]').forEach(button => button.onclick = () => showView(button.dataset.founderOpen));
      $('#founder-find-me').onclick = () => window.CrowCommunity?.focus();
      window.dispatchEvent(new CustomEvent('crow-access-ready', { detail:data }));
    } catch {
      document.body.classList.add('guest-view');
      if (restricted.has(view)) showView('office');
      toast('Your visit could not be checked. Refresh to reconnect.');
    }
  }
  identify();
})();
