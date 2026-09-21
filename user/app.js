/**
 * WatchPay Standalone User Panel App
 * Production client handling all user panel flows:
 * - Authentication with Telegram.WebApp.initData
 * - Ad session creation & Monetag claim
 * - Telegram tasks verify & claim
 * - Daily bonus once per Bangladesh day
 * - Referral link generation & history
 * - Withdrawal request & status history
 * - Full transaction ledger
 */

(function () {
  const config = window.WATCHPAY_CONFIG || { WORKER_API_URL: '' };

  let currentUser = null;
  let currentSettings = null;
  let currentSession = null;
  let adInterval = null;

  // Telegram SDK Init
  if (window.Telegram?.WebApp) {
    try {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    } catch (e) {
      console.warn('Telegram init error:', e);
    }
  }

  function getInitData() {
    if (window.Telegram?.WebApp?.initData) {
      return window.Telegram.WebApp.initData;
    }
    const saved = localStorage.getItem('watchpay_dev_initdata');
    if (saved) return saved;
    return 'query_id=AAHdF6IQAAAAAN0XohAgXwzN&user=%7B%22id%22%3A782918231%2C%22first_name%22%3A%22Rakib%22%2C%22is_premium%22%3Atrue%7D&auth_date=1726915200&hash=dev_simulated_hash';
  }

  async function apiRequest(endpoint, method = 'GET', body = null) {
    const initData = getInitData();
    const headers = {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': initData,
    };

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const baseUrl = config.WORKER_API_URL || '';
    const res = await fetch(`${baseUrl}${endpoint}`, options);
    const json = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(json.message || 'সার্ভারের সাথে সংযোগ করা যাচ্ছে না।');
    }
    return json.data;
  }

  // Toast Notification
  function showToast(message, type = 'info') {
    const existing = document.getElementById('watchpay-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'watchpay-toast';
    toast.className = `toast-box ${type === 'error' ? 'toast-error' : 'toast-success'}`;
    toast.innerText = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3500);
  }

  // DOM Elements
  const elBalance = document.getElementById('user-balance');
  const elTodayEarnings = document.getElementById('today-earnings');
  const elLifetimeEarnings = document.getElementById('lifetime-earnings');
  const elAdsWatched = document.getElementById('ads-watched-stat');
  const elReferralsCount = document.getElementById('referrals-count-stat');
  const elReferralEarnings = document.getElementById('referral-earnings-stat');
  const elTotalWithdrawn = document.getElementById('total-withdrawn-stat');
  const elUserName = document.getElementById('user-first-name');
  const elUserId = document.getElementById('user-telegram-id');
  const elAdProgress = document.getElementById('ad-progress-bar');
  const elAdProgressText = document.getElementById('ad-progress-text');

  // Load User & Settings
  async function loadUser() {
    try {
      const auth = await apiRequest('/api/auth', 'POST', { initData: getInitData() });
      currentUser = auth.user;
      currentSettings = auth.settings;
      renderUserData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function renderUserData() {
    if (!currentUser) return;
    if (elBalance) elBalance.innerText = currentUser.balance.toFixed(2);
    if (elTodayEarnings) elTodayEarnings.innerText = '+৳' + currentUser.todayEarnings.toFixed(2);
    if (elLifetimeEarnings) elLifetimeEarnings.innerText = '৳' + currentUser.lifetimeEarnings.toFixed(2);
    if (elAdsWatched) elAdsWatched.innerText = currentUser.totalAdsWatched + ' টি';
    if (elReferralsCount) elReferralsCount.innerText = currentUser.totalReferrals + ' জন';
    if (elReferralEarnings) elReferralEarnings.innerText = '৳' + currentUser.referralEarnings.toFixed(2);
    if (elTotalWithdrawn) elTotalWithdrawn.innerText = '৳' + currentUser.totalWithdrawn.toFixed(2);
    if (elUserName) elUserName.innerText = currentUser.firstName;
    if (elUserId) elUserId.innerText = 'ID: ' + currentUser.telegramId;

    const dailyLimit = currentSettings?.dailyAdLimit || 50;
    const watched = currentUser.todayAdsWatched || 0;
    const pct = Math.min(100, Math.round((watched / dailyLimit) * 100));

    if (elAdProgress) elAdProgress.style.width = pct + '%';
    if (elAdProgressText) elAdProgressText.innerText = `${watched} / ${dailyLimit}`;
  }

  // Tab Navigation
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      const targetPageId = tab.dataset.page;
      document.querySelectorAll('.page-view').forEach((p) => p.classList.add('hidden'));
      const activePage = document.getElementById(targetPageId);
      if (activePage) activePage.classList.remove('hidden');

      if (targetPageId === 'page-tasks') loadTasks();
      if (targetPageId === 'page-referrals') loadReferrals();
      if (targetPageId === 'page-withdraw') loadWithdrawals();
      if (targetPageId === 'page-profile') loadTransactions();
    });
  });

  // Watch Ad Flow
  const btnWatchAd = document.getElementById('btn-watch-ad');
  if (btnWatchAd) {
    btnWatchAd.addEventListener('click', async () => {
      btnWatchAd.disabled = true;
      btnWatchAd.innerText = 'সেশন তৈরি হচ্ছে...';

      try {
        const session = await apiRequest('/api/ad-session', 'POST');
        currentSession = session;

        let countdown = session.minWatchTime || 15;
        btnWatchAd.innerText = `বিজ্ঞাপন দেখা হচ্ছে (${countdown}s)...`;

        adInterval = setInterval(async () => {
          countdown--;
          if (countdown > 0) {
            btnWatchAd.innerText = `বিজ্ঞাপন দেখা হচ্ছে (${countdown}s)...`;
          } else {
            clearInterval(adInterval);
            btnWatchAd.innerText = 'যাচাই করা হচ্ছে...';

            try {
              const res = await apiRequest('/api/ad-claim', 'POST', {
                adSessionId: currentSession.adSessionId,
              });
              showToast(`অভিনন্দন! +৳${res.reward.toFixed(2)} যোগ হয়েছে!`, 'success');
              await loadUser();
            } catch (claimErr) {
              showToast(claimErr.message || 'বিজ্ঞাপন যাচাই করা যায়নি। আবার চেষ্টা করুন।', 'error');
            } finally {
              btnWatchAd.disabled = false;
              btnWatchAd.innerText = 'বিজ্ঞাপন দেখুন (Watch Ad)';
              currentSession = null;
            }
          }
        }, 1000);
      } catch (err) {
        showToast(err.message, 'error');
        btnWatchAd.disabled = false;
        btnWatchAd.innerText = 'বিজ্ঞাপন দেখুন (Watch Ad)';
      }
    });
  }

  // Daily Bonus Flow
  const btnDailyBonus = document.getElementById('btn-daily-bonus');
  if (btnDailyBonus) {
    btnDailyBonus.addEventListener('click', async () => {
      btnDailyBonus.disabled = true;
      try {
        const res = await apiRequest('/api/daily-bonus', 'POST');
        showToast(`দৈনিক বোনাস +৳${res.bonus.toFixed(2)} ক্লেইম সম্পন্ন!`, 'success');
        await loadUser();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btnDailyBonus.disabled = false;
      }
    });
  }

  // Withdrawal Flow
  const formWithdraw = document.getElementById('form-withdraw');
  if (formWithdraw) {
    formWithdraw.addEventListener('submit', async (e) => {
      e.preventDefault();
      const method = document.getElementById('withdraw-method').value;
      const account = document.getElementById('withdraw-account').value;
      const amount = parseFloat(document.getElementById('withdraw-amount').value);

      try {
        await apiRequest('/api/withdraw-create', 'POST', { method, account, amount });
        showToast('উত্তোলন অনুরোধ সফলভাবে পাঠানো হয়েছে!', 'success');
        formWithdraw.reset();
        await loadUser();
        loadWithdrawals();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  async function loadTasks() {
    const list = document.getElementById('tasks-list');
    if (!list) return;
    list.innerHTML = '<div style="text-align:center;padding:20px;">লোড হচ্ছে...</div>';
    try {
      const tasks = await apiRequest('/api/tasks');
      list.innerHTML = tasks
        .map(
          (t) => `
        <div class="glass-card" style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>${t.title}</strong>
            <span style="color:#10b981;font-weight:bold;">+৳${t.reward.toFixed(2)}</span>
          </div>
          <p style="font-size:11px;color:#94a3b8;margin:6px 0;">${t.description}</p>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <a href="${t.link}" target="_blank" class="btn-secondary" style="flex:1;text-decoration:none;">JOIN</a>
            <button onclick="window.claimTask('${t.id}')" class="btn-primary" style="flex:1;">VERIFY & CLAIM</button>
          </div>
        </div>
      `
        )
        .join('');
    } catch (err) {
      list.innerHTML = `<div style="color:#f43f5e;">${err.message}</div>`;
    }
  }

  window.claimTask = async function (taskId) {
    try {
      await apiRequest('/api/task-verify', 'POST', { taskId });
      const res = await apiRequest('/api/task-claim', 'POST', { taskId });
      showToast(`টাস্ক সম্পন্ন! +৳${res.reward.toFixed(2)}`, 'success');
      await loadUser();
      loadTasks();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  async function loadReferrals() {
    const linkInput = document.getElementById('ref-link-input');
    if (linkInput && currentUser) {
      linkInput.value = `https://t.me/watchpaybdbot?startapp=${currentUser.telegramId}`;
    }
  }

  async function loadWithdrawals() {
    const list = document.getElementById('withdrawals-history-list');
    if (!list) return;
    try {
      const data = await apiRequest('/api/withdrawals');
      if (data.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:20px;color:#64748b;">কোনো হিস্ট্রি নেই</div>';
        return;
      }
      list.innerHTML = data
        .map(
          (w) => `
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
          <div>
            <strong>${w.method}</strong> (${w.account})<br/>
            <small style="color:#64748b;">${new Date(w.createdAt).toLocaleDateString('bn-BD')}</small>
          </div>
          <div style="text-align:right;">
            <strong>৳${w.amount.toFixed(2)}</strong><br/>
            <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:${w.status === 'approved' ? '#064e3b' : '#78350f'};color:${w.status === 'approved' ? '#6ee7b7' : '#fde68a'};">${w.status}</span>
          </div>
        </div>
      `
        )
        .join('');
    } catch (err) {
      list.innerHTML = `<div style="color:#f43f5e;">${err.message}</div>`;
    }
  }

  async function loadTransactions() {
    const list = document.getElementById('transactions-list');
    if (!list) return;
    try {
      const data = await apiRequest('/api/transactions');
      if (data.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:20px;color:#64748b;">কোনো ট্রানজেকশন নেই</div>';
        return;
      }
      list.innerHTML = data
        .map(
          (tx) => `
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
          <div>
            <strong>${tx.title}</strong><br/>
            <small style="color:#64748b;">${new Date(tx.timestamp).toLocaleString('bn-BD')}</small>
          </div>
          <div style="text-align:right;">
            <strong style="color:${tx.amount > 0 ? '#10b981' : '#f43f5e'};">${tx.amount > 0 ? '+৳' : '-৳'}${Math.abs(tx.amount).toFixed(2)}</strong><br/>
            <small style="color:#64748b;">ব্যালেন্স: ৳${tx.balanceAfter.toFixed(2)}</small>
          </div>
        </div>
      `
        )
        .join('');
    } catch (err) {
      list.innerHTML = `<div style="color:#f43f5e;">${err.message}</div>`;
    }
  }

  // Copy ID
  window.copyTelegramId = function () {
    if (currentUser) {
      navigator.clipboard.writeText(currentUser.telegramId);
      showToast('টেলিগ্রাম আইডি কপি হয়েছে!', 'success');
    }
  };

  window.copyRefLink = function () {
    const linkInput = document.getElementById('ref-link-input');
    if (linkInput) {
      navigator.clipboard.writeText(linkInput.value);
      showToast('রেফারেল লিংক কপি হয়েছে!', 'success');
    }
  };

  // Run on startup
  loadUser();
})();
