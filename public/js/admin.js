// ─── ADMIN DASHBOARD LOGIC ───

function showToast(msg, isError = false) {
  const t = document.createElement('div');
  t.style.position = 'fixed';
  t.style.bottom = '24px';
  t.style.right = '24px';
  t.style.zIndex = '500';
  t.style.background = 'var(--dark-3)';
  t.style.border = `1px solid ${isError ? 'rgba(201,64,64,0.35)' : 'rgba(200,150,12,0.25)'}`;
  t.style.color = 'var(--cream)';
  t.style.padding = '14px 22px';
  t.style.borderRadius = 'var(--radius)';
  t.style.boxShadow = '0 12px 40px rgba(0,0,0,0.6)';
  t.style.display = 'flex';
  t.style.alignItems = 'center';
  t.style.gap = '10px';
  t.innerHTML = `<div style="width:6px;height:6px;border-radius:50%;background:${isError ? 'var(--red)' : 'var(--gold)'};flex-shrink:0;"></div>${msg}`;
  
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity 0.3s';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

// ─── MODAL HANDLERS ───
function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// ─── IMAGE UPLOAD PREVIEW ───
function setupImagePreview(inputId, previewId, iconId, textId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  
  input.addEventListener('change', function() {
    const file = this.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = e => {
      const prev = document.getElementById(previewId);
      prev.src = e.target.result;
      prev.style.display = 'block';
      if (iconId) document.getElementById(iconId).style.display = 'none';
      if (textId) document.getElementById(textId).textContent = file.name;
    };
    reader.readAsDataURL(file);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupImagePreview('add-img', 'img-preview', 'upload-icon', 'upload-text');
  setupImagePreview('edit-img', 'edit-img-preview', null, null);
  
  // Close modals on backdrop click
  document.querySelectorAll('.modal-backdrop').forEach(m => {
    m.addEventListener('click', e => {
      if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
    });
  });
});

// ─── CRUD OPERATIONS ───

async function addProduct(event) {
  event.preventDefault();
  const form = document.getElementById('add-product-form');
  const formData = new FormData(form);
  const btn = event.target;
  const originalText = btn.textContent;
  
  btn.textContent = 'Saving...';
  btn.disabled = true;
  
  try {
    const res = await fetch('/admin/products', { method: 'POST', body: formData });
    const data = await res.json();
    
    if (res.ok) {
      showToast('Product added successfully!');
      window.location.reload();
    } else {
      showToast(data.error || 'Failed to add product', true);
    }
  } catch (err) {
    showToast('Network error', true);
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

function openEdit(id) {
  // Fetch product row data from the table
  const row = document.querySelector(`tr[data-id="${id}"]`);
  if (!row) return;
  
  const name = row.dataset.name;
  const price = row.dataset.price;
  const category = row.dataset.category;
  const desc = row.dataset.desc;
  const image = row.dataset.image;
  const featured = row.dataset.featured === 'true';
  
  document.getElementById('edit-id').value = id;
  document.getElementById('edit-name').value = name;
  document.getElementById('edit-price').value = price;
  document.getElementById('edit-cat').value = category;
  document.getElementById('edit-desc').value = desc;
  document.getElementById('edit-featured').checked = featured;
  
  const prev = document.getElementById('edit-img-preview');
  if (image) {
    prev.src = image;
    prev.style.display = 'block';
  } else {
    prev.style.display = 'none';
  }
  
  openModal('edit-modal');
}

async function saveEdit(event) {
  const id = document.getElementById('edit-id').value;
  const form = document.getElementById('edit-product-form');
  const formData = new FormData(form);
  const btn = event.target;
  const originalText = btn.textContent;
  
  btn.textContent = 'Saving...';
  btn.disabled = true;
  
  try {
    const res = await fetch(`/admin/products/${id}/update`, { method: 'POST', body: formData });
    const data = await res.json();
    
    if (res.ok) {
      showToast('Product updated!');
      window.location.reload();
    } else {
      showToast(data.error || 'Failed to update', true);
    }
  } catch (err) {
    showToast('Network error', true);
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

function confirmDelete(id) {
  document.getElementById('delete-target-id').value = id;
  openModal('delete-modal');
}

async function executeDelete(event) {
  const id = document.getElementById('delete-target-id').value;
  const btn = event.target;
  const originalText = btn.textContent;
  
  btn.textContent = 'Deleting...';
  btn.disabled = true;
  
  try {
    const res = await fetch(`/admin/products/${id}/delete`, { method: 'POST' });
    if (res.ok) {
      window.location.reload();
    } else {
      const data = await res.json();
      showToast(data.error || 'Failed to delete', true);
    }
  } catch (err) {
    showToast('Network error', true);
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}
