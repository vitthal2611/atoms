import { useEffect, useRef, useId } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon.jsx";
import { theme } from "../../constants/theme.js";

/**
 * Accessible modal dialog component
 */
export function Modal({ title, onClose, children, descriptionId, maxWidth = 560 }) {
  const titleId = useId();
  const panelRef = useRef(null);
  const prevFocusRef = useRef(null);

  useEffect(() => {
    prevFocusRef.current = document.activeElement;

    const el = panelRef.current;
    if (!el) return;

    // Focus first focusable element
    const focusable = () => el.querySelectorAll(
      'button,input,select,textarea,[tabindex]:not([tabindex="-1"])'
    );
    const first = focusable()[0];
    if (first) first.focus();

    // Tab focus trap
    const trap = (e) => {
      if (e.key !== "Tab") return;
      const els = focusable();
      if (!els.length) return;
      const f = els[0], l = els[els.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === f) {
          e.preventDefault();
          l.focus();
        }
      } else {
        if (document.activeElement === l) {
          e.preventDefault();
          f.focus();
        }
      }
    };

    // Escape to close
    const esc = (e) => {
      if (e.key === "Escape") onClose();
    };

    el.addEventListener("keydown", trap);
    document.addEventListener("keydown", esc);

    return () => {
      el.removeEventListener("keydown", trap);
      document.removeEventListener("keydown", esc);
      if (prevFocusRef.current?.focus) prevFocusRef.current.focus();
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(12,74,110,0.5)",
        backdropFilter: "blur(2px)",
        padding: 16,
        animation: "fadeIn 0.15s ease-out",
      }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.surface,
          borderRadius: 20,
          boxShadow: "0 20px 50px rgba(9,45,75,0.35)",
          width: "100%",
          maxWidth,
          maxHeight: "90dvh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "slideUp 0.2s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 20px",
          borderBottom: `1px solid ${theme.border}`,
          flexShrink: 0,
        }}>
          <h2 id={titleId} style={{
            fontSize: 19,
            fontWeight: 800,
            color: theme.text,
            margin: 0,
          }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              padding: 8,
              border: "none",
              background: "transparent",
              borderRadius: 8,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: theme.muted,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.surf2;
              e.currentTarget.style.color = theme.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = theme.muted;
            }}
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <div style={{
          padding: "20px",
          overflowY: "auto",
          flex: 1,
        }}>
          {children}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px) scale(0.96); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>,
    document.body
  );
}
