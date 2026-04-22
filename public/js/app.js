// ─── CART MANAGEMENT ───
let cart = JSON.parse(localStorage.getItem('sanyu_cart') || '[]');

function saveCart() {
  localStorage.setItem('sanyu_cart', JSON.stringify(cart));
  updateCartBadge();
}

function updateCartBadge() {
  const badge = document.getElementById('cart-count');
  if (badge) {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    badge.textContent = totalItems;
    badge.style.display = totalItems > 0 ? 'flex' : 'none';
  }
}

function addToCart(id, name, price, image) {
  const existing = cart.find(item => item.id === id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ id, name, price, image, quantity: 1 });
  }
  saveCart();
  
  // Optional toast notification
  if (typeof showToast === 'function') {
    showToast('Added to cart');
  } else {
    alert('Added to cart!');
  }
}

// ─── INIT ───
function buyNow(id, name, price, image) {
  // Check if item already exists to avoid duplicate count if we just want to go to checkout
  const existing = cart.find(i => i.id === id);
  if (!existing) {
    cart.push({ id, name, price, image, quantity: 1 });
    saveCart();
  }
  window.location.href = '/cart';
}

document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();
  
  // Secret admin login trigger via logo tapping
  let tapCount = 0;
  let tapTimer = null;
  const logo = document.getElementById('logo-tap');
  
  if (logo) {
    logo.addEventListener('click', (e) => {
      // Allow default link behavior to home page, but track taps
      tapCount++;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => { tapCount = 0; }, 600);
      
      if (tapCount >= 3) {
        e.preventDefault();
        tapCount = 0;
        clearTimeout(tapTimer);
        window.location.href = '/login';
      }
    });
  }
});
