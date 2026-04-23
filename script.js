// ========== KONFIGURASI SUPABASE ==========
// GANTI DENGAN ANON KEY ANDA!
const SUPABASE_URL = "https://ccivfvgxpzcjlpoozrwf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjaXZmdmd4cHpjamxwb296cndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MTI3NTAsImV4cCI6MjA5MjQ4ODc1MH0.aSFzrn9dCLlstV2RqrS3DkEBjIYVbe71y4G90DT5RUU";  // <-- GANTI INI!

// Inisialisasi Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("Supabase initialized:", supabase);

/* ---- State ---- */
let currentUser = "";
let allFiles = [];
let deleteTarget = null;

/* ---- DOM Refs ---- */
const $ = (id) => document.getElementById(id);

const loginScreen = $("login-screen");
const loginInput = $("login-input");
const loginBtn = $("login-btn");
const app = $("app");
const userAvatar = $("user-avatar");
const userNameDisplay = $("user-name-display");
const logoutBtn = $("logout-btn");
const statTotal = $("stat-total");
const statSize = $("stat-size");
const statUsers = $("stat-users");
const dropZone = $("drop-zone");
const fileInput = $("file-input");
const uploadIdle = $("upload-idle");
const uploadProgress = $("upload-progress");
const uploadLabel = $("upload-label");
const progressBar = $("progress-bar");
const searchInput = $("search-input");
const searchClear = $("search-clear");
const fileList = $("file-list");
const emptyState = $("empty-state");
const previewModal = $("preview-modal");
const previewFilename = $("preview-filename");
const previewContent = $("preview-content");
const previewClose = $("preview-close");
const deleteModal = $("delete-modal");
const deleteFilename = $("delete-filename");
const deleteCancel = $("delete-cancel");
const deleteConfirm = $("delete-confirm");
const toast = $("toast");
const statusText = $("status-text");

/* ============================================================
   HELPERS
   ============================================================ */

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function showToast(msg, type = "success") {
  if (!toast) return;
  toast.textContent = (type === "error" ? "❌ " : "✅ ") + msg;
  toast.className = `toast ${type}`;
  toast.classList.remove("hidden");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add("hidden"), 3000);
}

/* ============================================================
   LOGIN FUNCTION (DISEDERHANAKAN)
   ============================================================ */

function login() {
  const name = loginInput.value.trim();
  console.log("Login clicked, name:", name);
  
  if (!name) {
    showToast("Masukkan nama dulu!", "error");
    return;
  }
  
  currentUser = name;
  localStorage.setItem("cloudshare-user", currentUser);
  
  loginScreen.classList.add("hidden");
  app.classList.remove("hidden");
  
  userAvatar.textContent = name[0].toUpperCase();
  userNameDisplay.textContent = name;
  
  showToast(`Selamat datang, ${name}!`);
  
  // Load dummy files dulu untuk test
  allFiles = [];
  renderFiles();
  updateStats();
  
  if (statusText) {
    statusText.innerHTML = "✅ Mode Demo - Koneksi Supabase menyusul";
  }
}

function logout() {
  currentUser = "";
  localStorage.removeItem("cloudshare-user");
  allFiles = [];
  app.classList.add("hidden");
  loginScreen.classList.remove("hidden");
  loginInput.value = "";
  loginBtn.disabled = true;
}

function renderFiles() {
  if (!fileList) return;
  
  const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const filtered = query
    ? allFiles.filter(f => f.name.toLowerCase().includes(query))
    : allFiles;
  
  fileList.innerHTML = "";
  
  if (filtered.length === 0) {
    if (emptyState) emptyState.classList.remove("hidden");
    return;
  }
  
  if (emptyState) emptyState.classList.add("hidden");
  
  filtered.forEach((file) => {
    const card = document.createElement("div");
    card.className = "file-card";
    card.innerHTML = `
      <div class="file-thumb">📄</div>
      <div class="file-info">
        <div class="file-name">${file.name}</div>
        <div class="file-meta">${formatSize(file.size)}</div>
      </div>
    `;
    fileList.appendChild(card);
  });
}

function updateStats() {
  if (statTotal) statTotal.textContent = allFiles.length;
  if (statSize) statSize.textContent = formatSize(allFiles.reduce((a, f) => a + f.size, 0));
  if (statUsers) statUsers.textContent = "1";
}

function checkSavedUser() {
  const savedUser = localStorage.getItem("cloudshare-user");
  if (savedUser) {
    currentUser = savedUser;
    loginScreen.classList.add("hidden");
    app.classList.remove("hidden");
    userAvatar.textContent = currentUser[0].toUpperCase();
    userNameDisplay.textContent = currentUser;
    renderFiles();
    updateStats();
  }
}

/* ============================================================
   EVENT LISTENERS
   ============================================================ */

if (loginInput) {
  loginInput.addEventListener("input", () => {
    if (loginBtn) loginBtn.disabled = !loginInput.value.trim();
  });
  
  loginInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") login();
  });
}

if (loginBtn) {
  loginBtn.addEventListener("click", login);
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", logout);
}

// Upload zone sederhana
if (dropZone && fileInput) {
  dropZone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      allFiles.unshift({
        id: Date.now(),
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedBy: currentUser,
        uploadedAt: new Date().toISOString()
      });
    });
    renderFiles();
    updateStats();
    showToast(`${files.length} file ditambahkan (demo mode)`);
  });
}

// Search
if (searchInput) {
  searchInput.addEventListener("input", () => {
    if (searchClear) searchClear.classList.toggle("hidden", !searchInput.value);
    renderFiles();
  });
}

if (searchClear) {
  searchClear.addEventListener("click", () => {
    searchInput.value = "";
    searchClear.classList.add("hidden");
    renderFiles();
  });
}

// Initialize
checkSavedUser();

console.log("App initialized! Tombol masuk seharusnya bisa diklik.");
