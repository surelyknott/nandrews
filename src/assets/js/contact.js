document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('success') !== '1') return;

  const successEl = document.getElementById('contactSuccess');
  if (successEl) {
    successEl.classList.remove('d-none');
  }
});
