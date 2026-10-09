// Minimalist TV On-Screen Keyboard for 10-foot remote control navigation
(function() {
  if (typeof window === 'undefined') return;

  let activeInput = null;
  let isShift = false;
  let currentVal = '';
  let activeIndex = 0;
  let overlay = null;
  let justClosedAt = 0;

  const ROWS = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', '@'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', '.', '_', '-'],
    ['MAYÚS', 'ESPACIO', 'BORRAR', '.com', '@gmail.com', 'LISTO']
  ];

  function createKeyboard() {
    if (document.getElementById('tv-keyboard-overlay')) return document.getElementById('tv-keyboard-overlay');

    const container = document.createElement('div');
    container.id = 'tv-keyboard-overlay';
    container.className = 'tv-keyboard-overlay';
    container.style.display = 'none';

    container.innerHTML = `
      <div class="tv-keyboard-modal">
        <div class="tv-keyboard-header">
          <span class="tv-keyboard-label">Teclado en pantalla</span>
          <div class="tv-keyboard-display">
            <span class="tv-keyboard-text"></span>
            <span class="tv-keyboard-cursor"></span>
          </div>
        </div>
        <div class="tv-keyboard-grid"></div>
      </div>
    `;

    document.body.appendChild(container);
    return container;
  }

  function renderKeys() {
    overlay = overlay || createKeyboard();
    const grid = overlay.querySelector('.tv-keyboard-grid');
    grid.innerHTML = '';

    ROWS.forEach((row, rIdx) => {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'tv-kb-row';
      row.forEach((key, cIdx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tv-kb-key';
        let display = key;
        if (key.length === 1) {
          display = isShift ? key.toUpperCase() : key.toLowerCase();
        } else if (key === 'MAYÚS') {
          btn.classList.add('tv-kb-shift');
          if (isShift) btn.classList.add('active');
        } else if (key === 'LISTO') {
          btn.classList.add('tv-kb-done');
        } else if (key === 'ESPACIO') {
          btn.classList.add('tv-kb-space');
        }
        btn.textContent = display;
        btn.dataset.key = key;
        btn.dataset.row = rIdx;
        btn.dataset.col = cIdx;
        btn.addEventListener('click', () => handleKeyPress(key));
        rowDiv.appendChild(btn);
      });
      grid.appendChild(rowDiv);
    });

    updateDisplay();
  }

  function updateDisplay() {
    if (!overlay) return;
    const textSpan = overlay.querySelector('.tv-keyboard-text');
    if (textSpan) {
      if (activeInput && activeInput.type === 'password') {
        textSpan.textContent = '•'.repeat(currentVal.length);
      } else {
        textSpan.textContent = currentVal || '';
      }
    }
    const labelSpan = overlay.querySelector('.tv-keyboard-label');
    if (labelSpan && activeInput) {
      labelSpan.textContent = activeInput.placeholder || activeInput.getAttribute('aria-label') || 'Escribir';
    }
  }

  function handleKeyPress(key) {
    if (!activeInput) return;

    if (key === 'MAYÚS') {
      isShift = !isShift;
      renderKeys();
      focusKeyIndex(activeIndex);
      return;
    }

    if (key === 'BORRAR') {
      currentVal = currentVal.slice(0, -1);
      syncValueToInput();
      updateDisplay();
      return;
    }

    if (key === 'ESPACIO') {
      currentVal += ' ';
      syncValueToInput();
      updateDisplay();
      return;
    }

    if (key === 'LISTO') {
      closeTvKeyboard(true);
      return;
    }

    if (key === '.com' || key === '@gmail.com') {
      currentVal += key;
      syncValueToInput();
      updateDisplay();
      return;
    }

    // Single character
    const char = isShift ? key.toUpperCase() : key.toLowerCase();
    currentVal += char;
    syncValueToInput();
    updateDisplay();
  }

  function syncValueToInput() {
    if (!activeInput) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (setter) {
      setter.call(activeInput, currentVal);
    } else {
      activeInput.value = currentVal;
    }
    activeInput.dispatchEvent(new Event('input', { bubbles: true }));
    activeInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function focusKeyIndex(idx) {
    if (!overlay) return;
    const keys = overlay.querySelectorAll('.tv-kb-key');
    if (!keys.length) return;
    activeIndex = Math.max(0, Math.min(keys.length - 1, idx));
    keys.forEach((k, i) => {
      if (i === activeIndex) {
        k.classList.add('focused');
        k.focus();
      } else {
        k.classList.remove('focused');
      }
    });
  }

  function getKeysFlat() {
    if (!overlay) return [];
    return Array.from(overlay.querySelectorAll('.tv-kb-key'));
  }

  function handleKeyboardNav(e) {
    if (!overlay || overlay.style.display === 'none') {
      return;
    }

    const isBack = e.key === 'Escape' || (e.key === 'Backspace' && activeIndex !== -1);
    const isEnter = e.key === 'Enter' || e.key === 'Select' || e.keyCode === 13 || e.keyCode === 23;

    if (isBack && e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      closeTvKeyboard(false);
      return;
    }

    if (isEnter) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const keys = getKeysFlat();
      if (keys[activeIndex]) {
        keys[activeIndex].click();
      }
      return;
    }

    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    const keys = getKeysFlat();
    if (!keys.length) return;

    const currentKey = keys[activeIndex];
    const currRow = parseInt(currentKey.dataset.row, 10);
    const currCol = parseInt(currentKey.dataset.col, 10);

    let nextKey = null;

    if (e.key === 'ArrowLeft') {
      const rowKeys = keys.filter(k => parseInt(k.dataset.row, 10) === currRow);
      const colIdx = rowKeys.indexOf(currentKey);
      nextKey = colIdx > 0 ? rowKeys[colIdx - 1] : rowKeys[rowKeys.length - 1];
    } else if (e.key === 'ArrowRight') {
      const rowKeys = keys.filter(k => parseInt(k.dataset.row, 10) === currRow);
      const colIdx = rowKeys.indexOf(currentKey);
      nextKey = colIdx < rowKeys.length - 1 ? rowKeys[colIdx + 1] : rowKeys[0];
    } else if (e.key === 'ArrowUp') {
      const targetRow = currRow > 0 ? currRow - 1 : ROWS.length - 1;
      const rowKeys = keys.filter(k => parseInt(k.dataset.row, 10) === targetRow);
      const ratio = currCol / (ROWS[currRow].length - 1 || 1);
      const targetColIdx = Math.min(rowKeys.length - 1, Math.round(ratio * (rowKeys.length - 1)));
      nextKey = rowKeys[targetColIdx];
    } else if (e.key === 'ArrowDown') {
      const targetRow = currRow < ROWS.length - 1 ? currRow + 1 : 0;
      const rowKeys = keys.filter(k => parseInt(k.dataset.row, 10) === targetRow);
      const ratio = currCol / (ROWS[currRow].length - 1 || 1);
      const targetColIdx = Math.min(rowKeys.length - 1, Math.round(ratio * (rowKeys.length - 1)));
      nextKey = rowKeys[targetColIdx];
    }

    if (nextKey) {
      const idx = keys.indexOf(nextKey);
      focusKeyIndex(idx);
    }
  }

  function isTextInput(el) {
    return !!el && el.tagName === 'INPUT' && !el.disabled &&
      !/^(button|submit|checkbox|radio|range|file|image|reset)$/i.test(el.type || 'text');
  }

  function openTvKeyboard(input) {
    if (!input) return;
    if (overlay && overlay.style.display !== 'none' && activeInput === input) return;
    if (Date.now() - justClosedAt < 300) return;
    activeInput = input;
    currentVal = input.value || '';
    overlay = overlay || createKeyboard();
    renderKeys();
    overlay.style.display = 'flex';
    activeIndex = 0;
    focusKeyIndex(0);
  }

  function closeTvKeyboard(submitted = false) {
    if (!overlay) return;
    justClosedAt = Date.now();
    overlay.style.display = 'none';

    const target = activeInput;
    activeInput = null;

    if (target) {
      target.focus();
      if (submitted) {
        const ev = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true });
        ev.__fromTvKeyboard = true;
        target.dispatchEvent(ev);
      }
    }
  }

  // Global capture listener only when the custom overlay is visible
  window.addEventListener('keydown', handleKeyboardNav, true);

  // Global helper
  window.__openTvKeyboard = openTvKeyboard;
  window.__closeTvKeyboard = closeTvKeyboard;
})();
