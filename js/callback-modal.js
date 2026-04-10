(function() {
  var modal = document.getElementById('callback-modal');
  if (!modal) return;

  var overlay = modal.querySelector('.cbm-overlay');
  var closeBtn = modal.querySelector('.cbm-close');
  var box = modal.querySelector('.cbm-box');
  var form = modal.querySelector('.cbm-form');

  function open() {
    modal.classList.remove('cbm--closing');
    modal.classList.add('cbm--open');
  }

  function close() {
    modal.classList.add('cbm--closing');
    box.addEventListener('animationend', function handler() {
      box.removeEventListener('animationend', handler);
      modal.classList.remove('cbm--open', 'cbm--closing');
    });
  }

  document.querySelectorAll('.hdr-cta').forEach(function(btn) {
    btn.addEventListener('click', open);
  });

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', close);
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') close();
  });

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    window.location.href = 'thanks.html';
  });
})();
