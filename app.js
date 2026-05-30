// ===========================
// SE7EN v2 – Jersey Store
// app.js – Full App Logic
// ===========================

// ====== SUPABASE CONFIG ======
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

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
const EMAILJS_SERVICE_ID        = 'service_203x9cg';
const EMAILJS_TEMPLATE_ID       = 'template_nit8435'; // Customer confirmation
const EMAILJS_OWNER_TEMPLATE_ID = 'template_kh2dk3t'; // Owner notification
const EMAILJS_PUBLIC_KEY        = 'RdacJAmkcV4qQeNBn';

// ====== STATE ======
let rawCart = [];
try {
  rawCart = JSON.parse(localStorage.getItem('se7en_cart') || '[]');
  // Validate cart items — remove any corrupt entries
  rawCart = rawCart.filter(i => i && i.id && i.name && i.price && i.size);
} catch(e) {
  rawCart = [];
}
let cart = rawCart;
let allProducts = [];
let pendingProduct = null;
let selectedSize = null;
let customerAddress = null;

// ====== INIT ======
document.addEventListener('DOMContentLoaded', async () => {
  emailjs.init(EMAILJS_PUBLIC_KEY);
  initCursor();
  initNavScroll();
  initMobileEnhancements();
  await loadProducts();
  updateCartUI();
});

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

// ====== MOBILE ENHANCEMENTS ======
function initMobileEnhancements() {
  const isMobile = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  if (!isMobile) return;

  // ── Touch Ripple Effect ──
  document.addEventListener('touchstart', (e) => {
    const target = e.target.closest('.cta-primary, .filter-tab, .contact-card, .product-card, .qty-btn, .size-btn, .qv-size-btn');
    if (!target) return;

    const ripple = document.createElement('span');
    const rect   = target.getBoundingClientRect();
    const size   = Math.max(rect.width, rect.height);
    const touch  = e.touches[0];

    ripple.className = 'ripple';
    ripple.style.cssText = `
      width: ${size}px; height: ${size}px;
      left: ${touch.clientX - rect.left - size/2}px;
      top:  ${touch.clientY - rect.top  - size/2}px;
    `;

    target.style.position = 'relative';
    target.style.overflow = 'hidden';
    target.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);
  }, { passive: true });

  // ── Scroll Reveal ──
  const revealEls = document.querySelectorAll(
    '.contact-card, .about-feat, .feature-card, .section-tag, .shop-title, .about-title'
  );
  revealEls.forEach(el => el.classList.add('reveal'));

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, i * 80);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  revealEls.forEach(el => observer.observe(el));

  // ── Bottom Nav Active State ──
  const sections = ['home', 'products', 'about', 'contact'];
  const navLinks = {
    home    : document.getElementById('navHome'),
    products: document.getElementById('navShop'),
    about   : document.getElementById('navAbout'),
    contact : document.getElementById('navContact'),
  };

  window.addEventListener('scroll', () => {
    let current = 'home';
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el && window.scrollY >= el.offsetTop - 200) current = id;
    });
    Object.keys(navLinks).forEach(key => {
      if (navLinks[key]) navLinks[key].classList.toggle('active', key === current);
    });
  }, { passive: true });

  // ── Swipe down to close cart ──
  const cartEl  = document.getElementById('cartSidebar');
  let touchStartY = 0;

  cartEl.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  cartEl.addEventListener('touchend', (e) => {
    const diff = e.changedTouches[0].clientY - touchStartY;
    if (diff > 80) toggleCart(false); // swipe down 80px → close
  }, { passive: true });

  // ── Swipe down to close Quick View ──
  const qvEl = document.getElementById('qvModal');
  let qvTouchStartY = 0;

  qvEl.addEventListener('touchstart', (e) => {
    qvTouchStartY = e.touches[0].clientY;
  }, { passive: true });

  qvEl.addEventListener('touchend', (e) => {
    const diff = e.changedTouches[0].clientY - qvTouchStartY;
    if (diff > 80) closeQuickView();
  }, { passive: true });
}

// ====== NAVBAR SCROLL ======
function initNavScroll() {
  window.addEventListener('scroll', () => {
    document.getElementById('nav').classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });
}

// ====== LOAD PRODUCTS FROM SUPABASE ======
async function loadProducts() {
  const grid = document.getElementById('productsGrid');

  // Check if Supabase is configured
  if (!supabaseClient) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--white-faint);font-family:var(--font-ui);letter-spacing:2px;font-size:0.8rem;line-height:2.5">
        ⚠️ SUPABASE NOT CONFIGURED<br/>
        <span style="font-size:0.7rem;color:var(--red)">Add your Supabase URL and Anon Key in app.js lines 7-8</span>
      </div>`;
    return;
  }

  try {
    // Add 8 second timeout so it never loads forever
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 8000)
    );

    const fetchPromise = supabaseClient
      .from('products')
      .select('*')
      .eq('active', true)
      .limit(30);

    const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

    if (error) throw error;
    if (!data || data.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--white-faint);font-family:var(--font-ui);letter-spacing:2px;font-size:0.8rem;line-height:2.5">
          NO PRODUCTS FOUND<br/>
          <span style="font-size:0.7rem;color:var(--red)">Add products in Supabase and set active = true</span>
        </div>`;
      return;
    }

    allProducts = data.map(p => {
      let sizes = ['S', 'M', 'L', 'XL', 'XXL'];
      if (p.sizes) {
        if (Array.isArray(p.sizes)) {
          sizes = p.sizes.filter(Boolean);
        } else if (typeof p.sizes === 'string') {
          sizes = p.sizes.replace(/[{}]/g, '').split(',').map(s => s.trim()).filter(Boolean);
        }
      }
      return {
        id       : p.id,
        name     : p.name || '',
        category : p.category || '',
        price    : parseInt(p.price) || 0,
        badge    : p.badge || null,
        desc     : p.description || '',
        image    : p.image_url || null,
        sizes    : sizes
      };
    });

    buildFilterTabs(allProducts);
    renderProducts(allProducts);

  } catch (err) {
    console.error('Failed to load products:', err);

    const isTimeout = err.message === 'timeout';
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--white-faint);font-family:var(--font-ui);letter-spacing:2px;font-size:0.8rem;line-height:2.5">
        ${isTimeout ? '⏱️ CONNECTION TIMED OUT' : '❌ FAILED TO LOAD'}<br/>
        <span style="font-size:0.7rem;color:var(--red)">
          ${isTimeout
            ? 'Check your Supabase URL and Anon Key in app.js'
            : 'Check your internet connection and Supabase settings'
          }
        </span><br/><br/>
        <button onclick="loadProducts()" style="
          padding:10px 24px;
          background:var(--red);
          border:none;
          color:white;
          font-family:var(--font-ui);
          font-size:0.75rem;
          letter-spacing:2px;
          cursor:pointer;
        ">↺ RETRY</button>
      </div>`;
  }
}

// ====== CATEGORY DISPLAY NAMES ======
const categoryNames = {
  all:         { tag: '// THE DROP',      title: 'ALL',         accent: 'JERSEYS'    },
  football:    { tag: '// THE PITCH',     title: 'FOOTBALL',    accent: 'JERSEYS'    },
  basketball:  { tag: '// THE COURT',     title: 'BASKETBALL',  accent: 'JERSEYS'    },
  cricket:     { tag: '// THE CREASE',    title: 'CRICKET',     accent: 'JERSEYS'    },
  retro:       { tag: '// THE CLASSICS',  title: 'RETRO',       accent: 'COLLECTION' },
  streetwear:  { tag: '// THE STREETS',   title: 'STREET',      accent: 'WEAR'       },
  shirt:       { tag: '// THE FITS',      title: 'SHIRTS',      accent: 'COLLECTION' },
  't-shirt':   { tag: '// THE BASICS',    title: 'T-SHIRTS',    accent: 'COLLECTION' },
};

// ====== BUILD DYNAMIC FILTER TABS ======
function buildFilterTabs(products) {
  const filterTabs = document.getElementById('filterTabs');

  // Get unique categories from loaded products
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

  // Sort categories in preferred order
  const order = ['football', 'basketball', 'cricket', 'retro', 'streetwear', 'shirt', 't-shirt'];
  categories.sort((a, b) => order.indexOf(a) - order.indexOf(b));

  // Build tabs — ALL first then only available categories
  filterTabs.innerHTML = `
    <button class="filter-tab active" onclick="filterProducts('all', this)">ALL</button>
    ${categories.map(cat => `
      <button class="filter-tab" onclick="filterProducts('${cat}', this)">
        ${cat.toUpperCase()}
      </button>
    `).join('')}
  `;
}

// ====== UPDATE SHOP TITLE ======
function updateShopTitle(category) {
  const info   = categoryNames[category] || categoryNames['all'];
  const tag    = document.getElementById('shopTag');
  const title  = document.getElementById('shopTitle');

  // Animate out
  title.style.opacity = '0';
  title.style.transform = 'translateY(10px)';
  tag.style.opacity = '0';

  setTimeout(() => {
    tag.textContent   = info.tag;
    title.innerHTML   = `${info.title} <span>${info.accent}</span>`;

    // Animate in
    title.style.transition = 'all 0.3s ease';
    tag.style.transition   = 'all 0.3s ease';
    title.style.opacity    = '1';
    title.style.transform  = 'translateY(0)';
    tag.style.opacity      = '1';
  }, 150);
}
// ====== QUICK VIEW ======
let qvProduct = null;
let qvSelectedSize = null;
let qvQty = 1;

function openQuickView(productId) {
  qvProduct = allProducts.find(p => p.id === productId);
  qvSelectedSize = null;
  qvQty = 1;
  if (!qvProduct) return;

  // Image
  const imgWrap = document.getElementById('qvImgWrap');
  imgWrap.innerHTML = qvProduct.image
    ? `<img src="${qvProduct.image}" alt="${qvProduct.name}"/>
       <div class="qv-badge" style="${!qvProduct.badge ? 'display:none' : ''}">${qvProduct.badge || ''}</div>`
    : `<div class="qv-img-placeholder">👕</div>
       <div class="qv-badge" style="display:none"></div>`;

  // Details
  document.getElementById('qvCategory').textContent = qvProduct.category?.toUpperCase() || '';
  document.getElementById('qvName').textContent      = qvProduct.name;
  document.getElementById('qvDesc').textContent      = qvProduct.desc || '';
  document.getElementById('qvPrice').textContent     = `₹${(parseInt(qvProduct.price) || 0).toLocaleString('en-IN')}`;

  // Sizes
  document.getElementById('qvSizes').innerHTML = qvProduct.sizes.map(s => `
    <button class="qv-size-btn" onclick="selectQvSize('${s}', this)">${s}</button>
  `).join('');

  // Quantity
  updateQvQty();

  // Open
  document.getElementById('qvOverlay').classList.add('open');
  document.getElementById('qvModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function updateQvQty() {
  const qtyEl = document.getElementById('qvQtyNum');
  if (qtyEl) qtyEl.textContent = qvQty;
}

function changeQvQty(delta) {
  qvQty = Math.max(1, Math.min(10, qvQty + delta));
  updateQvQty();
}

function selectQvSize(size, el) {
  qvSelectedSize = size;
  document.querySelectorAll('.qv-size-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
}

function qvAddToCart() {
  if (!qvSelectedSize) { showToast('Please select a size!'); return; }
  closeQuickView();
  // Add with quantity
  for (let i = 0; i < qvQty; i++) {
    addToCart(qvProduct, qvSelectedSize);
  }
}

function closeQuickView() {
  document.getElementById('qvOverlay').classList.remove('open');
  document.getElementById('qvModal').classList.remove('open');
  document.body.style.overflow = '';
  qvProduct = null;
  qvSelectedSize = null;
  qvQty = 1;
}

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
    <div class="product-card" style="animation-delay:${isMobile ? 0 : i * 0.06}s" onclick="openQuickView(${p.id})">
      <div class="product-img-wrap">
        ${p.image
          ? `<img src="${p.image}" alt="${p.name}" loading="lazy"/>`
          : `<div class="product-emoji">👕</div>`
        }
        <div class="product-badge-wrap">
          ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ''}
        </div>
        <div class="product-quick-add">
          <span>QUICK VIEW</span>
          <button class="quick-add-btn" onclick="event.stopPropagation(); openSizeModal(${p.id})">ADD TO BAG</button>
        </div>
      </div>
      <div class="product-info">
        <div class="product-cat">${p.category ? p.category.toUpperCase() : ''}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-desc">${p.desc || ''}</div>
        <div class="product-footer">
          <div class="product-price">₹${p.price.toLocaleString('en-IN')}</div>
          <button class="quick-add-btn" onclick="event.stopPropagation(); openSizeModal(${p.id})">ADD</button>
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
  updateShopTitle(cat);
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

// ====== COUPON CODES ======
// Coupon usage stored in localStorage per device
// For production — move this to Supabase for cross-device tracking

const COUPONS = {
  'FIRST20'  : {
    type       : 'percent',
    value      : 20,
    desc       : '20% off — First purchase welcome!',
    rule       : 'first_time',     // Only usable once ever
    minOrder   : 0,
    maxUses    : 1,
  },
  'FLAT100'  : {
    type       : 'flat',
    value      : 100,
    desc       : '₹100 off on your order!',
    rule       : 'min_order',      // Only when order >= ₹1000
    minOrder   : 1000,
    maxUses    : Infinity,
  },
  'SE7ENFAN' : {
    type       : 'percent',
    value      : 15,
    desc       : '15% off — Loyal fan reward!',
    rule       : 'fifth_purchase', // Only on 5th purchase in a month
    minOrder   : 0,
    maxUses    : Infinity,
  },
};

let appliedCoupon  = null;
let discountAmount = 0;

// ====== COUPON HELPERS ======
function getCouponUsage(code) {
  try {
    const data = JSON.parse(localStorage.getItem('se7en_coupons') || '{}');
    return data[code] || { uses: 0, month: '' };
  } catch { return { uses: 0, month: '' }; }
}

function saveCouponUsage(code) {
  try {
    const data    = JSON.parse(localStorage.getItem('se7en_coupons') || '{}');
    const now     = new Date();
    const month   = `${now.getFullYear()}-${now.getMonth() + 1}`;
    const current = data[code] || { uses: 0, month };

    // Reset monthly count if new month
    if (current.month !== month) {
      current.uses  = 0;
      current.month = month;
    }

    current.uses += 1;
    data[code]    = current;
    localStorage.setItem('se7en_coupons', JSON.stringify(data));
  } catch(e) { console.error(e); }
}

function getOrderCount() {
  try {
    const now   = new Date();
    const month = `${now.getFullYear()}-${now.getMonth() + 1}`;
    const data  = JSON.parse(localStorage.getItem('se7en_orders') || '{}');
    const entry = data[month] || { count: 0 };
    return entry.count;
  } catch { return 0; }
}

function incrementOrderCount() {
  try {
    const now   = new Date();
    const month = `${now.getFullYear()}-${now.getMonth() + 1}`;
    const data  = JSON.parse(localStorage.getItem('se7en_orders') || '{}');
    const entry = data[month] || { count: 0 };
    entry.count += 1;
    data[month]  = entry;
    localStorage.setItem('se7en_orders', JSON.stringify(data));
  } catch(e) { console.error(e); }
}

// ====== APPLY COUPON ======
function applyCoupon() {
  const code    = document.getElementById('couponInput').value.trim().toUpperCase();
  const discRow = document.getElementById('discountRow');
  const discAmt = document.getElementById('discountAmt');

  if (!code) {
    showCouponMsg('Please enter a coupon code', 'error');
    return;
  }

  const coupon = COUPONS[code];

  if (!coupon) {
    showCouponMsg('❌ Invalid coupon code', 'error');
    appliedCoupon  = null;
    discountAmount = 0;
    discRow.style.display = 'none';
    updateCartTotals();
    return;
  }

  const subtotal = cartTotal();
  const usage    = getCouponUsage(code);
  const now      = new Date();
  const month    = `${now.getFullYear()}-${now.getMonth() + 1}`;

  // Reset monthly count if new month
  const currentUses = usage.month === month ? usage.uses : 0;

  // ── Rule checks ──

  // FIRST TIME — only 1 use ever
  if (coupon.rule === 'first_time') {
    const totalUses = JSON.parse(localStorage.getItem('se7en_coupons') || '{}');
    const allUses   = totalUses[code]?.uses || 0;
    if (allUses >= coupon.maxUses) {
      showCouponMsg('❌ This coupon has already been used', 'error');
      return;
    }
  }

  // MIN ORDER check
  if (subtotal < coupon.minOrder) {
    showCouponMsg(`❌ Minimum order ₹${coupon.minOrder.toLocaleString('en-IN')} required`, 'error');
    return;
  }

  // FIFTH PURCHASE — only on 5th order this month
  if (coupon.rule === 'fifth_purchase') {
    const orderCount = getOrderCount();
    if (orderCount < 4) {
      showCouponMsg(`❌ Available on your 5th purchase this month (${orderCount}/4 done)`, 'error');
      return;
    }
  }

  // ── All checks passed — apply ──
  if (coupon.type === 'percent') {
    discountAmount = Math.round(subtotal * coupon.value / 100);
  } else {
    discountAmount = Math.min(coupon.value, subtotal);
  }

  appliedCoupon = code;
  discRow.style.display = 'flex';
  discAmt.textContent   = `-₹${discountAmount.toLocaleString('en-IN')}`;
  showCouponMsg(`✓ ${coupon.desc}`, 'success');
  updateCartTotals();
}

function showCouponMsg(msg, type) {
  const el     = document.getElementById('couponMsg');
  el.textContent = msg;
  el.className   = `coupon-msg ${type}`;
}

function removeCoupon() {
  appliedCoupon  = null;
  discountAmount = 0;
  document.getElementById('couponInput').value         = '';
  document.getElementById('couponMsg').textContent     = '';
  document.getElementById('discountRow').style.display = 'none';
  updateCartTotals();
}

function updateCartTotals() {
  const subtotal = cartTotal();
  const final    = Math.max(0, subtotal - discountAmount);
  document.getElementById('cartSubtotal').textContent  = `₹${subtotal.toLocaleString('en-IN')}`;
  document.getElementById('cartTotal').textContent     = `₹${final.toLocaleString('en-IN')}`;

  const freeShip = document.getElementById('cartFreeShip');
  if (subtotal >= 999) {
    freeShip.textContent = '✓ You qualify for FREE delivery!';
  } else {
    freeShip.textContent = `Add ₹${(999 - subtotal).toLocaleString('en-IN')} more for free delivery`;
  }
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
  appliedCoupon  = null;
  discountAmount = 0;
  saveCart();
  updateCartUI();
}

function cartTotal() {
  return cart.reduce((sum, i) => sum + (parseInt(i.price) || 0) * (parseInt(i.qty) || 1), 0);
}

function updateCartUI() {
  const totalItems = cart.reduce((s, i) => s + (i.qty || 0), 0);
  document.getElementById('cartCount').textContent     = totalItems;
  document.getElementById('cartItemCount').textContent = `(${totalItems})`;
  // Update mobile bottom nav badge
  const mobileBadge = document.getElementById('cartBadgeMobile');
  if (mobileBadge) mobileBadge.textContent = totalItems;

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
  body.innerHTML = cart.map(item => {
    const price    = parseInt(item.price) || 0;
    const qty      = parseInt(item.qty)   || 1;
    const total    = price * qty;
    const size     = item.size || 'N/A';
    const name     = item.name || 'Product';
    const image    = item.image || null;

    return `
    <div class="cart-item">
      <div class="cart-item-img">
        ${image ? `<img src="${image}" alt="${name}"/>` : '👕'}
      </div>
      <div class="cart-item-details">
        <div class="cart-item-name">${name}</div>
        <div class="cart-item-size">SIZE: ${size}</div>
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="changeQty(${item.id},'${size}',-1)">−</button>
          <span class="qty-num">${qty}</span>
          <button class="qty-btn" onclick="changeQty(${item.id},'${size}',1)">+</button>
        </div>
      </div>
      <div class="cart-item-right">
        <div class="cart-item-price">₹${total.toLocaleString('en-IN')}</div>
        <button class="remove-btn" onclick="removeFromCart(${item.id},'${size}')">REMOVE</button>
      </div>
    </div>`;
  }).join('');

  const total = cartTotal();
  document.getElementById('cartSubtotal').textContent = `₹${total.toLocaleString('en-IN')}`;
  // Recalculate discount if coupon applied
  if (appliedCoupon && COUPONS[appliedCoupon]) {
    const coupon = COUPONS[appliedCoupon];
    if (coupon.type === 'percent') {
      discountAmount = Math.round(total * coupon.value / 100);
    } else {
      discountAmount = Math.min(coupon.value, total);
    }
    document.getElementById('discountAmt').textContent = `-₹${discountAmount.toLocaleString('en-IN')}`;
    document.getElementById('discountRow').style.display = 'flex';
  }
  updateCartTotals();

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
  const subtotal = cartTotal();
  const total    = Math.max(0, subtotal - discountAmount);

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
      const orderId = await saveOrder(response.razorpay_payment_id);
      showSuccess(orderId, response.razorpay_payment_id);
    },
    modal: {
      ondismiss: () => showToast('Payment cancelled. Try again.')
    }
  };

  if (typeof Razorpay === 'undefined') {
    showToast('Razorpay not configured. Simulating...');
    setTimeout(async () => {
      const fakePayId = 'DEMO_' + Date.now();
      const orderId = await saveOrder(fakePayId);
      showSuccess(orderId, fakePayId);
    }, 1000);
    return;
  }

  const rzp = new Razorpay(options);
  rzp.on('payment.failed', (r) => showToast('Payment failed: ' + r.error.description));
  rzp.open();
}

// ====== GENERATE CUSTOM ORDER ID ======
async function generateOrderId() {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day   = String(now.getDate()).padStart(2, '0');
  const date  = `${year}${month}${day}`;

  // Get total order count from Supabase for sequence number
  try {
    const { count } = await supabaseClient
      .from('orders')
      .select('*', { count: 'exact', head: true });
    const sequence = String((count || 0) + 1).padStart(3, '0');
    return `SE7EN-${date}-${sequence}`;
  } catch {
    // Fallback if count fails
    const random = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
    return `SE7EN-${date}-${random}`;
  }
}

// ====== SAVE ORDER TO SUPABASE ======
async function saveOrder(paymentId) {
  if (!supabaseClient) {
    console.log('Order (Supabase not configured):', { paymentId, customerAddress, cart, total: cartTotal() });
    return null;
  }
  try {
    const orderId = await generateOrderId();
    const { error } = await supabaseClient.from('orders').insert({
      order_id         : orderId,
      payment_id       : paymentId,
      customer_name    : customerAddress?.name,
      customer_phone   : customerAddress?.phone,
      customer_email   : customerAddress?.email,
      delivery_address : customerAddress?.address,
      items            : JSON.stringify(cart),
      total_amount     : cartTotal(),
      status           : 'confirmed',
      created_at       : new Date().toISOString()
    });
    if (error) console.error('Order save error:', error);
    return orderId;
  } catch (e) {
    console.error('Order save failed:', e);
    return null;
  }
}

// ====== SUCCESS ======
function showSuccess(orderId, paymentId) {
  document.getElementById('successPid').textContent = `Order ID: ${orderId}`;
  openModal('successModalBg');

  // Save coupon usage if one was applied
  if (appliedCoupon) {
    saveCouponUsage(appliedCoupon);
    appliedCoupon  = null;
    discountAmount = 0;
  }

  // Increment order count for this month
  incrementOrderCount();

  sendEmailConfirmation(orderId, paymentId);
  sendOwnerEmailNotification(orderId, paymentId);
  sendWhatsAppConfirmation(orderId, paymentId);
}

// ====== SEND EMAIL NOTIFICATION TO OWNER ======
async function sendOwnerEmailNotification(orderId, paymentId) {
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
    order_id         : orderId,
    payment_id       : paymentId,
  };

  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_OWNER_TEMPLATE_ID, templateParams);
    console.log('Owner notification email sent!');
  } catch (err) {
    console.error('Owner email failed:', err);
  }
}

// ====== SEND EMAIL CONFIRMATION TO CUSTOMER ======
async function sendEmailConfirmation(orderId, paymentId) {
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
    order_id         : orderId,
    payment_id       : paymentId,
  };

  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
    console.log('Email confirmation sent successfully!');
  } catch (err) {
    console.error('Email send failed:', err);
  }
}

// ====== SEND WHATSAPP ORDER CONFIRMATION TO CUSTOMER ======
function sendWhatsAppConfirmation(orderId, paymentId) {
  const customerPhone = customerAddress?.phone?.replace(/\D/g, '');
  if (!customerPhone) return;

  const itemsList = cart.map(i =>
    `▸ ${i.name} (Size: ${i.size}) x${i.qty} — ₹${(i.price * i.qty).toLocaleString('en-IN')}`
  ).join('\n');

  const total = cartTotal();
  const freeDelivery = total >= 999 ? 'FREE ✅' : '₹49';

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
🔖 *Order ID:* ${orderId}
💳 *Payment ID:* ${paymentId}

━━━━━━━━━━━━━━━━━━━━
Thank you for shopping with *SE7EN!* 🔴
Your order will be dispatched soon.
For any queries contact us:
📞 +91 9965682888
📸 @se7en.inn`;

  const encoded = encodeURIComponent(message);
  const isMobile = /iPhone|Android/i.test(navigator.userAgent);
  const waURL = isMobile
    ? `whatsapp://send?phone=91${customerPhone}&text=${encoded}`
    : `https://wa.me/91${customerPhone}?text=${encoded}`;

  setTimeout(() => { window.open(waURL, '_blank'); }, 1500);
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

}
