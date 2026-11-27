/**
 * Respuesta háptica.
 * - Android y navegadores con Vibration API: navigator.vibrate.
 * - iPhone (Safari no implementa vibrate): desde iOS 18, pulsar un <input type="checkbox" switch>
 *   produce el toque háptico del sistema. Se usa un interruptor oculto y se «pulsa» desde
 *   el mismo gesto del usuario.
 * Se puede desactivar en Ajustes; la preferencia vive en localStorage para leerla sin esperas.
 */
export type HapticKind = 'light' | 'success' | 'warning';

const KEY = 'pulso.haptics';
let hiddenSwitch: HTMLLabelElement | null = null;
let firing = false;

export function hapticsEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setHapticsEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* almacenamiento no disponible: se ignora */
  }
}

function iosTick() {
  if (!hiddenSwitch) {
    hiddenSwitch = document.createElement('label');
    hiddenSwitch.setAttribute('aria-hidden', 'true');
    hiddenSwitch.dataset.hapticInternal = '';
    hiddenSwitch.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    hiddenSwitch.appendChild(input);
    document.body.appendChild(hiddenSwitch);
  }
  firing = true;
  hiddenSwitch.click();
  firing = false;
}

export function haptic(kind: HapticKind = 'light') {
  if (!hapticsEnabled()) return;
  if (typeof navigator.vibrate === 'function') {
    navigator.vibrate(kind === 'light' ? 8 : kind === 'success' ? [10, 50, 14] : [24, 60, 24]);
    return;
  }
  iosTick();
  if (kind !== 'light') setTimeout(iosTick, 90);
}

/**
 * Un toque ligero en cualquier botón o enlace. Cada elemento puede pedir otro tipo con
 * data-haptic="success" | "warning", o ninguno con data-haptic="none".
 */
export function installGlobalHaptics() {
  document.addEventListener(
    'click',
    (e) => {
      if (firing) return;
      const el = (e.target as Element | null)?.closest<HTMLElement>('button, a, [role="button"], input[type="checkbox"]');
      if (!el || el.closest('[data-haptic-internal]')) return;
      const kind = el.dataset.haptic as HapticKind | 'none' | undefined;
      if (kind === 'none') return;
      haptic(kind ?? 'light');
    },
    { capture: true }
  );
}
