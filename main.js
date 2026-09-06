/**
 * Masa Pulse Monitor - Core Dashboard Logic
 * Monitors multiple website iframes and checks online/offline health status.
 */

// Initial default websites (English names only)
const DEFAULT_SITES = [
  {
    id: 'site-1',
    name: 'Eyetoora',
    url: 'https://eyetoora.com/ar'
  },
  {
    id: 'site-2',
    name: 'Dawatoora',
    url: 'https://testwebsite.dawatoora.com/'
  },
  {
    id: 'site-3',
    name: 'Juned Masa A4',
    url: 'https://a4.junedmasa.com/ar'
  },
  {
    id: 'site-4',
    name: 'Juned Tyres',
    url: 'https://tyres.junedmasa.com/en'
  }
];

// Application State
let state = {
  sites: [],
  siteStatuses: {}, // id -> { status: 'checking' | 'online' | 'offline', latency: number, lastChecked: Date }
  currentFilter: 'all',
  searchQuery: '',
  autoRefreshIntervalSeconds: 60,
  countdown: 60,
  countdownTimerId: null,
  autoRefreshTimerId: null,
  currentLayout: 'grid-2x2'
};

// DOM Elements
const sitesGrid = document.getElementById('sitesGrid');
const emptyState = document.getElementById('emptyState');
const statTotal = document.getElementById('statTotal');
const statOnline = document.getElementById('statOnline');
const statOffline = document.getElementById('statOffline');
const statUptimePercent = document.getElementById('statUptimePercent');
const uptimeProgressBar = document.getElementById('uptimeProgressBar');
const statAvgLatency = document.getElementById('statAvgLatency');
const lastCheckTimeText = document.getElementById('lastCheckTimeText');
const offlineGlow = document.getElementById('offlineGlow');

const countAllFilter = document.getElementById('countAllFilter');
const countOnlineFilter = document.getElementById('countOnlineFilter');
const countOfflineFilter = document.getElementById('countOfflineFilter');
const countdownSeconds = document.getElementById('countdownSeconds');

const recheckAllBtn = document.getElementById('recheckAllBtn');
const refreshIcon = document.getElementById('refreshIcon');
const autoRefreshSelect = document.getElementById('autoRefreshSelect');
const siteSearchInput = document.getElementById('siteSearchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');

// Fullscreen Preview Modal
const fullscreenModal = document.getElementById('fullscreenModal');
const fsSiteTitle = document.getElementById('fsSiteTitle');
const fsSiteUrl = document.getElementById('fsSiteUrl');
const fsStatusPill = document.getElementById('fsStatusPill');
const fsStatusText = document.getElementById('fsStatusText');
const fsIframe = document.getElementById('fsIframe');
const fsReloadBtn = document.getElementById('fsReloadBtn');
const fsExternalBtn = document.getElementById('fsExternalBtn');
const fsCloseBtn = document.getElementById('fsCloseBtn');

const toastContainer = document.getElementById('toastContainer');

/* ==========================================================================
   Initialization
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  loadSitesFromStorage();
  setupEventListeners();
  renderSites();
  checkAllSitesStatus();
  startCountdownTimer();
});

function loadSitesFromStorage() {
  try {
    const saved = localStorage.getItem('masa_monitored_sites_v4');
    if (saved) {
      state.sites = JSON.parse(saved);
      // Remove legacy category field if present
      state.sites.forEach(s => { delete s.category; });
    } else {
      state.sites = JSON.parse(JSON.stringify(DEFAULT_SITES));
      saveSitesToStorage();
    }
  } catch (e) {
    console.error('Error loading sites from storage:', e);
    state.sites = JSON.parse(JSON.stringify(DEFAULT_SITES));
  }

  // Fix grid layout to 2x2 for the 4 official sites
  state.currentLayout = 'grid-2x2';
  applyGridLayout('grid-2x2');
}

function saveSitesToStorage() {
  localStorage.setItem('masa_monitored_sites_v4', JSON.stringify(state.sites));
}

/* ==========================================================================
   Event Listeners
   ========================================================================== */
function setupEventListeners() {
  // Re-check All
  recheckAllBtn.addEventListener('click', () => {
    triggerManualRefresh();
  });

  // Auto-refresh select
  autoRefreshSelect.addEventListener('change', (e) => {
    state.autoRefreshIntervalSeconds = parseInt(e.target.value, 10);
    state.countdown = state.autoRefreshIntervalSeconds;
    updateCountdownUI();
    showToast(`تم ضبط التحديث التلقائي إلى: ${e.target.options[e.target.selectedIndex].text}`, 'info');
  });



  // Search Input
  siteSearchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    clearSearchBtn.style.display = state.searchQuery ? 'block' : 'none';
    renderSites();
  });

  clearSearchBtn.addEventListener('click', () => {
    siteSearchInput.value = '';
    state.searchQuery = '';
    clearSearchBtn.style.display = 'none';
    renderSites();
  });

  // Filters
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentFilter = btn.dataset.filter;
      renderSites();
    });
  });

  // Fullscreen Modal Actions
  fsCloseBtn.addEventListener('click', closeFullscreenModal);
  fullscreenModal.addEventListener('click', (e) => {
    if (e.target === fullscreenModal) closeFullscreenModal();
  });
  fsReloadBtn.addEventListener('click', () => {
    if (fsIframe.src) {
      const currentSrc = fsIframe.src;
      fsIframe.src = 'about:blank';
      setTimeout(() => { fsIframe.src = currentSrc; }, 100);
      showToast('جاري إعادة تحميل النافذة المكبرة...', 'info');
    }
  });

  // Keyboard escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeFullscreenModal();
    }
  });
}

function applyGridLayout(layoutClass) {
  sitesGrid.className = `sites-grid-container ${layoutClass}`;
}

/* ==========================================================================
   Countdown & Auto-Refresh Timer
   ========================================================================== */
function startCountdownTimer() {
  if (state.countdownTimerId) clearInterval(state.countdownTimerId);

  state.countdownTimerId = setInterval(() => {
    if (state.autoRefreshIntervalSeconds <= 0) {
      countdownSeconds.textContent = 'معطل';
      return;
    }

    state.countdown--;
    if (state.countdown <= 0) {
      state.countdown = state.autoRefreshIntervalSeconds;
      checkAllSitesStatus(true);
    }
    updateCountdownUI();
  }, 1000);
}

function updateCountdownUI() {
  if (state.autoRefreshIntervalSeconds <= 0) {
    countdownSeconds.textContent = 'معطل';
  } else {
    countdownSeconds.textContent = `${state.countdown}`;
  }
}

function triggerManualRefresh() {
  refreshIcon.classList.add('spin-fast');
  checkAllSitesStatus(true).then(() => {
    setTimeout(() => {
      refreshIcon.classList.remove('spin-fast');
      showToast('تم فحص وتحديث حالة جميع المواقع بنجاح!', 'success');
    }, 600);
  });
  state.countdown = state.autoRefreshIntervalSeconds;
  updateCountdownUI();
}

/* ==========================================================================
   Website Status Checking Engine (Ping / Uptime / Latency)
   ========================================================================== */

/**
 * Checks a website's reachability and calculates latency in ms.
 * Uses client-side fetch in 'no-cors' mode with timeout.
 */
async function checkSingleSite(site) {
  state.siteStatuses[site.id] = {
    status: 'checking',
    latency: null,
    lastChecked: new Date()
  };
  updateCardStatusUI(site.id);
  updateMetricsSummary();

  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000); // 9 sec timeout

  try {
    // Normalizing URL
    let cleanUrl = site.url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    // Attempt fetch with no-cors. If reachable, fetch resolves even for cross-origin!
    await fetch(cleanUrl, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-cache',
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const latency = Math.round(performance.now() - startTime);

    state.siteStatuses[site.id] = {
      status: 'online',
      latency: latency,
      lastChecked: new Date()
    };
  } catch (err) {
    clearTimeout(timeoutId);
    // If it was aborted due to timeout, or failed completely:
    // Let's do a secondary check with GET no-cors before marking completely down
    try {
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), 5000);

      await fetch(site.url, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-cache',
        signal: controller2.signal
      });

      clearTimeout(timeoutId2);
      const latency = Math.round(performance.now() - startTime);
      state.siteStatuses[site.id] = {
        status: 'online',
        latency: latency,
        lastChecked: new Date()
      };
    } catch (err2) {
      console.warn(`Site check failed for ${site.name} (${site.url}):`, err2.message);
      state.siteStatuses[site.id] = {
        status: 'offline',
        latency: null,
        lastChecked: new Date()
      };
    }
  }

  updateCardStatusUI(site.id);
  updateMetricsSummary();
}

async function checkAllSitesStatus(soft = false) {
  if (!state.sites || state.sites.length === 0) {
    updateMetricsSummary();
    return;
  }

  // Update checking state for all
  state.sites.forEach(site => {
    if (!state.siteStatuses[site.id] || !soft) {
      state.siteStatuses[site.id] = {
        status: 'checking',
        latency: null,
        lastChecked: new Date()
      };
      updateCardStatusUI(site.id);
    }
  });
  updateMetricsSummary();

  // Run checks in parallel with stagger to prevent network choke
  const promises = state.sites.map((site, index) => {
    return new Promise(resolve => {
      setTimeout(async () => {
        await checkSingleSite(site);
        resolve();
      }, index * 120);
    });
  });

  await Promise.all(promises);
  updateMetricsSummary();
}

/* ==========================================================================
   Metrics & Counters Update
   ========================================================================== */
function updateMetricsSummary() {
  const total = state.sites.length;
  let onlineCount = 0;
  let offlineCount = 0;
  let checkingCount = 0;
  let totalLatency = 0;
  let latencyCount = 0;

  state.sites.forEach(site => {
    const s = state.siteStatuses[site.id];
    if (s) {
      if (s.status === 'online') {
        onlineCount++;
        if (s.latency) {
          totalLatency += s.latency;
          latencyCount++;
        }
      } else if (s.status === 'offline') {
        offlineCount++;
      } else {
        checkingCount++;
      }
    } else {
      checkingCount++;
    }
  });

  // Update Top Stats
  if (statTotal) statTotal.textContent = total;
  statOnline.textContent = onlineCount;
  statOffline.textContent = offlineCount;

  // Filter counts
  countAllFilter.textContent = total;
  countOnlineFilter.textContent = onlineCount;
  countOfflineFilter.textContent = offlineCount;

  // Uptime Percentage
  let uptimePercent = 100;
  if (total > 0) {
    const evaluatedTotal = onlineCount + offlineCount;
    if (evaluatedTotal > 0) {
      uptimePercent = Math.round((onlineCount / evaluatedTotal) * 100);
    } else {
      uptimePercent = 100;
    }
  }
  statUptimePercent.textContent = uptimePercent;
  uptimeProgressBar.style.width = `${uptimePercent}%`;

  if (uptimePercent < 80) {
    uptimeProgressBar.style.background = 'linear-gradient(90deg, #ef4444, #f59e0b)';
  } else {
    uptimeProgressBar.style.background = 'linear-gradient(90deg, #10b981, #06b6d4)';
  }

  // Offline glow indicator
  if (offlineCount > 0) {
    offlineGlow.classList.add('active');
  } else {
    offlineGlow.classList.remove('active');
  }

  // Latency Average
  if (latencyCount > 0) {
    const avg = Math.round(totalLatency / latencyCount);
    statAvgLatency.textContent = `${avg}`;
  } else {
    statAvgLatency.textContent = '--';
  }

  // Last check time
  const now = new Date();
  const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  lastCheckTimeText.textContent = `آخر فحص: ${timeStr}`;
}

/* ==========================================================================
   Render Sites Grid
   ========================================================================== */
function renderSites() {
  sitesGrid.innerHTML = '';

  let filteredSites = state.sites.filter(site => {
    // Filter query
    const matchesSearch = !state.searchQuery ||
      site.name.toLowerCase().includes(state.searchQuery) ||
      site.url.toLowerCase().includes(state.searchQuery);

    // Filter status
    const statusObj = state.siteStatuses[site.id];
    const currentStatus = statusObj ? statusObj.status : 'checking';

    let matchesFilter = true;
    if (state.currentFilter === 'online') {
      matchesFilter = currentStatus === 'online';
    } else if (state.currentFilter === 'offline') {
      matchesFilter = currentStatus === 'offline';
    }

    return matchesSearch && matchesFilter;
  });

  if (filteredSites.length === 0) {
    if (state.sites.length === 0) {
      emptyState.style.display = 'block';
    } else {
      emptyState.style.display = 'none';
      sitesGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon"><i class="fa-solid fa-filter-circle-xmark"></i></div>
          <h3>لا توجد مواقع تطابق معايير البحث أو التصفية</h3>
          <p>جرب تغيير خيار التصفية أو مسح عبارة البحث</p>
        </div>
      `;
    }
    return;
  }

  emptyState.style.display = 'none';

  filteredSites.forEach(site => {
    const card = createSiteCardElement(site);
    sitesGrid.appendChild(card);
  });
}

function createSiteCardElement(site) {
  const card = document.createElement('article');
  card.className = 'site-card';
  card.id = `card-${site.id}`;

  const statusInfo = state.siteStatuses[site.id] || { status: 'checking', latency: null };

  // Domain for favicon
  let domain = '';
  try {
    const parsed = new URL(site.url);
    domain = parsed.hostname;
  } catch (e) {
    domain = site.url;
  }
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

  card.innerHTML = `
    <!-- Header -->
    <div class="card-header">
      <div class="card-site-meta">
        <div class="site-favicon">
          <img src="${faviconUrl}" alt="${site.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220%22%200%22%20100%22%20100%22><text y=%22.9em%22 font-size=%2290%22>🌐</text></svg>'">
        </div>
        <div class="site-titles">
          <div class="site-name-row">
            <h2 class="site-name" title="${site.name}">${escapeHtml(site.name)}</h2>
          </div>
          <a href="${site.url}" target="_blank" rel="noopener noreferrer" class="site-url-link" title="${site.url}">
            ${escapeHtml(site.url)}
          </a>
        </div>
      </div>

      <!-- Status Badge -->
      <div class="card-status-badge status-${statusInfo.status}" id="badge-${site.id}">
        <span class="status-dot"></span>
        <span class="status-text">${getStatusLabel(statusInfo.status)}</span>
        <span class="latency-tag">${statusInfo.latency ? `${statusInfo.latency}ms` : ''}</span>
      </div>

      <!-- Quick Actions -->
      <div class="card-actions">
        <button class="card-action-btn" title="إعادة فحص هذا الموقع" onclick="recheckSite('${site.id}')">
          <i class="fa-solid fa-rotate-right"></i>
        </button>
        <button class="card-action-btn" title="تكبير ملء الشاشة" onclick="openFullscreenPreview('${site.id}')">
          <i class="fa-solid fa-expand"></i>
        </button>
        <a href="${site.url}" target="_blank" rel="noopener noreferrer" class="card-action-btn" title="فتح في نافذة جديدة">
          <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      </div>
    </div>

    <!-- Iframe Container -->
    <div class="card-iframe-wrapper">
      <div class="iframe-loader" id="loader-${site.id}">
        <div class="loader-spinner"></div>
        <span class="loader-text">جاري تحميل المعاينة...</span>
      </div>

      <iframe
        id="iframe-${site.id}"
        class="site-iframe"
        src="${site.url}"
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        onload="handleIframeLoaded('${site.id}')"
        onerror="handleIframeError('${site.id}')"
        title="${site.name}">
      </iframe>

      <div class="iframe-error-overlay" id="error-overlay-${site.id}" style="display: none;">
        <div class="error-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
        <h4 class="error-title">تعذر عرض الموقع داخل الإطار</h4>
        <p class="error-desc">الموقع إما غير متاح حالياً أو يمنع التضمين الخارجي (X-Frame-Options).</p>
        <div class="error-actions">
          <button class="btn btn-outline btn-sm" onclick="recheckSite('${site.id}')">
            <i class="fa-solid fa-rotate-right"></i> إعادة التجربة
          </button>
          <a href="${site.url}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">
            <i class="fa-solid fa-external-link"></i> فتح الموقع مباشرة
          </a>
        </div>
      </div>
    </div>
  `;

  return card;
}

function handleIframeLoaded(siteId) {
  const loader = document.getElementById(`loader-${siteId}`);
  if (loader) {
    loader.classList.add('hidden');
  }
}

function handleIframeError(siteId) {
  const loader = document.getElementById(`loader-${siteId}`);
  if (loader) loader.classList.add('hidden');
  
  const errorOverlay = document.getElementById(`error-overlay-${siteId}`);
  if (errorOverlay) errorOverlay.style.display = 'flex';
}

function updateCardStatusUI(siteId) {
  const badge = document.getElementById(`badge-${siteId}`);
  const statusInfo = state.siteStatuses[siteId] || { status: 'checking', latency: null };
  const errorOverlay = document.getElementById(`error-overlay-${siteId}`);

  if (badge) {
    badge.className = `card-status-badge status-${statusInfo.status}`;
    badge.innerHTML = `
      <span class="status-dot"></span>
      <span class="status-text">${getStatusLabel(statusInfo.status)}</span>
      <span class="latency-tag">${statusInfo.latency ? `${statusInfo.latency}ms` : ''}</span>
    `;
  }

  // If offline, display the error overlay
  if (errorOverlay) {
    if (statusInfo.status === 'offline') {
      errorOverlay.style.display = 'flex';
    } else {
      errorOverlay.style.display = 'none';
    }
  }
}

function getStatusLabel(status) {
  switch (status) {
    case 'online': return 'شغال';
    case 'offline': return 'واقع / معطل';
    case 'checking': return 'جاري الفحص...';
    default: return 'غير معروف';
  }
}

/* ==========================================================================
   Card Operations (Reload, Recheck, Delete, Edit, Fullscreen)
   ========================================================================== */
window.recheckSite = function(siteId) {
  const site = state.sites.find(s => s.id === siteId);
  if (!site) return;

  const iframe = document.getElementById(`iframe-${siteId}`);
  const loader = document.getElementById(`loader-${siteId}`);
  if (loader) loader.classList.remove('hidden');

  if (iframe) {
    try {
      const url = new URL(site.url);
      url.searchParams.set('_t', Date.now());
      iframe.src = url.toString();
    } catch (e) {
      iframe.src = site.url;
    }
  }

  checkSingleSite(site);
  showToast(`جاري إعادة فحص وتحديث ${site.name}...`, 'info');
};

window.openFullscreenPreview = function(siteId) {
  const site = state.sites.find(s => s.id === siteId);
  if (!site) return;

  const statusInfo = state.siteStatuses[siteId] || { status: 'checking' };

  fsSiteTitle.textContent = site.name;
  fsSiteUrl.textContent = site.url;
  fsExternalBtn.href = site.url;
  fsStatusPill.className = `status-pill status-${statusInfo.status}`;
  fsStatusText.textContent = getStatusLabel(statusInfo.status);

  fsIframe.src = site.url;
  fullscreenModal.classList.add('active');
};

function closeFullscreenModal() {
  fullscreenModal.classList.remove('active');
  fsIframe.src = 'about:blank';
}

window.deleteSite = function(siteId) {
  const site = state.sites.find(s => s.id === siteId);
  if (!site) return;

  if (confirm(`هل أنت متأكد من حذف موقع "${site.name}" من اللوحة؟`)) {
    state.sites = state.sites.filter(s => s.id !== siteId);
    delete state.siteStatuses[siteId];
    saveSitesToStorage();
    renderSites();
    updateMetricsSummary();
    showToast(`تم حذف موقع "${site.name}" بنجاح.`, 'info');
  }
};





/* ==========================================================================
   Default Sites Loader
   ========================================================================== */
window.loadDefaultSites = function() {
  state.sites = JSON.parse(JSON.stringify(DEFAULT_SITES));
  state.siteStatuses = {};
  saveSitesToStorage();
  renderSites();
  checkAllSitesStatus();
  showToast('تمت استعادة المواقع الافتراضية بنجاح!', 'success');
};

/* ==========================================================================
   Toast Notification System
   ========================================================================== */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let icon = 'fa-info-circle';
  if (type === 'success') icon = 'fa-check-circle text-success';
  if (type === 'error') icon = 'fa-circle-xmark text-danger';

  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span>${message}</span>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ==========================================================================
   Utility Helpers
   ========================================================================== */
function escapeHtml(string) {
  const div = document.createElement('div');
  div.textContent = string;
  return div.innerHTML;
}
