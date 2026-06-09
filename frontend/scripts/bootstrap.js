const partials = [
  ['sidebar-root', './partials/sidebar.html'],
  ['content-root', './partials/dashboard.html', 'append'],
  ['content-root', './partials/arrange.html', 'append'],
  ['content-root', './partials/assistant.html', 'append'],
  ['content-root', './partials/connections.html', 'append'],
  ['content-root', './partials/preferences.html', 'append'],
  ['content-root', './partials/briefing.html', 'append'],
  ['overlay-root', './partials/overlays.html'],
];

async function loadPartial(targetId, url, mode = 'replace') {
  const target = document.getElementById(targetId);
  if (!target) throw new Error(`Missing partial mount: ${targetId}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url}`);
  const html = await response.text();
  if (mode === 'append') target.insertAdjacentHTML('beforeend', html);
  else target.innerHTML = html;
}

async function bootstrap() {
  for (const args of partials) await loadPartial(...args);

  // Mount the current compiled frontend app that matches the partial-based UI.
  const script = document.createElement('script');
  script.src = '../dist/frontend/scripts/legacy-app.js';
  document.body.appendChild(script);
}

bootstrap().catch((error) => {
  console.error(error);
  document.body.innerHTML = `<pre style="padding: 24px; color: #f87171">${error.message}</pre>`;
});
