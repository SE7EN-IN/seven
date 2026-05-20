// ===========================
// SE7EN v2 – Jersey Store
// app.js – Full App Logic
// ===========================

// ====== SUPABASE CONFIG ======
const SUPABASE_URL = 'https://ovckuxlmtezrwldwasjs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92Y2t1eGxtdGV6cndsZHdhc2pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNTI4MzAsImV4cCI6MjA5NDgyODgzMH0.AD7tBMUPTx8nj8ZIhXwKFUNNns1gcFocpUTVqI4QLLM';

let supabaseClient = null;
try {
  if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.warn('Supabase not initialized:', e.message);
}

// ====== RAZORPAY CONFIG ======
const RAZORPAY_KEY = 'YOUR_RAZORPAY_KEY_ID';

// ====== EMAILJS CONFIG ======
const EMAILJS_SERVICE_ID  = 'service_203x9cg';
const EMAILJS_TEMPLATE_ID = 'template_nit8435';
const EMAILJS_PUBLIC_KEY  = 'RdacJAmkcV4qQeNBn';

// ====== STATE ======
let cart = JSON.parse(localStorage.getItem('se7en_cart') || '[]');
let allProducts = [];
let pendingProduct = null;
let selectedSize = null;
let customerAddress = null;

// ====== INIT ======
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize EmailJS
  emailjs.init(EMAILJS_PUBLIC_KEY);
  initLoader();
  initCursor();
  initNavScroll();
  await loadProducts();
  updateCartUI();
});

// ====== LOADER ======
function initLoader() {
  const fill   = document.getElementById('loaderFill');
  const loader = document.getElementById('loader');
  const isMobile = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  // Faster load on mobile
  const duration = isMobile ? 800 : 1800;
  setTimeout(() => { fill.style.width = '100%'; }, 100);
  setTimeout(() => { loader.classList.add('done'); }, duration);
}

// ====== MAGNETIC CURSOR ======
function initCursor() {
  // Skip on touch devices
  if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) return;

  const ring = document.getElementById('magCursor');
  const dot  = document.getElementById('magCursorDot');

  let ringX = window.innerWidth / 2;
  let ringY = window.innerHeight / 2;
  let dotX  = ringX, dotY = ringY;

  // Smooth ring follow with RAF
  function animateRing() {
    ringX += (dotX - ringX) * 0.10;
    ringY += (dotY - ringY) * 0.10;
    ring.style.left = ringX + 'px';
    ring.style.top  = ringY + 'px';
    requestAnimationFrame(animateRing);
  }
  animateRing();

  // Dot follows mouse instantly
  document.addEventListener('mousemove', (e) => {
    dotX = e.clientX;
    dotY = e.clientY;
    dot.style.left = e.clientX + 'px';
    dot.style.top  = e.clientY + 'px';

    // Magnetic pull on interactive elements
    const MAGNETIC_ELS = document.querySelectorAll('a, button, .filter-tab, .product-card, .contact-card, .size-btn, .qty-btn');
    let anyHovering = false;

    MAGNETIC_ELS.forEach(el => {
      const rect  = el.getBoundingClientRect();
      const elCX  = rect.left + rect.width  / 2;
      const elCY  = rect.top  + rect.height / 2;
      const distX = e.clientX - elCX;
      const distY = e.clientY - elCY;
      const dist  = Math.sqrt(distX * distX + distY * distY);
      const RADIUS = 80;

      if (dist < RADIUS) {
        const pull  = (RADIUS - dist) / RADIUS;
        const moveX = distX * pull * 0.35;
        const moveY = distY * pull * 0.35;
        el.style.transform = `translate(${moveX}px, ${moveY}px)`;
        anyHovering = true;
      } else {
        el.style.transform = '';
      }
    });

    if (anyHovering) ring.classList.add('hovering');
    else ring.classList.remove('hovering');
  });

  // Click effect
  document.addEventListener('mousedown', () => ring.classList.add('clicking'));
  document.addEventListener('mouseup',   () => ring.classList.remove('clicking'));

  // Reset on mouse leave window
  document.addEventListener('mouseleave', () => {
    document.querySelectorAll('a, button, .filter-tab, .product-card').forEach(el => {
      el.style.transform = '';
    });
    ring.classList.remove('hovering');
  });
}

// ====== NAVBAR SCROLL ======
function initNavScroll() {
  window.addEventListener('scroll', () => {
    document.getElementById('nav').classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });
}

// ====== LOAD PRODUCTS FROM SUPABASE ======
async function loadProducts() {
  try {
    const { data, error } = await supabaseClient
      .from('products')
      .select('*')
      .eq('active', true)
      .limit(30);

    if (error) throw error;

    allProducts = data.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      badge: p.badge,
      desc: p.description,
      image: p.image_url,
      sizes: p.sizes || ['S', 'M', 'L', 'XL', 'XXL']
    }));

    renderProducts(allProducts);

  } catch (err) {
    console.error('Failed to load products:', err);
    document.getElementById('productsGrid').innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:80px 20px;color:var(--white-faint);font-family:var(--font-ui);letter-spacing:2px;font-size:0.8rem;">
        UNABLE TO LOAD COLLECTION.<br/>CHECK YOUR SUPABASE CONNECTION.
      </div>`;
  }
}

// ====== RENDER PRODUCTS ======
function renderProducts(items) {
  const grid = document.getElementById('productsGrid');
  if (!items.length) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:80px 20px;color:var(--white-faint);font-family:var(--font-ui);letter-spacing:2px;font-size:0.8rem;">
        NO JERSEYS FOUND IN THIS CATEGORY
      </div>`;
    return;
  }

  const isMobile = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  grid.innerHTML = items.map((p, i) => `
    <div class="product-card" style="animation-delay:${isMobile ? 0 : i * 0.06}s">
      <div class="product-img-wrap">
        ${p.image
          ? `<img src="${p.image}" alt="${p.name}" loading="lazy"/>`
          : `<div class="product-emoji">👕</div>`
        }
        <div class="product-badge-wrap">
          ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ''}
        </div>
        <div class="product-quick-add">
          <span>SELECT SIZE</span>
          <button class="quick-add-btn" onclick="openSizeModal(${p.id})">ADD TO BAG</button>
        </div>
      </div>
      <div class="product-info">
        <div class="product-cat">${p.category ? p.category.toUpperCase() : ''}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-desc">${p.desc || ''}</div>
        <div class="product-footer">
          <div class="product-price">₹${p.price.toLocaleString('en-IN')}</div>
          <button class="quick-add-btn" onclick="openSizeModal(${p.id})">ADD</button>
        </div>
      </div>
    </div>
  `).join('');
}

// ====== FILTER ======
function filterProducts(cat, btn) {
  document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const filtered = cat === 'all' ? allProducts : allProducts.filter(p => p.category === cat);
  renderProducts(filtered);
}

// ====== SIZE MODAL ======
function openSizeModal(productId) {
  pendingProduct = allProducts.find(p => p.id === productId);
  selectedSize = null;

  document.getElementById('sizeProductName').textContent = pendingProduct.name;
  document.getElementById('sizeProductPrice').textContent = `₹${pendingProduct.price.toLocaleString('en-IN')}`;
  document.getElementById('sizeGrid').innerHTML = pendingProduct.sizes.map(s => `
    <button class="size-btn" onclick="selectSize('${s}', this)">${s}</button>
  `).join('');

  openModal('sizeModalBg');
}

function selectSize(size, el) {
  selectedSize = size;
  document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
}

function confirmAddToCart() {
  if (!selectedSize) { showToast('Please select a size!'); return; }
  closeModal('sizeModalBg');
  addToCart(pendingProduct, selectedSize);
}

// ====== CART LOGIC ======
function addToCart(product, size) {
  const existing = cart.find(i => i.id === product.id && i.size === size);
  if (existing) existing.qty += 1;
  else cart.push({ ...product, size, qty: 1 });
  saveCart();
  updateCartUI();
  showToast(`${product.name} (${size}) added!`);
  setTimeout(() => toggleCart(true), 400);
}

function removeFromCart(id, size) {
  cart = cart.filter(i => !(i.id === id && i.size === size));
  saveCart();
  updateCartUI();
}

function changeQty(id, size, delta) {
  const item = cart.find(i => i.id === id && i.size === size);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) removeFromCart(id, size);
  else { saveCart(); updateCartUI(); }
}

function saveCart() {
  localStorage.setItem('se7en_cart', JSON.stringify(cart));
}

function resetCart() {
  cart = [];
  saveCart();
  updateCartUI();
}

function cartTotal() {
  return cart.reduce((sum, i) => sum + i.price * i.qty, 0);
}

function updateCartUI() {
  const totalItems = cart.reduce((s, i) => s + i.qty, 0);
  document.getElementById('cartCount').textContent = totalItems;
  document.getElementById('cartItemCount').textContent = `(${totalItems})`;

  const body = document.getElementById('cartItems');
  const foot = document.getElementById('cartFooter');

  if (!cart.length) {
    body.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <p>YOUR BAG IS EMPTY</p>
        <a href="#products" onclick="toggleCart()" class="cta-primary" style="margin-top:16px;display:inline-flex">
          SHOP NOW
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </a>
      </div>`;
    foot.style.display = 'none';
    return;
  }

  foot.style.display = 'flex';
  body.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-img">
        ${item.image
          ? `<img src="${item.image}" alt="${item.name}"/>`
          : '👕'
        }
      </div>
      <div class="cart-item-details">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-size">SIZE: ${item.size}</div>
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="changeQty(${item.id},'${item.size}',-1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${item.id},'${item.size}',1)">+</button>
        </div>
      </div>
      <div class="cart-item-right">
        <div class="cart-item-price">₹${(item.price * item.qty).toLocaleString('en-IN')}</div>
        <button class="remove-btn" onclick="removeFromCart(${item.id},'${item.size}')">REMOVE</button>
      </div>
    </div>
  `).join('');

  const total = cartTotal();
  document.getElementById('cartSubtotal').textContent = `₹${total.toLocaleString('en-IN')}`;
  document.getElementById('cartTotal').textContent = `₹${total.toLocaleString('en-IN')}`;

  const freeShip = document.getElementById('cartFreeShip');
  if (total >= 999) {
    freeShip.textContent = '✓ You qualify for FREE delivery!';
  } else {
    freeShip.textContent = `Add ₹${(999 - total).toLocaleString('en-IN')} more for free delivery`;
  }
}

// ====== CART TOGGLE ======
function toggleCart(forceOpen) {
  const sidebar = document.getElementById('cartSidebar');
  const overlay = document.getElementById('cartOverlay');
  const isOpen = sidebar.classList.contains('open');

  if (forceOpen === true || !isOpen) {
    sidebar.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  } else {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
}

// ====== CHECKOUT FLOW ======
function proceedToCheckout() {
  if (!cart.length) { showToast('Your bag is empty!'); return; }
  toggleCart(false);
  setTimeout(() => openModal('addressModalBg'), 400);
}

function proceedToPayment() {
  const name  = document.getElementById('addrName').value.trim();
  const phone = document.getElementById('addrPhone').value.trim();
  const email = document.getElementById('addrEmail').value.trim();
  const line1 = document.getElementById('addrLine1').value.trim();
  const city  = document.getElementById('addrCity').value.trim();
  const pin   = document.getElementById('addrPin').value.trim();
  const state = document.getElementById('addrState').value.trim();

  if (!name || !phone || !email || !line1 || !city || !pin || !state) {
    showToast('Please fill all required fields');
    return;
  }
  if (!/^\d{6}$/.test(pin)) {
    showToast('Enter a valid 6-digit pincode');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('Enter a valid email address');
    return;
  }

  customerAddress = {
    name, phone, email,
    address: `${line1}, ${document.getElementById('addrLine2').value.trim()}, ${city} – ${pin}, ${state}`
  };

  closeModal('addressModalBg');
  setTimeout(initRazorpay, 400);
}

// ====== RAZORPAY ======
function initRazorpay() {
  const total = cartTotal();

  const options = {
    key: RAZORPAY_KEY,
    amount: total * 100,
    currency: 'INR',
    name: 'SE7EN',
    description: `Jersey Order – ${cart.length} item(s)`,
    prefill: {
      name: customerAddress?.name || '',
      contact: customerAddress?.phone || ''
    },
    notes: {
      address: customerAddress?.address || '',
      items: cart.map(i => `${i.name} (${i.size}) x${i.qty}`).join(', ')
    },
    theme: { color: '#D10000' },
    handler: async function(response) {
      await saveOrder(response.razorpay_payment_id);
      showSuccess(response.razorpay_payment_id);
    },
    modal: {
      ondismiss: () => showToast('Payment cancelled. Try again.')
    }
  };

  if (typeof Razorpay === 'undefined') {
    showToast('Razorpay not configured. Simulating...');
    setTimeout(() => {
      const fakeId = 'DEMO_' + Date.now();
      saveOrder(fakeId);
      showSuccess(fakeId);
    }, 1000);
    return;
  }

  const rzp = new Razorpay(options);
  rzp.on('payment.failed', (r) => showToast('Payment failed: ' + r.error.description));
  rzp.open();
}

// ====== SAVE ORDER TO SUPABASE ======
async function saveOrder(paymentId) {
  if (!supabaseClient) {
    console.log('Order (Supabase not configured):', { paymentId, customerAddress, cart, total: cartTotal() });
    return;
  }
  try {
    const { error } = await supabaseClient.from('orders').insert({
      payment_id: paymentId,
      customer_name: customerAddress?.name,
      customer_phone: customerAddress?.phone,
      delivery_address: customerAddress?.address,
      items: JSON.stringify(cart),
      total_amount: cartTotal(),
      status: 'confirmed',
      created_at: new Date().toISOString()
    });
    if (error) console.error('Order save error:', error);
  } catch (e) {
    console.error('Order save failed:', e);
  }
}

// ====== SUCCESS ======
function showSuccess(paymentId) {
  document.getElementById('successPid').textContent = 'Payment ID: ' + paymentId;
  openModal('successModalBg');
  sendEmailConfirmation(paymentId);
  sendWhatsAppConfirmation(paymentId);
}

// ====== SEND EMAIL CONFIRMATION TO CUSTOMER ======
async function sendEmailConfirmation(paymentId) {
  if (!customerAddress?.email) return;

  const itemsList = cart.map(i =>
    `• ${i.name} (Size: ${i.size}) x${i.qty} — ₹${(i.price * i.qty).toLocaleString('en-IN')}`
  ).join('\n');

  const total = cartTotal();
  const freeDelivery = total >= 999 ? 'FREE ✅' : '₹49';

  const templateParams = {
    customer_name    : customerAddress.name,
    customer_email   : customerAddress.email,
    customer_phone   : customerAddress.phone,
    delivery_address : customerAddress.address,
    order_items      : itemsList,
    total_amount     : `₹${total.toLocaleString('en-IN')}`,
    delivery_charge  : freeDelivery,
    order_id         : paymentId,
  };

  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
    console.log('Email confirmation sent successfully!');
  } catch (err) {
    console.error('Email send failed:', err);
  }
}

// ====== SEND WHATSAPP ORDER CONFIRMATION TO CUSTOMER ======
function sendWhatsAppConfirmation(paymentId) {
  const customerPhone = customerAddress?.phone?.replace(/\D/g, '');
  if (!customerPhone) return;

  // Build items list
  const itemsList = cart.map(i =>
    `▸ ${i.name} (Size: ${i.size}) x${i.qty} — ₹${(i.price * i.qty).toLocaleString('en-IN')}`
  ).join('\n');

  const total = cartTotal();
  const freeDelivery = total >= 999 ? 'FREE ✅' : '₹49';

  // Build full message
  const message =
`🛍️ *ORDER CONFIRMED — SE7EN*
━━━━━━━━━━━━━━━━━━━━
✅ *Payment Successful!*

📦 *ORDER DETAILS*
${itemsList}

━━━━━━━━━━━━━━━━━━━━
🧾 *Subtotal:* ₹${total.toLocaleString('en-IN')}
🚚 *Delivery:* ${freeDelivery}
💰 *Total Paid:* ₹${total.toLocaleString('en-IN')}

━━━━━━━━━━━━━━━━━━━━
📍 *Delivery Address*
${customerAddress?.name}
${customerAddress?.address}
📞 ${customerAddress?.phone}

━━━━━━━━━━━━━━━━━━━━
🔖 *Payment ID:* ${paymentId}

━━━━━━━━━━━━━━━━━━━━
Thank you for shopping with *SE7EN!* 🔴
Your order will be dispatched soon.
For any queries contact us:
📞 +91 9965682888
📸 @se7en.inn`;

  // Send to customer WhatsApp
  const encoded = encodeURIComponent(message);
  const isMobile = /iPhone|Android/i.test(navigator.userAgent);
  const waURL = isMobile
    ? `whatsapp://send?phone=91${customerPhone}&text=${encoded}`
    : `https://wa.me/91${customerPhone}?text=${encoded}`;

  // Small delay so success modal shows first
  setTimeout(() => {
    window.open(waURL, '_blank');
  }, 1500);
}

// ====== MODAL HELPERS ======
function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

// ====== MOBILE MENU ======
function toggleMenu() {
  document.getElementById('fullscreenMenu').classList.toggle('open');
  document.body.style.overflow =
    document.getElementById('fullscreenMenu').classList.contains('open') ? 'hidden' : '';
}

// ====== TOAST ======
function showToast(msg) {
  const existing = document.querySelector('.se7en-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'se7en-toast';
  toast.textContent = msg;
  toast.style.cssText = `
    position:fixed; bottom:88px; left:50%;
    transform:translateX(-50%);
    background:var(--red);
    color:var(--white);
    padding:11px 24px;
    font-family:'Oswald',sans-serif;
    font-weight:600; font-size:0.8rem;
    letter-spacing:2px;
    z-index:9999;
    animation:fadeUp 0.3s ease;
    white-space:nowrap;
    max-width:90vw; text-align:center;
    border-top:2px solid var(--red-bright);
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
