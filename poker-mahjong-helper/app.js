/**
 * 🀄️ 雀神閣 ‧ 撲克籌碼約戰與結算系統 - Core Logic (app.js)
 * Antigravity Premium Web Application
 */

const STATE_KEY = 'poker_mahjong_helper_state';
const POINT_MULTIPLIER = 20; // 1點 = $20 元

// 撲克牌點數換算規則
const POKER_RULES = {
  1:  { label: 'A',  points: 1 },   // 1-10 點數即為牌面數值 (1點 = $20 元)
  2:  { label: '2',  points: 2 },
  3:  { label: '3',  points: 3 },
  4:  { label: '4',  points: 4 },
  5:  { label: '5',  points: 5 },
  6:  { label: '6',  points: 6 },
  7:  { label: '7',  points: 7 },
  8:  { label: '8',  points: 8 },
  9:  { label: '9',  points: 9 },
  10: { label: '10', points: 10 },
  11: { label: 'J',  points: 15 },  // J, Q, K 代表 15 點 (價值 $300 元)
  12: { label: 'Q',  points: 15 },
  13: { label: 'K',  points: 15 }
};

// 全域狀態管理
const todayDateObj = new Date();
let state = {
  match: {
    month: String(todayDateObj.getMonth() + 1),
    day: String(todayDateObj.getDate()),
    time: '待定',
    location: '大雄家', // 固定的打牌地點
    host: '紅茶',       // 固定的店東 (紅茶的店)
    slots: ['', '', '', ''] // 預設 4 位鐵咖
  },
  calc: {
    hostPlayer: 'none', // 'p1', 'p2', 'p3', 'p4', 'external', 'none'
    initialBuyin: 100, // 初始買入點數 (預設100點 = $2000)
    players: {
      1: { name: '玩家 1', cards: [] },
      2: { name: '玩家 2', cards: [] },
      3: { name: '玩家 3', cards: [] },
      4: { name: '玩家 4', cards: [] },
      '_host': { name: '店東房租', cards: [] }
    }
  }
};

// 頁面初始化
document.addEventListener('DOMContentLoaded', () => {
  init();
});

function init() {
  // 初始化日期與時間下拉選單
  populateDateTimeSelects();
  
  // 載入暫存資料
  loadFromLocalStorage();
  
  // 初始化 API Key 顯示與事件
  initApiKeyToggle();
  
  // 更新手機測試 QR Code
  updateMobileQR();
 
  // 綁定輸入元件事件
  bindInputs();
 
  // 初始渲染
  updateAllCalculations();
  updateHostDropdownOptions();
  updateHostSelection();
  
  for (let i = 1; i <= 4; i++) {
    renderPlayerCards(i);
  }
  renderPlayerCards('_host');
 
  // 即時更新 LINE 約戰預覽
  readMatchForm();
  updateLineTemplate();
}

// 填充月份、日期與時間選單
function populateDateTimeSelects() {
  const monthSel = document.getElementById('match-month');
  const daySel = document.getElementById('match-day');
  const timeSel = document.getElementById('match-time');
  
  if (!monthSel || !daySel || !timeSel) return;

  // 月份 1-12
  monthSel.innerHTML = '';
  for (let m = 1; m <= 12; m++) {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = `${m} 月`;
    monthSel.appendChild(opt);
  }

  // 日期 1-31
  daySel.innerHTML = '';
  for (let d = 1; d <= 31; d++) {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = `${d} 日`;
    daySel.appendChild(opt);
  }

  // 時間選單：預設「待定」，其後為 00:00 至 23:30 (每 30 分鐘一檔)
  timeSel.innerHTML = '';
  const optDefault = document.createElement('option');
  optDefault.value = '待定';
  optDefault.textContent = '待定';
  timeSel.appendChild(optDefault);

  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, '0');
    ['00', '30'].forEach(mm => {
      const opt = document.createElement('option');
      const timeVal = `${hh}:${mm}`;
      opt.value = timeVal;
      opt.textContent = timeVal;
      timeSel.appendChild(opt);
    });
  }

  // 預設設定為今天與待定
  const today = new Date();
  monthSel.value = today.getMonth() + 1;
  daySel.value = today.getDate();
  timeSel.value = '待定';
}

// 讀取約戰表單內容
function readMatchForm() {
  const monthEl = document.getElementById('match-month');
  const dayEl = document.getElementById('match-day');
  const timeEl = document.getElementById('match-time');
  
  if (monthEl) state.match.month = monthEl.value;
  if (dayEl) state.match.day = dayEl.value;
  if (timeEl) state.match.time = timeEl.value;

  // 地點與店東固定或省略 (不讀取 DOM 以免造成 null crash)
  state.match.location = '大雄家';
  state.match.host = '紅茶';
  
  for (let i = 1; i <= 4; i++) {
    const slotEl = document.getElementById(`slot-${i}`);
    if (slotEl) {
      state.match.slots[i-1] = slotEl.value.trim();
    }
  }
}

// 產生 LINE 約戰範本
function updateLineTemplate() {
  const month = state.match.month;
  const day = state.match.day;
  const timeStr = state.match.time || '19:00';
  const locStr = state.match.location || '大雄家';
  const hostStr = state.match.host || '紅茶';

  // 獲取星期幾
  let dayOfWeekStr = '';
  if (month && day) {
    const currentYear = new Date().getFullYear();
    const dateObj = new Date(currentYear, parseInt(month) - 1, parseInt(day));
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    dayOfWeekStr = ` (週${weekDays[dateObj.getDay()]})`;
  }

  const dateStr = `${month}/${day}`;

  // 報名名單 (預設為 玩家 1, 玩家 2, 玩家 3, 玩家 4)
  const defaultNames = ['玩家 1', '玩家 2', '玩家 3', '玩家 4'];
  let playerList = '';
  for (let i = 1; i <= 4; i++) {
    const name = state.match.slots[i-1] || defaultNames[i-1];
    playerList += `${i}. 👤 ${name}\n`;
  }

  const template = `🎴 **【雀神召集令 ‧ 日日夜戰】** 🎴

📅 時間：${dateStr}${dayOfWeekStr} ${timeStr}
📍 地點：${locStr} (籌碼：撲克牌制)
🍵 店東：${hostStr} (房租由牌桌支付)

👥 目前報名人數：
${playerList}
---
💡 點數規則：
1-10 點數代表金額的 20 倍 ($20 - $200)
J、Q、K 牌代表 15 點 ($300)
大家準時入座，不見不散！`;

  const previewEl = document.getElementById('line-template-text');
  if (previewEl) previewEl.textContent = template;
}

// 點擊按鈕生成範本
function generateLineTemplate() {
  readMatchForm();
  updateLineTemplate();
  // 微縮放動畫
  const preview = document.querySelector('.preview-card');
  if (preview) {
    preview.style.transform = 'scale(1.02)';
    setTimeout(() => {
      preview.style.transform = 'scale(1)';
    }, 200);
  }
}

// 一鍵複製 LINE 範本
function copyLineTemplate() {
  const textEl = document.getElementById('line-template-text');
  if (!textEl) return;
  const text = textEl.textContent;
  copyTextToClipboard(text, '🎉 LINE 約戰範本已複製到剪貼簿，趕快貼去群組吧！');
}

// 帶入玩家至計分區
function importPlayersToCalculator() {
  readMatchForm();
  
  // 帶入玩家姓名
  const defaultNames = ['玩家 1', '玩家 2', '玩家 3', '玩家 4'];
  for (let i = 1; i <= 4; i++) {
    const slotName = state.match.slots[i-1] || defaultNames[i-1];
    state.calc.players[i].name = slotName;
    const inputEl = document.getElementById(`p${i}-name`);
    if (inputEl) inputEl.value = slotName;
  }

  // 嘗試比對店東是誰
  const matchHost = state.match.host || '紅茶';
  if (matchHost) {
    let foundHost = false;
    for (let i = 1; i <= 4; i++) {
      if (state.calc.players[i].name === matchHost) {
        state.calc.hostPlayer = `p${i}`;
        const sel = document.getElementById('calc-host-select');
        if (sel) sel.value = `p${i}`;
        foundHost = true;
        break;
      }
    }
    if (!foundHost) {
      // 若店東不在四人中，則設為外部店東
      state.calc.hostPlayer = 'external';
      const sel = document.getElementById('calc-host-select');
      if (sel) sel.value = 'external';
    }
  }

  updateHostSelection();
  updateHostDropdownOptions();
  updateAllCalculations();
  saveToLocalStorage();

  // 切換到計分頁籤
  switchTab('calc');

  // 動畫反饋
  setTimeout(() => {
    alert('🀄️ 已成功將約戰名單與店東導入記分結算區！');
  }, 100);
}

// 更新店東下拉選單的選項名稱
function updateHostDropdownOptions() {
  const select = document.getElementById('calc-host-select');
  if (select && select.options.length >= 5) {
    select.options[1].text = `玩家 1 (${state.calc.players[1].name})`;
    select.options[2].text = `玩家 2 (${state.calc.players[2].name})`;
    select.options[3].text = `玩家 3 (${state.calc.players[3].name})`;
    select.options[4].text = `玩家 4 (${state.calc.players[4].name})`;
  }
}

// 綁定輸入控制事件
function bindInputs() {
  // 約戰表單事件監聽 (排除已刪除的 DOM，防止 null crash)
  const matchInputs = ['match-month', 'match-day', 'match-time', 'slot-1', 'slot-2', 'slot-3', 'slot-4'];
  matchInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const eventType = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(eventType, () => {
        readMatchForm();
        updateLineTemplate();
      });
    }
  });

  // 記分區玩家姓名輸入同步
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById(`p${i}-name`);
    if (el) {
      el.addEventListener('input', (e) => {
        const defaults = ['', '玩家 1', '玩家 2', '玩家 3', '玩家 4'];
        state.calc.players[i].name = e.target.value || defaults[i];
        updateHostDropdownOptions();
        saveToLocalStorage();
      });
    }
  }

  // 初始買入輸入綁定
  const buyinEl = document.getElementById('calc-initial-buyin');
  if (buyinEl) {
    buyinEl.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      state.calc.initialBuyin = isNaN(val) ? 0 : val;
      updateAllCalculations();
      saveToLocalStorage();
    });
  }
}

// 保存 API Key (實時輸入自動儲存)
function saveApiKey() {
  const keyEl = document.getElementById('gemini-api-key');
  const statusEl = document.getElementById('api-key-status-text');
  if (!keyEl) return;
  const key = keyEl.value.trim();
  localStorage.setItem('gemini_api_key', key);
  
  if (key && key.startsWith('AIzaSy')) {
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerHTML = '✅ 金鑰已自動儲存並開通成功！您可以直接在下方拍照算點數了。';
      statusEl.style.color = '#64dfdf';
    }
  } else if (key === '') {
    if (statusEl) statusEl.style.display = 'none';
  } else {
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerHTML = '⚠️ 金鑰格式似乎不正確，通常為 AIzaSy 開頭。';
      statusEl.style.color = 'var(--accent-danger)';
    }
  }

  // API Key 變動時同步更新手機測試 QR Code (注入金鑰)
  updateMobileQR();
}

// 初始化 API Key 密碼眼睛顯示與載入
function initApiKeyToggle() {
  const keyInput = document.getElementById('gemini-api-key');
  const statusEl = document.getElementById('api-key-status-text');
  
  // 1. 優先檢查網址 Query String 中是否有帶入 key 參數 (?key=AIzaSy...)
  const urlParams = new URLSearchParams(window.location.search);
  const urlKey = urlParams.get('key');
  
  if (urlKey && urlKey.trim().startsWith('AIzaSy')) {
    const cleanKey = urlKey.trim();
    localStorage.setItem('gemini_api_key', cleanKey);
    
    // 2. 為了安全起見與網址美觀，自動將網址後方的 ?key=... 參數抹除，避免使用者後續複製網址分享時外洩金鑰
    try {
      urlParams.delete('key');
      const newSearch = urlParams.toString();
      const newUrl = window.location.origin + window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);
    } catch (e) {
      console.warn('無法抹除網址中的金鑰參數:', e);
    }
    
    // 提示使用者金鑰已成功自動導入
    setTimeout(() => {
      alert('🔑 偵測到網址包含金鑰，已為您自動導入並開通 Gemini Vision AI 功能！');
    }, 300);
  }

  if (keyInput) {
    const key = localStorage.getItem('gemini_api_key') || '';
    keyInput.value = key;
    if (key && key.startsWith('AIzaSy')) {
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.innerHTML = '✅ 金鑰已自動儲存並開通成功！您可以直接在下方拍照算點數了。';
        statusEl.style.color = '#64dfdf';
      }
    }
  }
  // 載入時同步更新手機測試 QR Code
  updateMobileQR();
}

function toggleApiKeyVisibility() {
  const keyInput = document.getElementById('gemini-api-key');
  const btn = document.getElementById('api-key-toggle-btn');
  if (!keyInput || !btn) return;

  if (keyInput.type === 'password') {
    keyInput.type = 'text';
    btn.textContent = '👁️ 隱藏';
  } else {
    keyInput.type = 'password';
    btn.textContent = '👁️ 顯示';
  }
}

// 更新手機測試 QR Code 連線資訊 (自動注入金鑰以達一鍵開通)
function updateMobileQR() {
  const qrImage = document.getElementById('mobile-qr-image');
  const qrLink = document.getElementById('mobile-connect-link');
  if (!qrImage || !qrLink) return;

  const localIp = '192.168.2.61';
  const port = window.location.port || '8000';
  const savedKey = localStorage.getItem('gemini_api_key') || '';
  
  // 動態獲取網址路徑，確保無論是從根目錄啟動還是子目錄啟動，手機端掃碼都能正確連線
  let pathName = '/index.html';
  if (window.location.protocol.startsWith('http')) {
    pathName = window.location.pathname;
    if (pathName.endsWith('/')) {
      pathName += 'index.html';
    }
  } else {
    pathName = '/poker-mahjong-helper/index.html';
  }
  
  let targetUrl = '';
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (window.location.protocol.startsWith('http') && !isLocalhost) {
    // 如果已經是透過某個 IP (如區域網路) 或 GitHub 網址開啟，則直接使用當前網址作為 QR code 連線來源
    targetUrl = window.location.origin + window.location.pathname;
  } else {
    // 否則 (如本機雙擊打開 file:/// 或 localhost)，採用預設的 Wi-Fi 區域網路 IP
    targetUrl = `http://${localIp}:${port}${pathName}`;
  }

  if (savedKey) {
    targetUrl += `?key=${encodeURIComponent(savedKey)}`;
  }

  qrLink.href = targetUrl;
  qrLink.textContent = targetUrl;
  
  // 使用 api.qrserver.com 生成 QR Code 圖片，背景為白、前景為深色，便於相機掃描
  qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(targetUrl)}`;
}

// 更新店東選取與高亮顯示
function updateHostSelection() {
  const hostSelect = document.getElementById('calc-host-select');
  if (!hostSelect) return;
  const hostVal = hostSelect.value;
  state.calc.hostPlayer = hostVal;

  // 移除所有卡片的高亮
  for (let i = 1; i <= 4; i++) {
    const card = document.getElementById(`player-card-${i}`);
    if (card) card.classList.remove('active-host');
  }
  const hostCard = document.getElementById('player-card-_host');
  if (hostCard) hostCard.classList.remove('active-host');

  // 高亮選中的卡片
  if (hostVal.startsWith('p')) {
    const pNum = hostVal.substring(1);
    const card = document.getElementById(`player-card-${pNum}`);
    if (card) card.classList.add('active-host');
  } else if (hostVal === 'external') {
    if (hostCard) hostCard.classList.add('active-host');
  }

  updateAllCalculations();
  saveToLocalStorage();
}

// 觸發相機拍照/檔案上傳
function triggerPhotoCapture(playerNum) {
  const input = document.getElementById(`p${playerNum}-photo-input`);
  if (input) {
    input.click();
  }
}

// 處理上傳照片，轉換成 Base64 並啟動掃描動畫與 API 呼叫
function handlePhotoUpload(playerNum, file) {
  if (!file) return;

  // 啟動綠色雷射掃描動畫與遮罩
  startScanningAnimation(playerNum);

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64Data = e.target.result.split(',')[1];
    const mimeType = file.type;
    
    // 呼叫 Gemini Vision AI 辨識手牌
    callGeminiVisionAPI(base64Data, mimeType, playerNum);
  };
  reader.onerror = function() {
    alert('❌ 讀取圖片檔案失敗，請再試一次。');
    stopScanningAnimation(playerNum);
  };
  reader.readAsDataURL(file);
}

// 啟動雷射掃描狀態
function startScanningAnimation(playerNum) {
  const container = document.getElementById(`p${playerNum}-scan-container`);
  const btn = document.getElementById(`p${playerNum}-scan-btn`);
  
  if (container) container.classList.add('scanning');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '🤖 AI 正在掃描分析中...';
  }
}

// 停止雷射掃描狀態
function stopScanningAnimation(playerNum) {
  const container = document.getElementById(`p${playerNum}-scan-container`);
  const btn = document.getElementById(`p${playerNum}-scan-btn`);
  const input = document.getElementById(`p${playerNum}-photo-input`);
  
  if (container) container.classList.remove('scanning');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = playerNum === '_host' ? '📸 拍照 / 上傳辨識房租牌' : '📸 拍照 / 上傳辨識手牌';
  }
  if (input) {
    input.value = ''; // 清空以允許重複上傳同張照片
  }
}

// 🤖 核心 AI 功能：調用 Gemini Vision API 解析手牌 (支援自動容錯切換)
async function callGeminiVisionAPI(base64Data, mimeType, playerNum) {
  const apiKey = localStorage.getItem('gemini_api_key') || '';
  if (!apiKey) {
    alert('🔑 請先在上方「⚙️ 牌局全域設定」中輸入您的 Gemini API Key！\n\n您可以點擊旁邊的連結免費申請一個，立等可取。');
    stopScanningAnimation(playerNum);
    return;
  }

  // 定義候選的 API 終端節點與模型順序，進行自動容錯切換 (Self-healing Fallbacks)
  const endpoints = [
    {
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
      desc: "Gemini 3.5 Flash (最新 2026 模型)"
    },
    {
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent?key=${apiKey}`,
      desc: "Gemini 3 Flash"
    },
    {
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      desc: "Gemini 2.5 Flash (原始成功模型)"
    },
    {
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      desc: "Gemini 2.0 Flash"
    },
    {
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      desc: "Gemini 1.5 Flash (經典穩定版)"
    },
    {
      url: `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      desc: "Gemini 2.5 Flash (v1 穩定版)"
    },
    {
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
      desc: "Gemini 2.5 Pro (備用高階模型)"
    }
  ];

  const prompt = "Identify every poker card rank visible in this image. Read the number or letter from each card. Return a JSON array of strings. Valid ranks: A,2,3,4,5,6,7,8,9,10,J,Q,K. Return [] if no cards found. No explanation.";

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 0 }
    }
  };

  let lastError = null;
  let success = false;

  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];
    try {
      console.log(`Trying API endpoint [${i + 1}/${endpoints.length}]: ${endpoint.desc}`);
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try {
          const errText = await response.text();
          const errJson = JSON.parse(errText);
          errMsg = errJson.error?.message || errMsg;
        } catch (e) {}
        throw new Error(errMsg);
      }

      const result = await response.json();
      const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!textResponse) {
        throw new Error('未收到 AI 影像分析結果');
      }

      console.log(`Success using endpoint: ${endpoint.desc}`);
      console.log('Gemini AI Response:', textResponse);
      
      let cleanText = textResponse.trim();
      
      // 1. 移除 markdown 的 ```json 或 ``` 標記包裝
      if (cleanText.includes('```')) {
        cleanText = cleanText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
      }
      
      // 2. 尋找陣列定位：如果 AI 回傳了多餘的對話文字，自動擷取第一個 '[' 到最後一個 ']' 之間的內容
      const startIdx = cleanText.indexOf('[');
      const endIdx = cleanText.lastIndexOf(']');
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        cleanText = cleanText.substring(startIdx, endIdx + 1);
      }

      const cardList = JSON.parse(cleanText);
      
      if (Array.isArray(cardList)) {
        // 轉換成牌值對應 (POKER_RULES 鍵值 1..13)
        const mappedCards = cardList.map(label => {
          const cleanLabel = label.toString().toUpperCase().trim();
          if (cleanLabel === 'A') return 1;
          if (cleanLabel === 'J') return 11;
          if (cleanLabel === 'Q') return 12;
          if (cleanLabel === 'K') return 13;
          const num = parseInt(cleanLabel);
          if (!isNaN(num) && num >= 2 && num <= 10) return num;
          return null;
        }).filter(val => val !== null);

        if (mappedCards.length === 0) {
          alert('🤖 AI 掃描已完成，但沒能看清任何撲克牌面。請攤開撲克牌，確保沒有相互重疊，然後平鋪拍照重試！');
        } else {
          // 🔍 二階段驗證：如果偵測到 6，發起第二次 API 專門確認 6 vs 9
          const count6 = mappedCards.filter(v => v === 6).length;
          if (count6 > 0) {
            console.log(`偵測到 ${count6} 張疑似 6 的牌，啟動二階段 6/9 驗證...`);
            try {
              const verifyPrompt = `This image shows ${mappedCards.length} poker cards. I need you to determine exactly how many are 6s and how many are 9s. For EACH card that could be 6 or 9, count the pip symbols (suit icons) in the CENTER of that card's body. A card with 6 pips is a 6. A card with 9 pips is a 9. Return a JSON object like: {"sixes": 2, "nines": 1} indicating the count of 6-cards and 9-cards. If there are no 6s or 9s, return {"sixes": 0, "nines": 0}.`;
              const verifyBody = {
                 contents: [{
                   parts: [
                     { text: verifyPrompt },
                     { inlineData: { mimeType: mimeType, data: base64Data } }
                   ]
                 }],
                 generationConfig: {
                   responseMimeType: "application/json",
                   thinkingConfig: { thinkingBudget: 2048 }
                 }
              };
              const vResp = await fetch(endpoint.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(verifyBody)
              });
              if (vResp.ok) {
                const vResult = await vResp.json();
                let vText = vResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
                vText = vText.trim();
                if (vText.includes('{')) {
                  vText = vText.substring(vText.indexOf('{'), vText.lastIndexOf('}') + 1);
                }
                const counts = JSON.parse(vText);
                const actualNines = counts.nines || 0;
                const actualSixes = counts.sixes || 0;
                console.log(`二階段驗證結果：實際 6=${actualSixes} 張, 9=${actualNines} 張`);
                
                // 計算需要把幾張 6 修正為 9
                const total6and9 = count6 + mappedCards.filter(v => v === 9).length;
                const currentNines = mappedCards.filter(v => v === 9).length;
                const needToFlip = actualNines - currentNines;
                
                if (needToFlip > 0) {
                  let flipped = 0;
                  for (let j = 0; j < mappedCards.length && flipped < needToFlip; j++) {
                    if (mappedCards[j] === 6) {
                      mappedCards[j] = 9;
                      flipped++;
                    }
                  }
                  console.log(`已自動修正 ${flipped} 張 6→9`);
                }
              }
            } catch (verifyErr) {
              console.warn('二階段 6/9 驗證失敗，使用原始結果:', verifyErr.message);
            }
          }

          // 自動替換為 AI 識別出的手牌
          state.calc.players[playerNum].cards = mappedCards;
          renderPlayerCards(playerNum);
          updatePlayerLiveSummary(playerNum);
          updateAllCalculations();
          saveToLocalStorage();
          
          const ownerName = state.calc.players[playerNum].name;
          alert(`🤖 成功辨識！已為【${ownerName}】自動錄入 ${mappedCards.length} 張牌！`);
        }
        success = true;
        break;
      } else {
        throw new Error('回傳資料格式非陣列');
      }
    } catch (error) {
      console.warn(`Endpoint ${endpoint.desc} failed:`, error.message);
      lastError = error;
    }
  }

  if (!success) {
    console.error('All Gemini API endpoints failed:', lastError);
    alert(`❌ 拍照辨識失敗：${lastError.message}\n\n請檢查您的 API Key 是否正確、網路連線是否暢通，或請將牌平鋪重新拍照！`);
  }

  stopScanningAnimation(playerNum);
}

// 從玩家手牌刪除指定 index 的牌
function removeCardAtIndex(playerNum, index) {
  state.calc.players[playerNum].cards.splice(index, 1);
  renderPlayerCards(playerNum);
  updatePlayerLiveSummary(playerNum);
  updateAllCalculations();
  saveToLocalStorage();
}

// 清除玩家手牌
function clearPlayerCards(playerNum) {
  state.calc.players[playerNum].cards = [];
  renderPlayerCards(playerNum);
  updatePlayerLiveSummary(playerNum);
  updateAllCalculations();
  saveToLocalStorage();
}

// 渲染玩家的手牌明細徽章
function renderPlayerCards(playerNum) {
  const display = document.getElementById(`p${playerNum}-inventory-display`);
  if (!display) return;
  
  const cards = state.calc.players[playerNum].cards;

  if (cards.length === 0) {
    display.innerHTML = playerNum === '_host' ? `<span class="empty-tip">📸 尚無房租牌，請拍照或上傳撲克牌辨識</span>` : `<span class="empty-tip">📸 尚無手牌，請拍照或上傳撲克牌辨識</span>`;
    return;
  }

  // 排序：JQK 在後，數字牌在前
  const sortedCards = [...cards].sort((a, b) => {
    const valA = POKER_RULES[a].points === 15 ? 11 + a : a;
    const valB = POKER_RULES[b].points === 15 ? 11 + b : b;
    return valA - valB;
  });

  display.innerHTML = '';
  sortedCards.forEach((cardVal) => {
    const rule = POKER_RULES[cardVal];
    const isJQK = rule.points === 15;
    const is6or9 = (cardVal === 6 || cardVal === 9);
    const badge = document.createElement('span');
    badge.className = `card-badge ${isJQK ? 'jqk-badge' : ''} ${is6or9 ? 'flip-hint' : ''}`;
    badge.textContent = is6or9 ? `${rule.label} 🔄` : rule.label;
    badge.title = is6or9 ? '點擊切換 6↔9，點擊右側 × 刪除' : '點擊移除此牌';
    badge.onclick = () => {
      const realIndex = cards.indexOf(cardVal);
      if (realIndex > -1) {
        if (is6or9) {
          // 6↔9 切換
          cards[realIndex] = (cardVal === 6) ? 9 : 6;
          renderPlayerCards(playerNum);
          updatePlayerLiveSummary(playerNum);
          updateAllCalculations();
          saveToLocalStorage();
        } else {
          removeCardAtIndex(playerNum, realIndex);
        }
      }
    };

    // 新增獨立的刪除按鈕
    const deleteBtn = document.createElement('span');
    deleteBtn.className = 'card-badge-delete';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.title = '刪除此牌';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      const realIndex = cards.indexOf(cardVal);
      if (realIndex > -1) {
        removeCardAtIndex(playerNum, realIndex);
      }
    };
    badge.appendChild(deleteBtn);
    display.appendChild(badge);
  });
}

// 計算單個玩家的點數與金額
function getPlayerScore(playerNum) {
  const player = state.calc.players[playerNum];
  if (!player) return { points: 0, money: 0 };
  
  let points = 0;
  player.cards.forEach(cardVal => {
    if (POKER_RULES[cardVal]) {
      points += POKER_RULES[cardVal].points;
    }
  });
  
  const money = points * POINT_MULTIPLIER;
  return { points, money };
}

// 更新單個玩家的即時預覽數值
function updatePlayerLiveSummary(playerNum) {
  const score = getPlayerScore(playerNum);
  const ptsEl = document.getElementById(`p${playerNum}-total-points`);
  const moneyEl = document.getElementById(`p${playerNum}-total-money`);
  
  if (ptsEl) ptsEl.textContent = score.points;
  if (moneyEl) moneyEl.textContent = `$${score.money}`;
}

// 更新全域所有數值
function updateAllCalculations() {
  let totalCardsCount = 0;
  let totalPointsSum = 0;

  for (let i = 1; i <= 4; i++) {
    updatePlayerLiveSummary(i);
    totalCardsCount += state.calc.players[i].cards.length;
    totalPointsSum += getPlayerScore(i).points;
  }
  updatePlayerLiveSummary('_host');
  totalCardsCount += state.calc.players['_host'].cards.length;
  totalPointsSum += getPlayerScore('_host').points;

  // 更新即時計數器 DOM
  const liveCardsEl = document.getElementById('live-total-cards');
  const livePointsEl = document.getElementById('live-total-points');
  if (liveCardsEl) {
    liveCardsEl.textContent = totalCardsCount;
    liveCardsEl.style.color = (totalCardsCount === 52) ? 'var(--accent-mint)' : 'var(--accent-gold)';
  }
  if (livePointsEl) {
    livePointsEl.textContent = totalPointsSum;
    livePointsEl.style.color = (totalPointsSum === 400) ? 'var(--accent-mint)' : 'var(--accent-gold)';
  }
}

// 重置整將資料
function resetAllCalculatorData() {
  showCustomConfirm('⚠️ 確定重置資料？', '確定要重置目前這一將的所有分數與手牌資料嗎？這將會清除所有暫存資料喔！', () => {
    state.calc.players = {
      1: { name: state.calc.players[1].name || '玩家 1', cards: [] },
      2: { name: state.calc.players[2].name || '玩家 2', cards: [] },
      3: { name: state.calc.players[3].name || '玩家 3', cards: [] },
      4: { name: state.calc.players[4].name || '玩家 4', cards: [] },
      '_host': { name: '店東房租', cards: [] }
    };

    // 重置 DOM 輸入值
    for (let i = 1; i <= 4; i++) {
      renderPlayerCards(i);
      updatePlayerLiveSummary(i);
    }
    renderPlayerCards('_host');
    updatePlayerLiveSummary('_host');

    // 隱藏結算區
    const resultArea = document.getElementById('settlement-result-area');
    if (resultArea) resultArea.style.display = 'none';

    updateAllCalculations();
    saveToLocalStorage();
  });
}

// 🏆 核心邏輯：一鍵結算牌局並生成最少轉帳路徑
function calculateSettlement() {
  updateAllCalculations();

  const hostVal = state.calc.hostPlayer;
  const initialBuyinPoints = state.calc.initialBuyin;
  const initialBuyinMoney = initialBuyinPoints * POINT_MULTIPLIER; // 初始買入台幣

  // 驗證是否選擇店東
  if (hostVal === 'none') {
    showCustomAlert('🍵 請選擇店東', '結算前請先選擇本局的「店東」！這會關係到店東房租的最終支付流向。', () => {
      const sel = document.getElementById('calc-host-select');
      if (sel) sel.focus();
    });
    return;
  }

  // 獲取店東房租資料
  const hostScore = getPlayerScore('_host');
  const totalRentFund = hostScore.money; // 店東房租台幣金額

  // 1. 驗證整副牌的張數與點數（52張/400點）
  let totalCardsCount = 0;
  let totalPointsSum = 0;
  for (let i = 1; i <= 4; i++) {
    totalCardsCount += state.calc.players[i].cards.length;
    totalPointsSum += getPlayerScore(i).points;
  }
  totalCardsCount += state.calc.players['_host'].cards.length;
  totalPointsSum += hostScore.points;

  if (totalCardsCount !== 52 || totalPointsSum !== 400) {
    const cardDiff = 52 - totalCardsCount;
    const pointDiff = 400 - totalPointsSum;
    
    let warningMsg = `目前錄入的總卡片統計與標準牌組（52張/400點）不符：<br><br>`;
    warningMsg += `📌 總張數：<strong>${totalCardsCount}</strong> 張 (標準應為 52 張，目前 ${cardDiff > 0 ? `少了 ${cardDiff} 張` : `多了 ${Math.abs(cardDiff)} 張`})<br>`;
    warningMsg += `📌 總點數：<strong>${totalPointsSum}</strong> 點 (標準應為 400 點，目前 ${pointDiff > 0 ? `少了 ${pointDiff} 點` : `多了 ${Math.abs(pointDiff)} 點`})<br><br>`;
    warningMsg += `這代表撲克牌有重疊、漏拍或 AI 解析錯誤！建議您返回檢查並透過手牌區修正。<br>`;
    warningMsg += `（提示：點擊手牌區 6/9 可以快速切換，點擊 × 可刪除該牌）<br><br>`;
    warningMsg += `請問您是否要<strong>【強制進行結算】</strong>？(強制結算帳目可能不平衡)`;
    
    showCustomConfirm('⚠️ 結算防呆對帳警告', warningMsg, () => {
      executeSettlementCalculation(hostVal, initialBuyinMoney, hostScore, totalRentFund, totalCardsCount, totalPointsSum);
    });
    return;
  }

  // 完美對帳，直接結算
  executeSettlementCalculation(hostVal, initialBuyinMoney, hostScore, totalRentFund, totalCardsCount, totalPointsSum);
}

// 實際執行結算數據計算與 UI 渲染
function executeSettlementCalculation(hostVal, initialBuyinMoney, hostScore, totalRentFund, totalCardsCount, totalPointsSum) {
  // 渲染頁面上的驗證 Banner
  const verifyBanner = document.getElementById('settlement-verify-banner');
  if (verifyBanner) {
    const isPerfect = (totalCardsCount === 52 && totalPointsSum === 400);
    verifyBanner.className = `settlement-verify-banner ${isPerfect ? 'verify-success' : 'verify-warning'}`;
    if (isPerfect) {
      verifyBanner.innerHTML = `<span>✅ 完美驗證：全牌組共 52 張卡片、總點數 400 點，帳目 100% 精準平衡！</span>`;
    } else {
      const cardDiff = 52 - totalCardsCount;
      const pointDiff = 400 - totalPointsSum;
      const cardText = cardDiff === 0 ? '52張正確' : `${totalCardsCount}張 (差 ${cardDiff > 0 ? `-${cardDiff}` : `+${Math.abs(cardDiff)}`})`;
      const pointText = pointDiff === 0 ? '400點正確' : `${totalPointsSum}點 (差 ${pointDiff > 0 ? `-${pointDiff}` : `+${Math.abs(pointDiff)}`})`;
      verifyBanner.innerHTML = `<span>⚠️ 對帳不符警告：目前僅錄入共 ${cardText}、${pointText}。請核對實體撲克牌！</span>`;
    }
  }

  // 結帳才以最後一將分東南西北玩家
  const windDirections = { 1: '東風', 2: '南風', 3: '西風', 4: '北風' };

  // 整理 4 位玩家的結算數據
  let playerData = [];
  let totalCardsMoney = 0; // 四人最後牌面折算總金額
  
  for (let i = 1; i <= 4; i++) {
    const player = state.calc.players[i];
    const score = getPlayerScore(i);
    totalCardsMoney += score.money;

    playerData.push({
      id: i,
      name: player.name,
      wind: windDirections[i],
      cardsPoints: score.points,
      cardsMoney: score.money,
      initialMoney: initialBuyinMoney,
      finalBalance: 0,   // 最後淨賺賠值
      netValue: 0        // 用於分帳演算法
    });
  }

  // 對帳驗證：四人手牌的總金額 + 店東房租，是否等於四人買入的總金額？
  const expectedTotalMoney = initialBuyinMoney * 4;
  const discrepancy = (totalCardsMoney + totalRentFund) - expectedTotalMoney;

  // 計算每個玩家的最終「淨輸贏值 (Net Balance)」
  playerData.forEach(p => {
    p.finalBalance = p.cardsMoney - p.initialMoney;
  });

  // 如果店東是四人之一，將店東房租自動歸併加給他
  let externalHostFund = 0;
  if (hostVal.startsWith('p')) {
    const hostNum = parseInt(hostVal.substring(1));
    playerData.forEach(p => {
      if (p.id === hostNum) {
        p.finalBalance += totalRentFund;
      }
    });
  } else if (hostVal === 'external') {
    externalHostFund = totalRentFund;
  }

  playerData.forEach(p => {
    p.netValue = p.finalBalance;
  });

  // 渲染收支明細表
  const tbody = document.getElementById('settlement-table-body');
  if (tbody) {
    tbody.innerHTML = '';
    playerData.forEach(p => {
      const row = document.createElement('tr');
      const hostSuffix = (hostVal === `p${p.id}`) ? ' 🍵 (店東)' : '';
      const balanceClass = p.finalBalance > 0 ? 'net-positive' : (p.finalBalance < 0 ? 'net-negative' : '');
      const balanceSign = p.finalBalance > 0 ? '+$' : (p.finalBalance < 0 ? '-$' : '$');
      const balanceValStr = Math.abs(p.finalBalance);

      row.innerHTML = `
        <td><strong>${p.name}</strong> <span style="font-size: 0.85em; opacity: 0.8;">(${p.wind})</span>${hostSuffix}</td>
        <td>${p.cardsPoints} 點</td>
        <td>$${p.initialMoney}</td>
        <td class="${balanceClass}">${balanceSign}${balanceValStr}</td>
      `;
      tbody.appendChild(row);
    });

    // 追加店東房租到表格顯示中
    if (totalRentFund > 0 || hostVal === 'external') {
      const row = document.createElement('tr');
      const balanceClass = totalRentFund > 0 ? 'net-positive' : '';
      const balanceSign = totalRentFund > 0 ? '+$' : '$';
      
      row.innerHTML = `
        <td><strong>🍵 店東房租</strong></td>
        <td>${hostScore.points} 點</td>
        <td>$0</td>
        <td class="${balanceClass}">${balanceSign}${totalRentFund}</td>
      `;
      tbody.appendChild(row);
    }
  }

  // 3. 💸 執行轉帳最簡化分帳演算法 (Min-cash-flow algorithm)
  let participants = [];
  playerData.forEach(p => {
    participants.push({ name: `${p.name} (${p.wind})`, amount: p.netValue });
  });

  if (externalHostFund > 0) {
    participants.push({ name: '🍵 店東 (紅茶)', amount: externalHostFund }); 
  }

  // 整理分帳資料
  let debtors = participants.filter(x => x.amount < 0).sort((a, b) => a.amount - b.amount); 
  let creditors = participants.filter(x => x.amount > 0).sort((a, b) => b.amount - a.amount); 

  debtors = debtors.map(d => ({ ...d }));
  creditors = creditors.map(c => ({ ...c }));

  let transferFlows = [];
  let dIdx = 0, cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    let debtor = debtors[dIdx];
    let creditor = creditors[cIdx];

    let debtAmt = Math.abs(debtor.amount);
    let creditAmt = creditor.amount;

    let transferAmt = Math.min(debtAmt, creditAmt);
    
    if (transferAmt > 0.1) { 
      transferFlows.push({
        from: debtor.name,
        to: creditor.name,
        amount: Math.round(transferAmt)
      });
    }

    debtor.amount += transferAmt;
    creditor.amount -= transferAmt;

    if (Math.abs(debtor.amount) < 0.1) dIdx++;
    if (Math.abs(creditor.amount) < 0.1) cIdx++;
  }

  // 渲染最佳轉帳建議路徑
  const flowList = document.getElementById('settlement-flow-list');
  if (flowList) {
    flowList.innerHTML = '';
    if (transferFlows.length === 0) {
      flowList.innerHTML = `<li>🀄️ 大家剛好平手，沒有人需要轉帳！太神奇了！</li>`;
    } else {
      transferFlows.forEach(f => {
        const li = document.createElement('li');
        li.innerHTML = `
          <span class="flow-from">${f.from}</span>
          <span>👉 轉帳給</span>
          <span class="flow-to">${f.to}</span>
          <span class="flow-amt">$${f.amount}</span>
        `;
        flowList.appendChild(li);
      });
    }
  }

  // 渲染店東實收公積金提示
  const hostNoteBox = document.getElementById('host-final-collect-box');
  if (hostNoteBox) {
    let hostNameText = '';
    if (hostVal.startsWith('p')) {
      const hostP = state.calc.players[parseInt(hostVal.substring(1))];
      const hostWind = windDirections[parseInt(hostVal.substring(1))];
      hostNameText = `<strong>${hostP.name} (${hostWind})</strong>`;
    } else {
      hostNameText = `<strong>店東 (紅茶)</strong>`;
    }

    let hostPotTip = `🍵 <b>店東房租辨識對帳提醒</b>：<br>
                  店東專屬房租牌累計辨識 <strong>${hostScore.points}</strong> 點。<br>
                  店東應收房租折合台幣：<strong>$${totalRentFund}</strong> 元。<br>
                  本場房租已完全參與零和分帳結算。大家直接依照上方的轉帳建議路徑進行轉帳支付即可！`;

    // 對帳警示
    let discrepancyTip = '';
    if (discrepancy !== 0) {
      const absDisc = Math.abs(discrepancy);
      const discPoints = absDisc / POINT_MULTIPLIER;
      const direction = discrepancy > 0 ? '多了' : '少了';
      discrepancyTip = `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed rgba(229,169,59,0.3); color: var(--accent-danger);">
                         ⚠️ <b>對帳警報</b>：四人手牌點數總計 + 店東房租牌點數比初始買入總金額 <b>${direction} $${absDisc} 元</b> (${discPoints}點)！<br>
                         可能原因：有撲克牌漏算、點數解析錯誤，或照片中牌面有遮擋。請檢查五張手牌與房租牌的實體撲克牌！
                       </div>`;
    }

    hostNoteBox.innerHTML = hostPotTip + discrepancyTip;
  }

  // 4. 📱 生成 LINE 結算分享戰報
  let sortedByProfit = [...playerData].sort((a, b) => b.finalBalance - a.finalBalance);
  const mvp = sortedByProfit[0];
  const loser = sortedByProfit[3];
  
  // 隨機幽默話術資料庫
  const mvpSlogans = [
    "實至名規，今晚宵夜你請客！🍗",
    "手氣紅到擋不住，雀神附體！🔥",
    "大開殺戒，晚餐可以無痛加雞腿了！🍱",
    "今晚做夢都會笑醒吧！💰",
    "運氣來了，連城牆都擋不住！🏰",
    "氣勢如虹，簡直是撲克界的梅西！⚽",
    "這手氣難道是偷偷去拜了財神爺？🙏"
  ];
  
  const loserSlogans = [
    "大義滅親，感謝大哥為生態做出的卓越貢獻！🌳",
    "功德無量，今晚的大家都是托您的福！🕊️",
    "沒關係，留得青山在，下半將贏回來！⛰️",
    "默默承受了一切，你才是真正的英雄！🦸‍♂️",
    "繳點學費而已，下次換你大殺四方！⚔️",
    "主動幫大家試水溫，格局真的太大了！🌊",
    "這是一次戰術性儲值，下局必定加倍奉還！💳"
  ];
  
  const cardroomQuotes = [
    "🎴 雀神閣語錄：『打牌不怕輸，就怕對帳不舒服。』",
    "🎴 雀神閣語錄：『手氣差只是一時的，對帳對得準是一世的。』",
    "🎴 雀神閣語錄：『店東茶水費，是維持友誼的最佳潤滑劑。』",
    "🎴 雀神閣語錄：『今晚大贏的人，明天記得要在群組發紅包喔！』",
    "🎴 雀神閣語錄：『打牌是休閒，對帳是專業，我們只做最專業的！』",
    "🎴 雀神閣語錄：『牌桌上沒有永遠的贏家，只有永遠的對帳單。』",
    "🎴 雀神閣語錄：『摸到好牌是運氣，把帳算對是骨氣！』"
  ];

  const randomMvp = mvpSlogans[Math.floor(Math.random() * mvpSlogans.length)];
  const randomLoser = loserSlogans[Math.floor(Math.random() * loserSlogans.length)];
  const randomQuote = cardroomQuotes[Math.floor(Math.random() * cardroomQuotes.length)];
  
  let mvpText = '';
  if (mvp.finalBalance > 0) {
    mvpText = `👑 【本日雀神 (MVP)】：✨ ${mvp.name} (${mvp.wind}) ✨ (大贏 +$${mvp.finalBalance} 元！)\n💬 雀神說：${randomMvp}\n`;
  } else {
    mvpText = `🤝 大夥溫和娛樂，今天無人大贏！\n`;
  }

  let loserText = '';
  if (loser.finalBalance < 0) {
    loserText = `💸 【慈善撲克王】：🤡 ${loser.name} (${loser.wind}) 🤡 (今日功德無量 -$${Math.abs(loser.finalBalance)} 元)\n💬 悄悄話：${randomLoser}\n`;
  }

  let lineSettlement = `🀄️ **【雀神閣 ‧ 牌局大結算戰報】** 🀄️\n\n📊 **玩家收支最終明細**：\n`;

  playerData.forEach(p => {
    const sign = p.finalBalance > 0 ? '+' : (p.finalBalance < 0 ? '-' : ' ');
    const amt = Math.abs(p.finalBalance);
    lineSettlement += `* 👤 ${p.name} (${p.wind})：手牌 ${p.cardsPoints}點 ➔ 最終淨盈虧 ${sign}$${amt}\n`;
  });

  lineSettlement += `\n🍵 **店東房租明細**：\n* 實收房租：${hostScore.points}點 ➔ 換算台幣金額：$${totalRentFund} 元\n`;

  const isPerfectDeck = (totalCardsCount === 52 && totalPointsSum === 400);
  const deckVerifyText = isPerfectDeck 
    ? `✅ 完美驗證：整副牌組共 52 張、點數 400 點，帳目 100% 精準平衡！`
    : `⚠️ 對帳警告：目前僅錄入共 ${totalCardsCount} 張牌、總點數 ${totalPointsSum} 點 (標準應為 52 張/400 點)，請核對實體牌！`;

  lineSettlement += `\n🔍 **牌組完整度驗證**：\n* ${deckVerifyText}\n\n💸 **最佳轉帳建議 (省去二度轉帳，直接付這筆即可)**：\n`;

  if (transferFlows.length === 0) {
    lineSettlement += `* 大家大平手，沒有人需要轉帳！\n`;
  } else {
    transferFlows.forEach(f => {
      lineSettlement += `* ${f.from} 👉 轉帳 $${f.amount} 元 給 【${f.to}】\n`;
    });
  }

  lineSettlement += `\n${mvpText}${loserText}\n${randomQuote}\n\n🎴 感謝大家的參與！期待下一將再戰！`;

  const textEl = document.getElementById('line-settlement-text');
  if (textEl) textEl.textContent = lineSettlement;

  const resultArea = document.getElementById('settlement-result-area');
  if (resultArea) {
    resultArea.style.display = 'block';
    setTimeout(() => {
      resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }
}

// 複製結算戰報
function copySettlementReport() {
  const textEl = document.getElementById('line-settlement-text');
  if (!textEl) return;
  const text = textEl.textContent;
  copyTextToClipboard(text, '🎉 雀神大結算戰報已複製！趕快貼回 LINE 群組向大家報告盈虧吧！');
}

// 通用剪貼簿複製函數
function copyTextToClipboard(text, successMsg) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      alert(successMsg);
    }).catch(err => {
      console.warn('Navigator clipboard failed, trying fallback...', err);
      fallbackCopyText(text, successMsg);
    });
  } else {
    fallbackCopyText(text, successMsg);
  }
}

// 備用複製方案
function fallbackCopyText(text, successMsg) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  const range = document.createRange();
  range.selectNodeContents(textArea);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  textArea.setSelectionRange(0, 999999);
  
  try {
    const successful = document.execCommand('copy');
    if (successful) {
      alert(successMsg);
    } else {
      alert('⚠️ 複製失敗，請手動長按預覽文字進行複製。');
    }
  } catch (err) {
    console.error('Fallback copy failed: ', err);
    alert('⚠️ 複製失敗，請手動長按預覽文字進行複製。');
  }
  document.body.removeChild(textArea);
}

// 保存至 LocalStorage
function saveToLocalStorage() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

// 從 LocalStorage 載入資料
function loadFromLocalStorage() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlKey = urlParams.get('key');
  if (urlKey && urlKey.trim().startsWith('AIzaSy')) {
    localStorage.setItem('gemini_api_key', urlKey.trim());
    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.replaceState({ path: cleanUrl }, '', cleanUrl);

    // 提示使用者金鑰已成功自動導入
    setTimeout(() => {
      showCustomAlert('🔑 金鑰導入成功', '系統已為您自動導入 API 金鑰並開通 Gemini Vision AI 功能！<br>現在您可以使用手機相機拍照，自動辨識四人手牌與店東房租牌囉！🀄️');
    }, 500);
  }

  const saved = localStorage.getItem(STATE_KEY);
  if (!saved) return;
  
  try {
    const parsed = JSON.parse(saved);
    if (parsed.match) {
      state.match = { ...state.match, ...parsed.match };
      
      const monthEl = document.getElementById('match-month');
      const dayEl = document.getElementById('match-day');
      const timeEl = document.getElementById('match-time');
      if (monthEl && state.match.month) monthEl.value = state.match.month;
      if (dayEl && state.match.day) dayEl.value = state.match.day;
      if (timeEl && state.match.time) timeEl.value = state.match.time;
      
      for (let i = 1; i <= 4; i++) {
        const slotEl = document.getElementById(`slot-${i}`);
        if (slotEl) slotEl.value = state.match.slots[i-1] || '';
      }
    }
    
    if (parsed.calc) {
      state.calc.hostPlayer = parsed.calc.hostPlayer || 'none';
      state.calc.initialBuyin = parsed.calc.initialBuyin || 100;
      
      if (parsed.calc.players) {
        for (let key in parsed.calc.players) {
          if (state.calc.players[key]) {
            state.calc.players[key].name = parsed.calc.players[key].name || state.calc.players[key].name;
            state.calc.players[key].cards = parsed.calc.players[key].cards || [];
          }
        }
      }
      
      if (document.getElementById('calc-host-select')) {
        document.getElementById('calc-host-select').value = state.calc.hostPlayer;
      }
      if (document.getElementById('calc-initial-buyin')) {
        document.getElementById('calc-initial-buyin').value = state.calc.initialBuyin;
      }
      
      for (let i = 1; i <= 4; i++) {
        const nameEl = document.getElementById(`p${i}-name`);
        if (nameEl) nameEl.value = state.calc.players[i].name;
      }
    }
  } catch (e) {
    console.error('Error loading state from localStorage:', e);
  }
}

// 頁籤切換
function switchTab(tabName) {
  const tabs = ['match', 'calc'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`);
    const content = document.getElementById(`tab-${t}`);
    
    if (t === tabName) {
      if (btn) btn.classList.add('active');
      if (content) content.classList.add('active-content');
    } else {
      if (btn) btn.classList.remove('active');
      if (content) content.classList.remove('active-content');
    }
  });
}

// 切換顯示/隱藏進階 API 與手機連線設定
function toggleAdvancedSettings() {
  const block = document.getElementById('advanced-settings-block');
  if (block) {
    if (block.style.display === 'none') {
      block.style.display = 'block';
      setTimeout(() => {
        block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    } else {
      block.style.display = 'none';
    }
  }
}

// 🏆 Premium 訂製對話框與確認框 (解決 LINE 內建瀏覽器阻擋 alert / confirm 的 Bug)
function showCustomAlert(title, message, callback) {
  const overlay = document.getElementById('custom-modal-overlay');
  const titleEl = document.getElementById('custom-modal-title');
  const messageEl = document.getElementById('custom-modal-message');
  const actionsEl = document.getElementById('custom-modal-actions');
  
  if (!overlay || !titleEl || !messageEl || !actionsEl) {
    alert(message.replace(/<br>/g, '\n').replace(/<\/?[^>]+(>|$)/g, ""));
    if (callback) callback();
    return;
  }

  titleEl.innerHTML = title;
  messageEl.innerHTML = message;
  
  actionsEl.innerHTML = '';
  const btn = document.createElement('button');
  btn.className = 'custom-modal-btn custom-modal-btn-confirm';
  btn.textContent = '確定';
  btn.onclick = () => {
    overlay.classList.remove('modal-active');
    if (callback) callback();
  };
  actionsEl.appendChild(btn);
  
  overlay.classList.add('modal-active');
}

function showCustomConfirm(title, message, onConfirm, onCancel) {
  const overlay = document.getElementById('custom-modal-overlay');
  const titleEl = document.getElementById('custom-modal-title');
  const messageEl = document.getElementById('custom-modal-message');
  const actionsEl = document.getElementById('custom-modal-actions');
  
  if (!overlay || !titleEl || !messageEl || !actionsEl) {
    const result = confirm(message.replace(/<br>/g, '\n').replace(/<\/?[^>]+(>|$)/g, ""));
    if (result) {
      if (onConfirm) onConfirm();
    } else {
      if (onCancel) onCancel();
    }
    return;
  }

  titleEl.innerHTML = title;
  messageEl.innerHTML = message;
  
  actionsEl.innerHTML = '';
  
  const btnCancel = document.createElement('button');
  btnCancel.className = 'custom-modal-btn custom-modal-btn-cancel';
  btnCancel.textContent = '取消';
  btnCancel.onclick = () => {
    overlay.classList.remove('modal-active');
    if (onCancel) onCancel();
  };
  
  const btnConfirm = document.createElement('button');
  btnConfirm.className = 'custom-modal-btn custom-modal-btn-confirm';
  btnConfirm.textContent = '確定';
  btnConfirm.onclick = () => {
    overlay.classList.remove('modal-active');
    if (onConfirm) onConfirm();
  };
  
  actionsEl.appendChild(btnCancel);
  actionsEl.appendChild(btnConfirm);
  
  overlay.classList.add('modal-active');
}
