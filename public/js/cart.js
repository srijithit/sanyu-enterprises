// ─── Cart Manager (localStorage-based, no login required) ───
const CART_KEY = 'sanyu_cart';

function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
  catch { return []; }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateBadge();
}

function addToCart(productId, qty = 1) {
  const cart = getCart();
  const existing = cart.find(i => i.id === productId);
  if (existing) existing.qty += qty;
  else cart.push({ id: productId, qty });
  saveCart(cart);
  showToast('Added to cart!');
}

function removeFromCart(productId) {
  saveCart(getCart().filter(i => i.id !== productId));
}

function updateQty(productId, qty) {
  const cart = getCart();
  const item = cart.find(i => i.id === productId);
  if (item) { item.qty = Math.max(1, qty); saveCart(cart); }
}

function clearCart() { localStorage.removeItem(CART_KEY); updateBadge(); }

function updateBadge() {
  const badge = document.getElementById('cart-badge');
  if (badge) {
    const count = getCart().reduce((s, i) => s + i.qty, 0);
    badge.textContent = count;
    badge.style.display = count > 0 ? '' : 'none';
  }
}

function showToast(msg, isError) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast'; t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

document.addEventListener('DOMContentLoaded', updateBadge);
