/* Jose Madrid Salsa — minimal theme interactions */
(function () {
  'use strict';

  /* ---- Mobile nav drawer ---- */
  function initDrawer() {
    var drawer = document.getElementById('mobile-drawer');
    if (!drawer) return;
    var openBtns = document.querySelectorAll('[data-drawer-open]');
    var closeEls = drawer.querySelectorAll('[data-drawer-close]');
    function setOpen(open) {
      drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
      document.body.style.overflow = open ? 'hidden' : '';
    }
    openBtns.forEach(function (b) { b.addEventListener('click', function () { setOpen(true); }); });
    closeEls.forEach(function (b) { b.addEventListener('click', function () { setOpen(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
  }

  /* ---- Quantity steppers ---- */
  function initQty() {
    document.querySelectorAll('[data-qty]').forEach(function (wrap) {
      var input = wrap.querySelector('input');
      wrap.querySelectorAll('[data-qty-step]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var step = parseInt(btn.getAttribute('data-qty-step'), 10);
          var min = parseInt(input.min || '1', 10);
          var val = Math.max(min, (parseInt(input.value, 10) || min) + step);
          input.value = val;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });
      });
    });
  }

  /* ---- Product variant selection (updates price + hidden id) ---- */
  function initVariants() {
    var root = document.querySelector('[data-product-json]');
    if (!root) return;
    var product;
    try { product = JSON.parse(root.textContent); } catch (e) { return; }
    var form = document.querySelector('[data-product-form]');
    if (!form) return;
    var idInput = form.querySelector('[name="id"]');
    var priceEl = document.querySelector('[data-product-price]');
    var selects = form.querySelectorAll('[data-variant-option]');

    function currentVariant() {
      var chosen = Array.prototype.map.call(selects, function (s) { return s.value; });
      return product.variants.find(function (v) {
        return v.options.every(function (opt, i) { return opt === chosen[i]; });
      });
    }
    function update() {
      var v = currentVariant();
      if (!v) return;
      if (idInput) idInput.value = v.id;
      if (priceEl) priceEl.textContent = formatMoney(v.price);
      var addBtn = form.querySelector('[data-add-to-cart]');
      if (addBtn) {
        addBtn.disabled = !v.available;
        addBtn.textContent = v.available ? addBtn.dataset.label || 'Add to cart' : 'Sold out';
      }
    }
    selects.forEach(function (s) { s.addEventListener('change', update); });
    update();
  }

  function formatMoney(cents) {
    return '$' + (cents / 100).toFixed(2);
  }

  document.addEventListener('DOMContentLoaded', function () {
    initDrawer();
    initQty();
    initVariants();
  });
})();
