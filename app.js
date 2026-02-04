const API_BASE = 'https://api.escuelajs.co/api/v1';
let products = [];
let categories = [];
let state = {
  search: '',
  page: 1,
  pageSize: 10,
  sortKey: null,
  sortDir: 1, // 1 asc, -1 desc
};

// Elements
const tbody = document.getElementById('productsTbody');
const paginationEl = document.getElementById('pagination');
const searchInput = document.getElementById('searchInput');
const pageSizeSel = document.getElementById('pageSize');
const exportBtn = document.getElementById('exportCsv');
const sortBtns = document.querySelectorAll('.sort-btn');

// Detail modal elements
const detailModalEl = document.getElementById('detailModal');
const detailModal = new bootstrap.Modal(detailModalEl);
const detailForm = document.getElementById('detailForm');
const detailId = document.getElementById('detailId');
const detailTitle = document.getElementById('detailTitle');
const detailPrice = document.getElementById('detailPrice');
const detailDescription = document.getElementById('detailDescription');
const detailCategory = document.getElementById('detailCategory');
const detailImage = document.getElementById('detailImage');
const detailImagesList = document.getElementById('detailImagesList');
const editBtn = document.getElementById('editBtn');
const saveBtn = document.getElementById('saveBtn');

// Create modal elements
const createCategory = document.getElementById('createCategory');
const createForm = document.getElementById('createForm');
const createSubmit = document.getElementById('createSubmit');

// Init
window.addEventListener('DOMContentLoaded', async () => {
  await loadCategories();
  await loadProducts();
  setupEvents();
});

async function loadProducts(){
  try{
    const res = await fetch(`${API_BASE}/products`);
    products = await res.json();
    state.page = 1;
    render();
  }catch(e){
    tbody.innerHTML = `<tr><td colspan="5" class="text-danger">Lỗi tải dữ liệu</td></tr>`;
    console.error(e);
  }
}

async function loadCategories(){
  try{
    const res = await fetch(`${API_BASE}/categories`);
    categories = await res.json();
    // populate selects
    const options = categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    createCategory.innerHTML = '<option value="">-- Chọn category --</option>' + options;
    detailCategory.innerHTML = '<option value="">-- Chọn category --</option>' + options;
  }catch(e){
    console.warn('Không tải được categories', e);
  }
}

function setupEvents(){
  // search
  searchInput.addEventListener('input', (e)=>{
    state.search = e.target.value.trim().toLowerCase();
    state.page = 1;
    render();
  });

  // page size
  pageSizeSel.addEventListener('change', (e)=>{
    state.pageSize = Number(e.target.value);
    state.page = 1;
    render();
  });

  // sort
  sortBtns.forEach(btn => {
    btn.addEventListener('click', ()=>{
      const key = btn.dataset.key;
      if(state.sortKey === key) state.sortDir *= -1; else { state.sortKey = key; state.sortDir = 1; }
      render();
    });
  });

  exportBtn.addEventListener('click', exportCsv);

  // create
  createSubmit.addEventListener('click', async (e)=>{
    e.preventDefault();
    await createItem();
  });

  // edit/save
  editBtn.addEventListener('click', ()=>{
    toggleDetailEdit(true);
  });
  saveBtn.addEventListener('click', async ()=>{
    await saveDetailEdit();
  });
}

function getFilteredSorted(){
  let list = products.slice();
  if(state.search){
    list = list.filter(p => (p.title || '').toLowerCase().includes(state.search));
  }
  if(state.sortKey){
    list.sort((a,b)=>{
      let va = a[state.sortKey];
      let vb = b[state.sortKey];
      if(state.sortKey === 'title'){ va = (va||'').toLowerCase(); vb=(vb||'').toLowerCase(); }
      return (va > vb ? 1 : va < vb ? -1 : 0) * state.sortDir;
    });
  }
  return list;
}

function render(){
  // prepare data
  const list = getFilteredSorted();
  const total = list.length;
  const pageCount = Math.max(1, Math.ceil(total / state.pageSize));
  if(state.page > pageCount) state.page = pageCount;
  const start = (state.page-1) * state.pageSize;
  const pageItems = list.slice(start, start + state.pageSize);

  if(pageItems.length === 0){
    tbody.innerHTML = `<tr><td colspan="5" class="text-center">Không có dữ liệu</td></tr>`;
  } else {
    tbody.innerHTML = pageItems.map(p => renderRow(p)).join('');
  }

  renderPagination(pageCount);
  // enable bootstraps tooltips for descriptions on rows
  initRowTooltips();
}

function renderRow(p){
  // Inline SVG placeholder (avoid external DNS dependency)
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='100%' height='100%' fill='#e9ecef'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#6c757d' font-size='10'>No Image</text></svg>`;
  const placeholder = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

  const srcRaw = (p.images && p.images.length) ? p.images[0] : '';
  const safeSrc = escapeHtml(srcRaw);
  const proxySrc = srcRaw ? `https://images.weserv.nl/?url=${encodeURIComponent(srcRaw.replace(/^https?:\/\//, ''))}` : '';

  // Removed loading="lazy" to avoid Edge lazy-loading intervention; add referrerpolicy to bypass some hotlink blocks
  const img = srcRaw
    ? `<img src="${safeSrc}" class="thumb" alt="${escapeHtml(p.title||'image')}" referrerpolicy="no-referrer" crossorigin="anonymous" onerror="(function(img){ console.warn('Image load failed, trying proxy for', img.src); if(!img.dataset._tried){ img.dataset._tried='proxy'; img.src='${proxySrc}'; } else { console.warn('Proxy failed too, using placeholder:', img.src); img.src='${placeholder}'; img.alt='No image'; img.title='Ảnh không khả dụng'; } })(this)" />`
    : `<img src="${placeholder}" class="thumb" alt="no image" />`;

  const cat = p.category && (p.category.name || p.category.title) ? escapeHtml(p.category.name || p.category.title) : '';
  // Attach data attributes for bootstrap tooltip
  const desc = escapeHtml(p.description || '');
  return `<tr data-id="${p.id}" data-bs-toggle="tooltip" data-bs-placement="top" title="${desc}">
    <td>${p.id}</td>
    <td>${img}</td>
    <td>${escapeHtml(p.title || '')}</td>
    <td>${p.price}</td>
    <td>${cat}</td>
  </tr>`;
}

function renderPagination(pageCount){
  const arr = [];
  const prevDisabled = state.page === 1 ? 'disabled' : '';
  const nextDisabled = state.page === pageCount ? 'disabled' : '';
  arr.push(`<li class="page-item ${prevDisabled}"><a class="page-link" href="#" data-page="${state.page-1}">Prev</a></li>`);
  for(let i=1;i<=pageCount;i++){
    const active = i===state.page ? 'active' : '';
    arr.push(`<li class="page-item ${active}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`);
  }
  arr.push(`<li class="page-item ${nextDisabled}"><a class="page-link" href="#" data-page="${state.page+1}">Next</a></li>`);
  paginationEl.innerHTML = arr.join('');
  paginationEl.querySelectorAll('a.page-link').forEach(a => {
    a.addEventListener('click', (e)=>{
      e.preventDefault();
      const p = Number(a.dataset.page);
      if(p>=1 && p<=pageCount){ state.page = p; render(); }
    });
  });
}

function initRowTooltips(){
  // destroy existing
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.forEach(el => {
    // attach click to open detail
    el.addEventListener('click', async ()=> openDetail(el.dataset.id));
    el.addEventListener('dblclick', ()=>{});
  });
  // initialize bootstrap tooltips
  tooltipTriggerList.forEach(function (tooltipTriggerEl) {
    new bootstrap.Tooltip(tooltipTriggerEl, {html: false, container: 'body'});
  });
  // also attach row click to open detail
  document.querySelectorAll('#productsTbody tr[data-id]').forEach(tr => {
    tr.onclick = ()=> openDetail(tr.dataset.id);
  });
}

async function openDetail(id){
  const p = products.find(x => String(x.id) === String(id));
  if(!p) return;
  detailId.value = p.id;
  detailTitle.value = p.title || '';
  detailPrice.value = p.price || '';
  detailDescription.value = p.description || '';
  detailImage.value = (p.images && p.images[0]) || '';
  detailImagesList.innerHTML = (p.images||[]).map(src => `<img src="${escapeHtml(src)}" class="thumb"/>`).join('');
  // set category select
  if(p.category && p.category.id) detailCategory.value = p.category.id; else detailCategory.value = '';
  toggleDetailEdit(false);
  detailModal.show();
}

function toggleDetailEdit(editable){
  detailTitle.readOnly = !editable;
  detailPrice.readOnly = !editable;
  detailDescription.readOnly = !editable;
  detailCategory.disabled = !editable;
  detailImage.readOnly = !editable;
  editBtn.classList.toggle('d-none', editable);
  saveBtn.classList.toggle('d-none', !editable);
}

async function saveDetailEdit(){
  const id = detailId.value;
  const body = {
    title: detailTitle.value,
    price: Number(detailPrice.value),
    description: detailDescription.value,
    categoryId: Number(detailCategory.value) || null,
    images: detailImage.value ? [detailImage.value] : []
  };
  try{
    const res = await fetch(`${API_BASE}/products/${id}`, {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    if(!res.ok) throw new Error('Update failed');
    const updated = await res.json();
    // update local products list
    const idx = products.findIndex(p => String(p.id) === String(id));
    if(idx >= 0) products[idx] = {...products[idx], ...updated};
    render();
    toggleDetailEdit(false);
    showAlert('Updated thành công', 'success');
  }catch(e){
    console.error(e);
    showAlert('Không thể update: ' + e.message, 'danger');
  }
}

async function createItem(){
  // simple UX: disable the create button while processing
  const origLabel = createSubmit.innerHTML;
  createSubmit.disabled = true;
  createSubmit.innerHTML = 'Creating...';
  const createError = document.getElementById('createError');

  function genSlug(t){
    const base = slugify(t) || 'item';
    return `${base}-${Date.now().toString(36).slice(-6)}-${Math.random().toString(36).slice(2,6)}`;
  }

  try{
    const title = document.getElementById('createTitle').value.trim();
    const price = Number(document.getElementById('createPrice').value);
    const description = document.getElementById('createDescription').value.trim();
    const categoryId = Number(document.getElementById('createCategory').value);
    const image = document.getElementById('createImage').value.trim();

    createError.textContent = '';
    if(!title || !description || !image || !categoryId) { createError.textContent = 'Vui lòng điền đủ thông tin'; showAlert('Vui lòng điền đủ thông tin', 'warning'); return; }

    const maxAttempts = 5;
    let attempt = 0;
    let lastError = null;
    let newP = null;

    // Keep a mutable title that we can tweak if the server generates slug from title
    let attemptTitle = title;

    while(attempt < maxAttempts){
      attempt++;
      const slug = genSlug(attemptTitle);
      const body = {title: attemptTitle, price, description, categoryId, images: [image], slug};

      try{
        const res = await fetch(`${API_BASE}/products`, {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(body)
        });

        const text = await res.text();
        let parsed;
        try{ parsed = JSON.parse(text); } catch(err){ parsed = text; }

        if(res.ok){
          // if we had to change the title, show a small note
          if(attempt > 1){
            createError.textContent = `Lưu ý: tiêu đề đã được tự động điều chỉnh để tránh trùng slug: "${escapeHtml(attemptTitle)}"`;
          }
          newP = parsed;
          break;
        }

        // check for UNIQUE constraint on slug — if so, retry with new title and slug
        const msgObj = typeof parsed === 'object' ? parsed : (String(parsed) || '');
        const msgStr = typeof msgObj === 'string' ? msgObj : JSON.stringify(msgObj);
        if(msgStr.includes('UNIQUE constraint failed') && msgStr.includes('product.slug')){
          console.warn(`Attempt ${attempt} slug collision, retrying with modified title...`);
          lastError = msgStr;
          // modify attemptTitle slightly so server-generated slug (if any) will differ
          attemptTitle = `${title}-${Math.random().toString(36).slice(2,6)}`;
          // tiny delay before retry
          await new Promise(r=>setTimeout(r, 200));
          continue;
        }

        // other error — break and show
        lastError = msgStr || `HTTP ${res.status} ${res.statusText}`;
        break;

      }catch(netErr){
        lastError = netErr.message || String(netErr);
        console.error('Network/create error attempt', attempt, netErr);
        // retry on network errors
        await new Promise(r=>setTimeout(r, 300));
      }
    }

    if(!newP){
      const errMsg = `Create failed after ${attempt} attempts: ${lastError}`;
      createError.textContent = errMsg;
      throw new Error(errMsg);
    }

    products.unshift(newP);
    render();
    // close modal programmatically
    const modal = bootstrap.Modal.getInstance(document.getElementById('createModal'));
    if(modal) modal.hide();
    createForm.reset();
    createError.textContent = '';
    showAlert('Tạo item thành công', 'success');

  }catch(e){
    console.error('Create error', e);
    showAlert('Không thể tạo: ' + e.message, 'danger');
  } finally {
    createSubmit.disabled = false;
    createSubmit.innerHTML = origLabel;
  }
}

function exportCsv(){
  const list = getFilteredSorted();
  const start = (state.page-1) * state.pageSize;
  const pageItems = list.slice(start, start + state.pageSize);
  const rows = pageItems.map(p => ({
    id: p.id,
    title: p.title,
    price: p.price,
    category: p.category ? p.category.name : '',
    images: (p.images||[]).join('|'),
    description: p.description || ''
  }));
  const csv = toCsv(rows);
  downloadFile(csv, 'products.csv', 'text/csv');
}

function toCsv(objArray){
  if(!objArray || !objArray.length) return '';
  const keys = Object.keys(objArray[0]);
  const lines = [keys.join(',')];
  for(const r of objArray){
    const vals = keys.map(k => `"${String(r[k]||'').replace(/"/g,'""')}"`);
    lines.push(vals.join(','));
  }
  return lines.join('\n');
}

function downloadFile(content, filename, type){
  const blob = new Blob([content], {type: type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(str){
  if(!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function slugify(text){
  if(!text) return '';
  return text.toString().toLowerCase().trim()
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/(^-|-$)/g,'');
}

function showAlert(msg, type='info'){
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `<div class="toast align-items-center text-bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
    <div class="d-flex">
      <div class="toast-body">${escapeHtml(msg)}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  </div>`;
  document.body.append(wrapper);
  const t = new bootstrap.Toast(wrapper.querySelector('.toast'), {delay:3000});
  t.show();
  wrapper.querySelector('.toast').addEventListener('hidden.bs.toast', ()=> wrapper.remove());
}
