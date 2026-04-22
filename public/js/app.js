(function bootstrap() {
  const tzField = document.getElementById('timezone');
  if (tzField && window.Intl && Intl.DateTimeFormat) {
    tzField.value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }

  const form = document.querySelector('form.schedule-form');
  if (!form) return;

  form.addEventListener('submit', () => {
    const dt = form.querySelector('input[name="scheduledAt"]');
    if (!dt || !dt.value) return;

    const local = new Date(dt.value);
    if (Number.isNaN(local.getTime())) return;

    let hidden = form.querySelector('input[name="scheduledAtIso"]');
    if (!hidden) {
      hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = 'scheduledAtIso';
      form.appendChild(hidden);
    }
    hidden.value = local.toISOString();
  });

  const previewBtn = document.getElementById('preview-tts');
  const audioEl = document.getElementById('tts-audio');
  const errorEl = document.getElementById('tts-preview-error');
  const statusEl = document.getElementById('tts-preview-status');

  if (previewBtn && audioEl) {
    previewBtn.addEventListener('click', async () => {
      const textarea = form.querySelector('textarea[name="messageText"]');
      const text = (textarea?.value || '').trim();

      errorEl.hidden = true;
      errorEl.textContent = '';

      if (!text) {
        errorEl.textContent = 'Enter message text first.';
        errorEl.hidden = false;
        textarea?.focus();
        return;
      }

      previewBtn.disabled = true;
      const origLabel = previewBtn.textContent;
      previewBtn.textContent = 'Synthesizing...';
      statusEl.hidden = false;
      statusEl.textContent = 'Calling Google TTS...';

      try {
        const res = await fetch('/tts/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });

        if (!res.ok) {
          let message = 'Preview failed (' + res.status + ').';
          try {
            const errJson = await res.json();
            if (errJson?.error) message = errJson.error;
          } catch (_) { /* not JSON */ }
          throw new Error(message);
        }

        const blob = await res.blob();
        if (audioEl.src) URL.revokeObjectURL(audioEl.src);
        audioEl.src = URL.createObjectURL(blob);
        audioEl.hidden = false;
        statusEl.textContent = 'Ready (' + Math.round(blob.size / 1024) + ' KB).';
        try { await audioEl.play(); } catch (_) { /* autoplay may be blocked */ }
      } catch (err) {
        errorEl.textContent = err.message || 'Preview failed.';
        errorEl.hidden = false;
        statusEl.hidden = true;
      } finally {
        previewBtn.disabled = false;
        previewBtn.textContent = origLabel;
      }
    });
  }
})();
