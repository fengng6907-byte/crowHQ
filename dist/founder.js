'use strict';
(async () => {
  const status = document.querySelector('#owner-status');
  try {
    const response = await fetch('/api/invitation?action=owner', { cache: 'no-store', credentials: 'same-origin' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'The founder desk could not be opened.');
    document.querySelector('#share-link').textContent = data.shareUrl;
    document.querySelector('#share-code').textContent = data.inviteCode;
    const copy = async (text, label) => { try { await navigator.clipboard.writeText(text); status.textContent = label; } catch { status.textContent = 'Select the text above to copy it.'; } };
    document.querySelector('#copy-link').onclick = () => copy(data.shareUrl, 'Site link copied.');
    document.querySelector('#copy-code').onclick = () => copy(data.inviteCode, 'Invitation code copied.');
    document.querySelector('#copy-invitation').onclick = () => copy(`Come lepak at Crow HQ!\n\nOpen: ${data.shareUrl}\nInvitation code: ${data.inviteCode}\n\nEnter the code to join my little Malaysian neighbourhood. No account needed.`, 'Invitation message copied. You can send it to your friend.');
    document.querySelector('#owner-content').classList.remove('hidden'); status.textContent = 'Your invitation is ready to share.';
  } catch (error) { status.textContent = error.message; }
})();
