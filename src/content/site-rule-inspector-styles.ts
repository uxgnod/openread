export const INSPECTOR_CLASS = "openread-site-rule-inspector"

const STYLE_ID = "openread-site-rule-inspector-style"

export function injectInspectorStyles(): void {
  if (document.getElementById(STYLE_ID)) {
    return
  }

  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = `
    .${INSPECTOR_CLASS} {
      background: rgba(255, 253, 247, 0.98);
      border: 1px solid rgba(216, 210, 194, 0.95);
      border-radius: 8px;
      box-shadow: 0 18px 48px rgba(20, 20, 19, 0.22);
      box-sizing: border-box;
      color: #141413;
      display: grid;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      gap: 10px;
      line-height: 1.4;
      max-height: calc(100vh - 32px);
      overflow: auto;
      padding: 12px;
      position: fixed;
      right: max(16px, env(safe-area-inset-right));
      top: max(16px, env(safe-area-inset-top));
      width: min(360px, calc(100vw - 32px));
      z-index: 2147483647;
    }

    .${INSPECTOR_CLASS} h2,
    .${INSPECTOR_CLASS} p {
      margin: 0;
    }

    .${INSPECTOR_CLASS} h2 {
      font-size: 16px;
      line-height: 1.2;
    }

    .${INSPECTOR_CLASS}__hint,
    .${INSPECTOR_CLASS}__empty,
    .${INSPECTOR_CLASS}__preview p {
      color: #6f6b62;
      font-size: 12px;
    }

    .${INSPECTOR_CLASS} button,
    .${INSPECTOR_CLASS} select {
      border-radius: 7px;
      font: inherit;
      font-size: 12px;
    }

    .${INSPECTOR_CLASS} button {
      background: #141413;
      border: 0;
      color: #fffaf2;
      cursor: pointer;
      font-weight: 650;
      padding: 7px 9px;
    }

    .${INSPECTOR_CLASS} button:disabled {
      cursor: not-allowed;
      opacity: 0.52;
    }

    .${INSPECTOR_CLASS}__secondary {
      background: #e8e6dc !important;
      color: #141413 !important;
    }

    .${INSPECTOR_CLASS}__field,
    .${INSPECTOR_CLASS}__section,
    .${INSPECTOR_CLASS}__preview {
      display: grid;
      gap: 6px;
    }

    .${INSPECTOR_CLASS} select {
      background: #fffdf7;
      border: 1px solid #b8b1a4;
      color: #141413;
      padding: 7px 8px;
      width: 100%;
    }

    .${INSPECTOR_CLASS}__row {
      align-items: center;
      background: #f0eee6;
      border: 1px solid #d8d2c2;
      border-radius: 7px;
      display: grid;
      gap: 8px;
      grid-template-columns: 1fr auto;
      padding: 7px;
    }

    .${INSPECTOR_CLASS}__row span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .${INSPECTOR_CLASS}__icon-button {
      height: 24px;
      padding: 0 !important;
      width: 24px;
    }

    .${INSPECTOR_CLASS}__actions {
      display: grid;
      gap: 7px;
      grid-template-columns: 1fr 1fr;
    }

    .${INSPECTOR_CLASS}__preview {
      background: #f0eee6;
      border: 1px solid #d8d2c2;
      border-radius: 7px;
      padding: 9px;
    }

    .${INSPECTOR_CLASS}__preview ul {
      margin: 0;
      padding-left: 18px;
    }

    .${INSPECTOR_CLASS}__highlight {
      background: rgba(217, 119, 87, 0.16);
      border: 2px solid #d97757;
      border-radius: 6px;
      box-shadow: 0 0 0 2px rgba(255, 253, 247, 0.65);
      box-sizing: border-box;
      display: none;
      left: 0;
      pointer-events: none;
      position: fixed;
      top: 0;
      z-index: 2147483646;
    }

    .${INSPECTOR_CLASS}__selected-highlight {
      background: rgba(139, 92, 246, 0.12);
      border: 2px solid #8b5cf6;
      border-radius: 6px;
      box-shadow: 0 0 0 2px rgba(255, 253, 247, 0.6);
      box-sizing: border-box;
      display: none;
      left: 0;
      pointer-events: none;
      position: fixed;
      top: 0;
      z-index: 2147483645;
    }

    .${INSPECTOR_CLASS}__selected-highlight span {
      background: #8b5cf6;
      border-radius: 999px;
      color: #fffaf2;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 11px;
      font-weight: 700;
      line-height: 1;
      padding: 5px 7px;
      position: absolute;
      right: 8px;
      top: -13px;
      white-space: nowrap;
    }

    .${INSPECTOR_CLASS}__toast {
      border-radius: 8px;
      box-shadow: 0 14px 36px rgba(20, 20, 19, 0.18);
      box-sizing: border-box;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      font-weight: 650;
      max-width: min(420px, calc(100vw - 32px));
      padding: 12px 14px;
      pointer-events: none;
      position: fixed;
      right: max(16px, env(safe-area-inset-right));
      top: max(16px, env(safe-area-inset-top));
      z-index: 2147483647;
    }

    .${INSPECTOR_CLASS}__toast--success {
      background: #eef4e8;
      border: 1px solid rgba(95, 127, 63, 0.26);
      color: #5f7f3f;
    }

    .${INSPECTOR_CLASS}__toast--error {
      background: #fff1ea;
      border: 1px solid rgba(159, 61, 43, 0.22);
      color: #9f3d2b;
    }
  `
  document.documentElement.appendChild(style)
}
