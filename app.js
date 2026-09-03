/**
 * Masa Pulse Monitor - Core Dashboard Logic
 * Monitors multiple website iframes and checks online/offline health status.
 */

// Initial default websites (including the user's 4 websites + 5 customizable slots for 9 in total)
const DEFAULT_SITES = [
  {
    id: 'site-1',
    name: 'بوابة العيون (Eyetoora)',
    url: 'https://eyetoora.com/ar',
    category: 'الإنتاج الرئيسي'
  },
  {
    id: 'site-2',
    name: 'داواتورا التجريبي (Dawatoora)',
    url: 'https://testwebsite.dawatoora.com/',
    category: 'البيئة التجريبية'
  },
  {
    id: 'site-3',
    name: 'جنيد ماسة A4 (Juned Masa)',
    url: 'https://a4.junedmasa.com/ar',
    category: 'خدمات ماسة'
  },
  {
    id: 'site-4',
    name: 'إطارات جنيد ماسة (Juned Tyres)',
    url: 'https://tyres.junedmasa.com/en',
    category: 'متاجر وإطارات'
  },
  {
    id: 'site-5',
    name: 'الموقع الخامس (مساحة مخصصة)',
    url: 'https://example.com',
    category: 'مواقع إضافية'
  },
  {
    id: 'site-6',
    name: 'الموقع السادس (مساحة مخصصة)',
    url: 'https://ar.wikipedia.org/wiki/%D8%A7%D9%84%D8%B5%D9%81%D8%AD%D8%A9_%D8%A7%D9%84%D8%B1%D8%A6%D9%8A%D8%B3%D9%8A%D8%A9',
    category: 'مواقع إضافية'
  },
  {
    id: 'site-7',
    name: 'الموقع السابع (مساحة مخصصة)',
    url: 'https://httpbin.org/status/200',
    category: 'مواقع إضافية'
  },
  {
    id: 'site-8',
    name: 'الموقع الثامن (مساحة مخصصة)',
    url: 'https://www.w3schools.com',
    category: 'مواقع إضافية'
  },
  {
    id: 'site-9',
    name: 'الموقع التاسع (مساحة مخصصة)',
    url: 'https://cdnjs.cloudflare.com',
    category: 'مواقع إضافية'
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
  currentLayout: 'grid-3x3'
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

const addSiteBtn = document.getElementById('addSiteBtn');
const bulkImportBtn = document.getElementById('bulkImportBtn');
const recheckAllBtn = document.getElementById('recheckAllBtn');
const refreshIcon = document.getElementById('refreshIcon');
const resetDefaultsBtn = document.getElementById('resetDefaultsBtn');
const autoRefreshSelect = document.getElementById('autoRefreshSelect');
const gridLayoutSelect = document.getElementById('gridLayoutSelect');
const siteSearchInput = document.getElementById('siteSearchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');

// Modals
const siteModal = document.getElementById('siteModal');
const siteForm = document.getElementById('siteForm');
const modalTitle = document.getElementById('modalTitle');
const editSiteId = document.getElementById('editSiteId');
const siteNameInput = document.getElementById('siteNameInput');
const siteUrlInput = document.getElementById('siteUrlInput');
const siteCategoryInput = document.getElementById('siteCategoryInput');
const saveBtnText = document.getElementById('saveBtnText');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');

const bulkModal = document.getElementById('bulkModal');
const bulkInputText = document.getElementById('bulkInputText');
const bulkAppendCheck = document.getElementById('bulkAppendCheck');
const processBulkBtn = document.getElementById('processBulkBtn');
const closeBulkModalBtn = document.getElementById('closeBulkModalBtn');
const cancelBulkBtn = document.getElementById('cancelBulkBtn');

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
    const saved = localStorage.getItem('masa_monitored_sites_v2');
    if (saved) {
      state.sites = JSON.parse(saved);
    } else {
      state.sites = [...DEFAULT_SITES];
      saveSitesToStorage();
    }
  } catch (e) {
    console.error('Error loading sites from storage:', e);
    state.sites = [...DEFAULT_SITES];
  }

  // Load saved layout preference
  const savedLayout = localStorage.getItem('masa_grid_layout');
  if (savedLayout) {
    state.currentLayout = savedLayout;
    if (gridLayoutSelect) gridLayoutSelect.value = savedLayout;
    applyGridLayout(savedLayout);
  }
}

function saveSitesToStorage() {
  localStorage.setItem('masa_monitored_sites_v2', JSON.stringify(state.sites));
}

/* ==========================================================================
   Event Listeners
   ========================================================================== */
function setupEventListeners() {
  // Add Site Modal
  addSiteBtn.addEventListener('click', () => openAddModal());
  closeModalBtn.addEventListener('click', closeSiteModal);
  cancelModalBtn.addEventListener('click', closeSiteModal);
  siteModal.addEventListener('click', (e) => {
    if (e.target === siteModal) closeSiteModal();
  });
  siteForm.addEventListener('submit', handleSiteFormSubmit);

  // Bulk Modal
  bulkImportBtn.addEventListener('click', openBulkModal);
  closeBulkModalBtn.addEventListener('click', closeBulkModal);
  cancelBulkBtn.addEventListener('click', closeBulkModal);
  bulkModal.addEventListener('click', (e) => {
    if (e.target === bulkModal) closeBulkModal();
  });
  processBulkBtn.addEventListener('click', handleBulkImport);

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

  // Grid Layout select
  gridLayoutSelect.addEventListener('change', (e) => {
    const layout = e.target.value;
    state.currentLayout = layout;
    localStorage.setItem('masa_grid_layout', layout);
    applyGridLayout(layout);
  });

  // Reset to default
  resetDefaultsBtn.addEventListener('click', () => {
    if (confirm('هل أنت متأكد من رغبتك في استعادة قائمة المواقع الافتراضية؟')) {
      loadDefaultSites();
    }
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
      closeSiteModal();
      closeBulkModal();
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
  statTotal.textContent = total;
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
      site.url.toLowerCase().includes(state.searchQuery) ||
      (site.category && site.category.toLowerCase().includes(state.searchQuery));

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
        <button class="card-action-btn" title="تعديل بيانات الموقع" onclick="openEditModal('${site.id}')">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button class="card-action-btn delete-btn" title="حذف الموقع" onclick="deleteSite('${site.id}')">
          <i class="fa-solid fa-trash"></i>
        </button>
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
   Modals: Add / Edit
   ========================================================================== */
window.openAddModal = function() {
  modalTitle.textContent = 'إضافة موقع جديد';
  saveBtnText.textContent = 'حفظ وإضافة';
  editSiteId.value = '';
  siteNameInput.value = '';
  siteUrlInput.value = '';
  siteCategoryInput.value = '';
  siteModal.classList.add('active');
  siteNameInput.focus();
};

window.openEditModal = function(siteId) {
  const site = state.sites.find(s => s.id === siteId);
  if (!site) return;

  modalTitle.textContent = 'تعديل بيانات الموقع';
  saveBtnText.textContent = 'حفظ التعديلات';
  editSiteId.value = site.id;
  siteNameInput.value = site.name;
  siteUrlInput.value = site.url;
  siteCategoryInput.value = site.category || '';
  siteModal.classList.add('active');
  siteNameInput.focus();
};

function closeSiteModal() {
  siteModal.classList.remove('active');
}

function handleSiteFormSubmit(e) {
  e.preventDefault();

  const id = editSiteId.value;
  const name = siteNameInput.value.trim();
  let url = siteUrlInput.value.trim();
  const category = siteCategoryInput.value.trim();

  if (!name || !url) {
    showToast('يرجى ملء اسم ورابط الموقع!', 'error');
    return;
  }

  // Ensure protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  if (id) {
    // Edit existing
    const site = state.sites.find(s => s.id === id);
    if (site) {
      site.name = name;
      site.url = url;
      site.category = category;
      showToast(`تم تحديث موقع "${name}" بنجاح.`, 'success');
    }
  } else {
    // Add new
    const newSite = {
      id: 'site-' + Date.now(),
      name: name,
      url: url,
      category: category
    };
    state.sites.push(newSite);
    showToast(`تمت إضافة موقع "${name}" بنجاح!`, 'success');
    // Check it immediately
    setTimeout(() => checkSingleSite(newSite), 200);
  }

  saveSitesToStorage();
  closeSiteModal();
  renderSites();
  updateMetricsSummary();
}

/* ==========================================================================
   Modals: Bulk Import
   ========================================================================== */
function openBulkModal() {
  bulkModal.classList.add('active');
  bulkInputText.focus();
}

function closeBulkModal() {
  bulkModal.classList.remove('active');
}

function handleBulkImport() {
  const text = bulkInputText.value.trim();
  if (!text) {
    showToast('يرجى إدخال قائمة المواقع أولاً!', 'error');
    return;
  }

  const lines = text.split('\n');
  const newSites = [];

  lines.forEach((line, idx) => {
    line = line.trim();
    if (!line) return;

    let name = '';
    let url = '';

    if (line.includes('|')) {
      const parts = line.split('|');
      name = parts[0].trim();
      url = parts[1].trim();
    } else if (line.includes(',')) {
      const parts = line.split(',');
      name = parts[0].trim();
      url = parts[1].trim();
    } else {
      url = line;
      try {
        const parsed = new URL(url.startsWith('http') ? url : 'https://' + url);
        name = parsed.hostname;
      } catch (e) {
        name = `موقع ${idx + 1}`;
      }
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    newSites.push({
      id: 'site-' + Date.now() + '-' + idx,
      name: name || `موقع جديد ${idx + 1}`,
      url: url,
      category: 'استيراد جماعي'
    });
  });

  if (newSites.length === 0) {
    showToast('لم يتم العثور على روابط صحيحة في النص المدخل!', 'error');
    return;
  }

  if (bulkAppendCheck.checked) {
    state.sites = [...state.sites, ...newSites];
  } else {
    state.sites = newSites;
    state.siteStatuses = {};
  }

  saveSitesToStorage();
  closeBulkModal();
  bulkInputText.value = '';
  renderSites();
  checkAllSitesStatus();
  showToast(`تم استيراد ${newSites.length} موقعاً بنجاح!`, 'success');
}

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
