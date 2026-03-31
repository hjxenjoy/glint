class AppState extends EventTarget {
  #state = {
    currentView: 'home',
    selectedDemoId: null,
    selectedProjectId: null,
    searchQuery: '',
    theme: 'system',
    sidebarOpen: true,
  };

  get(key) {
    return this.#state[key];
  }

  set(key, value) {
    if (this.#state[key] === value) return;
    const prev = this.#state[key];
    this.#state[key] = value;
    this.dispatchEvent(new CustomEvent('change', { detail: { key, value, prev } }));
  }

  navigate(hash) {
    location.hash = hash;
  }

  // Emit data-changed to trigger list refreshes
  notifyDataChanged(type) {
    this.dispatchEvent(new CustomEvent('data-changed', { detail: { type } }));
  }
}

export const appState = new AppState();

function parseHash() {
  const hash = location.hash || '#/';
  const [path, queryStr] = hash.slice(1).split('?');
  const params = Object.fromEntries(new URLSearchParams(queryStr || ''));
  const segments = path.split('/').filter(Boolean);

  // Route matching
  if (segments.length === 0) {
    appState.set('currentView', 'home');
  } else if (segments[0] === 'demos' && !segments[1]) {
    appState.set('currentView', 'all-demos');
  } else if (segments[0] === 'demos' && segments[1] === 'new') {
    appState.set('currentView', 'new-demo');
    appState.set('selectedProjectId', params.projectId || null);
  } else if (segments[0] === 'demos' && segments[2] === 'edit') {
    appState.set('currentView', 'demo-edit');
    appState.set('selectedDemoId', segments[1]);
  } else if (segments[0] === 'demos' && segments[1]) {
    appState.set('currentView', 'demo-preview');
    appState.set('selectedDemoId', segments[1]);
  } else if (segments[0] === 'projects' && segments[1]) {
    appState.set('currentView', 'project');
    appState.set('selectedProjectId', segments[1]);
  } else if (segments[0] === 'search') {
    appState.set('currentView', 'search');
    appState.set('searchQuery', params.q || '');
  } else if (segments[0] === 'settings') {
    appState.set('currentView', 'settings');
  }
}

window.addEventListener('hashchange', parseHash);
parseHash(); // parse on load
