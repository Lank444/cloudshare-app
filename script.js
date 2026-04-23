/* ============================================================
   CloudShare — Shared Cloud Storage with Supabase
   ============================================================ */

// ========== KONFIGURASI SUPABASE ==========
// GANTI DENGAN CREDENTIAL SUPABASE ANDA!
const SUPABASE_URL = "https://ccivfvgxpzcjlpoozrwf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjaXZmdmd4cHpjamxwb296cndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MTI3NTAsImV4cCI6MjA5MjQ4ODc1MH0.aSFzrn9dCLlstV2RqrS3DkEBjIYVbe71y4G90DT5RUU";

// Inisialisasi Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ---- State ---- */
let currentUser = "";
let allFiles    = [];
let deleteTarget = null;
let syncInterval = null;

/* ---- DOM Refs ---- */
const $ = (id) => document.getElementById(id);

const loginScreen     = $("login-screen");
const loginInput      = $("login-input");
const loginBtn        = $("login-btn");

const app             = $("app");
const userAvatar      = $("user-avatar");
const userNameDisplay = $("user-name-display");
const logoutBtn       = $("logout-btn");

const statTotal       = $("stat-total");
const statSize        = $("stat-size");
const statUsers       = $("stat-users");

const dropZone        = $("drop-zone");
const fileInput       = $("file-input");
const uploadIdle      = $("upload-idle");
const uploadProgress  = $("upload-progress");
const uploadLabel     = $("upload-label");
const progressBar     = $("progress-bar");

const searchInput     = $("search-input");
const searchClear     = $("search-clear");
const fileList        = $("file-list");
const emptyState      = $("empty-state");

const previewModal    = $("preview-modal");
const previewFilename = $("preview-filename");
const previewContent  = $("preview-content");
const previewClose    = $("preview-close");

const deleteModal     = $("delete-modal");
const deleteFilename  = $("delete-filename");
const deleteCancel    = $("delete-cancel");
const deleteConfirm   = $("delete-confirm");

const toast           = $("toast");
const statusText      = $("status-text");

/* ============================================================
   HELPERS
   ============================================================ */

function formatSize(bytes) {
  if (bytes < 1024)           return bytes + " B";
  if (bytes < 1024 * 1024)    return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function getFileIcon(type) {
  if (type.startsWith("image/"))   return "🖼️";
  if (type.startsWith("video/"))   return "🎬";
  if (type.startsWith("audio/"))   return "🎵";
  if (type.includes("pdf"))        return "📄";
  if (type.includes("zip") || type.includes("rar")) return "🗜️";
  if (type.includes("text"))       return "📝";
  if (type.includes("spreadsheet") || type.includes("excel")) return "📊";
  if (type.includes("word") || type.includes("document"))     return "📃";
  return "📁";
}

function showToast(msg, type = "success") {
  toast.textContent = (type === "error" ? "❌ " : "✅ ") + msg;
  toast.className = `toast ${type}`;
  toast.classList.remove("hidden");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add("hidden"), 3000);
}

function updateConnectionStatus(status, isError = false) {
  if (statusText) {
    statusText.innerHTML = status;
    const statusDiv = statusText.parentElement;
    if (isError) {
      statusDiv.style.background = "#ff446622";
      statusDiv.style.border = "1px solid #ff4466";
    } else {
      statusDiv.style.background = "#6c63ff22";
      statusDiv.style.border = "1px solid #6c63ff44";
    }
  }
}

/* ============================================================
   SUPABASE OPERATIONS
   ============================================================ */

async function loadFilesFromCloud() {
  try {
    updateConnectionStatus("🔄 Mengambil data dari cloud...");
    
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .order('uploaded_at', { ascending: false });
    
    if (error) throw error;
    
    allFiles = data || [];
    renderFiles();
    updateStats();
    
    updateConnectionStatus(`✅ Terhubung — ${allFiles.length} file di cloud`);
    return true;
  } catch (error) {
    console.error("Gagal load files:", error);
    updateConnectionStatus("⚠️ Gagal koneksi ke cloud", true);
    showToast("Gagal mengambil data dari cloud!", "error");
    return false;
  }
}

async function uploadFileToCloud(file) {
  try {
    // Konversi file ke base64
    const dataUrl = await readAsDataURL(file);
    
    const fileData = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      uploaded_by: currentUser,
      uploaded_at: new Date().toISOString(),
      data_url: dataUrl
    };
    
    const { error } = await supabase
      .from('files')
      .insert([fileData]);
    
    if (error) throw error;
    
    // Refresh daftar file setelah upload
    await loadFilesFromCloud();
    return true;
  } catch (error) {
    console.error("Upload error:", error);
    showToast(`Gagal upload ${file.name}: ${error.message}`, "error");
    return false;
  }
}

async function deleteFileFromCloud(fileId) {
  try {
    const { error } = await supabase
      .from('files')
      .delete()
      .eq('id', fileId);
    
    if (error) throw error;
    
    await loadFilesFromCloud();
    return true;
  } catch (error) {
    console.error("Delete error:", error);
    showToast("Gagal menghapus file!", "error");
    return false;
  }
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.readAsDataURL(file);
  });
}

/* ============================================================
   STATS
   ============================================================ */

function updateStats() {
  statTotal.textContent = allFiles.length;
  statSize.textContent  = formatSize(allFiles.reduce((a, f) => a + (f.size || 0), 0));
  statUsers.textContent = new Set(allFiles.map((f) => f.uploaded_by)).size;
}

/* ============================================================
   RENDER FILE LIST
   ============================================================ */

function renderFiles() {
  const query = searchInput.value.toLowerCase().trim();
  const filtered = query
    ? allFiles.filter(
        (f) =>
          (f.name || "").toLowerCase().includes(query) ||
          (f.uploaded_by || "").toLowerCase().includes(query)
      )
    : allFiles;

  fileList.innerHTML = "";

  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
    const isEmpty = allFiles.length === 0;
    const emptyTitle = emptyState.querySelector(".empty-title");
    const emptySub = emptyState.querySelector(".empty-sub");
    if (emptyTitle) {
      emptyTitle.textContent = isEmpty ? "Belum ada file" : "Tidak ada hasil";
    }
    if (emptySub) {
      emptySub.textContent = isEmpty ? "Upload file pertamamu!" : "Coba kata kunci lain";
    }
    return;
  }

  emptyState.classList.add("hidden");

  filtered.forEach((file) => {
    const card = document.createElement("div");
    card.className = "file-card";

    /* Thumbnail */
    const thumb = document.createElement("div");
    thumb.className = "file-thumb";
    if (file.type && file.type.startsWith("image/") && file.data_url) {
      const img = document.createElement("img");
      img.src = file.data_url;
      img.alt = file.name;
      thumb.appendChild(img);
    } else {
      thumb.textContent = getFileIcon(file.type || "");
    }

    /* Info */
    const info = document.createElement("div");
    info.className = "file-info";
    info.innerHTML = `
      <div class="file-name">${escapeHtml(file.name || "Unknown")}</div>
      <div class="file-meta">
        <span class="uploader">${escapeHtml(file.uploaded_by || "Unknown")}</span>
        &nbsp;·&nbsp;${formatSize(file.size || 0)}&nbsp;·&nbsp;${formatDate(file.uploaded_at)}
      </div>
    `;

    /* Actions */
    const actions = document.createElement("div");
    actions.className = "file-actions";

    const canPreview = file.type && (
      file.type.startsWith("image/") ||
      file.type.startsWith("video/") ||
      file.type.startsWith("audio/")
    );

    if (canPreview && file.data_url) {
      const previewBtn = document.createElement("button");
      previewBtn.className = "action-btn";
      previewBtn.title = "Preview";
      previewBtn.textContent = "👁️";
      previewBtn.addEventListener("click", () => openPreview(file));
      actions.appendChild(previewBtn);
    }

    const dlBtn = document.createElement("button");
    dlBtn.className = "action-btn teal";
    dlBtn.title = "Download";
    dlBtn.textContent = "⬇️";
    dlBtn.addEventListener("click", () => downloadFile(file));
    actions.appendChild(dlBtn);

    if (file.uploaded_by === currentUser) {
      const delBtn = document.createElement("button");
      delBtn.className = "action-btn danger";
      delBtn.title = "Hapus";
      delBtn.textContent = "🗑️";
      delBtn.addEventListener("click", () => openDeleteModal(file));
      actions.appendChild(delBtn);
    }

    card.appendChild(thumb);
    card.appendChild(info);
    card.appendChild(actions);
    fileList.appendChild(card);
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ============================================================
   UPLOAD HANDLER
   ============================================================ */

async function handleUpload(files) {
  if (!files || files.length === 0) return;
  const fileArr = Array.from(files);
  
  // Filter file yang terlalu besar (max 5MB untuk performance)
  const validFiles = fileArr.filter(f => {
    if (f.size > 5 * 1024 * 1024) {
      showToast(`⚠️ ${f.name} terlalu besar (max 5MB)`, "error");
      return false;
    }
    return true;
  });
  
  if (validFiles.length === 0) return;
  
  setUploading(true);
  
  let successCount = 0;
  for (let i = 0; i < validFiles.length; i++) {
    const file = validFiles[i];
    const pct = Math.round(((i + 1) / validFiles.length) * 100);
    uploadLabel.textContent = `Mengupload ${file.name}... ${pct}%`;
    progressBar.style.width = pct + "%";
    
    const success = await uploadFileToCloud(file);
    if (success) successCount++;
  }
  
  setUploading(false);
  
  if (successCount > 0) {
    showToast(`${successCount} file berhasil diupload ke cloud!`);
  }
  
  fileInput.value = "";
}

function setUploading(state) {
  if (state) {
    uploadIdle.classList.add("hidden");
    uploadProgress.classList.remove("hidden");
    dropZone.style.cursor = "default";
  } else {
    uploadIdle.classList.remove("hidden");
    uploadProgress.classList.add("hidden");
    uploadLabel.textContent = "Mengupload... 0%";
    progressBar.style.width = "0%";
    dropZone.style.cursor = "pointer";
  }
}

/* ============================================================
   DOWNLOAD & PREVIEW
   ============================================================ */

function downloadFile(file) {
  if (!file.data_url) {
    showToast("File tidak tersedia!", "error");
    return;
  }
  const a = document.createElement("a");
  a.href     = file.data_url;
  a.download = file.name;
  a.click();
  showToast(`Mengunduh ${file.name}...`);
}

function openPreview(file) {
  if (!file.data_url) {
    showToast("Preview tidak tersedia!", "error");
    return;
  }
  
  previewFilename.textContent = file.name;
  previewContent.innerHTML = "";

  if (file.type && file.type.startsWith("image/")) {
    const img = document.createElement("img");
    img.src = file.data_url;
    img.alt = file.name;
    previewContent.appendChild(img);
  } else if (file.type && file.type.startsWith("video/")) {
    const video = document.createElement("video");
    video.src = file.data_url;
    video.controls = true;
    previewContent.appendChild(video);
  } else if (file.type && file.type.startsWith("audio/")) {
    const audio = document.createElement("audio");
    audio.src = file.data_url;
    audio.controls = true;
    previewContent.appendChild(audio);
  } else {
    const p = document.createElement("p");
    p.className = "preview-no-support";
    p.textContent = "Preview tidak tersedia untuk tipe file ini.";
    previewContent.appendChild(p);
  }

  previewModal.classList.remove("hidden");
}

function closePreview() {
  previewModal.classList.add("hidden");
  previewContent.innerHTML = "";
}

/* ============================================================
   DELETE MODAL
   ============================================================ */

function openDeleteModal(file) {
  deleteTarget = file;
  deleteFilename.textContent = `"${file.name}"`;
  deleteModal.classList.remove("hidden");
}

async function confirmDelete() {
  if (!deleteTarget) return;
  await deleteFileFromCloud(deleteTarget.id);
  deleteTarget = null;
  deleteModal.classList.add("hidden");
  showToast("File dihapus dari cloud.", "error");
}

/* ============================================================
   LOGIN / LOGOUT
   ============================================================ */

async function login() {
  const name = loginInput.value.trim();
  if (!name) return;
  currentUser = name;
  
  localStorage.setItem("cloudshare-user", currentUser);
  
  loginScreen.classList.add("hidden");
  app.classList.remove("hidden");
  
  userAvatar.textContent = name[0].toUpperCase();
  userNameDisplay.textContent = name;
  
  // Load files dari cloud
  await loadFilesFromCloud();
  
  // Sync setiap 5 detik
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(loadFilesFromCloud, 5000);
}

function logout() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  
  currentUser = "";
  localStorage.removeItem("cloudshare-user");
  allFiles = [];
  
  app.classList.add("hidden");
  loginScreen.classList.remove("hidden");
  loginInput.value = "";
  loginBtn.disabled = true;
}

async function checkSavedUser() {
  const savedUser = localStorage.getItem("cloudshare-user");
  if (savedUser) {
    currentUser = savedUser;
    loginScreen.classList.add("hidden");
    app.classList.remove("hidden");
    userAvatar.textContent = currentUser[0].toUpperCase();
    userNameDisplay.textContent = currentUser;
    await loadFilesFromCloud();
    
    // Start auto sync
    syncInterval = setInterval(loadFilesFromCloud, 5000);
  }
}

/* ============================================================
   EVENT LISTENERS
   ============================================================ */

/* Login */
loginInput.addEventListener("input", () => {
  loginBtn.disabled = !loginInput.value.trim();
});
loginInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") login();
});
loginBtn.addEventListener("click", login);
logoutBtn.addEventListener("click", logout);

/* Upload zone */
dropZone.addEventListener("click", () => {
  if (!uploadProgress.classList.contains("hidden")) return;
  fileInput.click();
});
fileInput.addEventListener("change", () => handleUpload(fileInput.files));

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-active");
});
dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag-active");
});
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-active");
  handleUpload(e.dataTransfer.files);
});

/* Search */
searchInput.addEventListener("input", () => {
  const hasVal = searchInput.value.trim().length > 0;
  searchClear.classList.toggle("hidden", !hasVal);
  renderFiles();
});
searchClear.addEventListener("click", () => {
  searchInput.value = "";
  searchClear.classList.add("hidden");
  renderFiles();
});

/* Preview modal */
previewClose.addEventListener("click", closePreview);
previewModal.addEventListener("click", (e) => {
  if (e.target === previewModal) closePreview();
});

/* Delete modal */
deleteCancel.addEventListener("click", () => {
  deleteTarget = null;
  deleteModal.classList.add("hidden");
});
deleteConfirm.addEventListener("click", confirmDelete);
deleteModal.addEventListener("click", (e) => {
  if (e.target === deleteModal) {
    deleteTarget = null;
    deleteModal.classList.add("hidden");
  }
});

/* Initialize */
checkSavedUser();