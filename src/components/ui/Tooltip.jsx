import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { theme } from "../../constants/theme.js";

/**
 * Tooltip component for hover hints
 */
export function Tooltip({
  children,
  content,
  placement = "top",
  delay = 400,
}) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const timeoutRef = useRef(null);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      let top, left;
      const gap = 8;

      switch (placement) {
        case "top":
          top = rect.top - gap;
          left = rect.left + rect.width / 2;
          break;
        case "bottom":
          top = rect.bottom + gap;
          left = rect.left + rect.width / 2;
          break;
        case "left":
          top = rect.top + rect.height / 2;
          left = rect.left - gap;
          break;
        case "right":
          top = rect.top + rect.height / 2;
          left = rect.right + gap;
          break;
        default:
          top = rect.top - gap;
          left = rect.left + rect.width / 2;
      }

      setPos({ top, left });
      setVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        style={{ display: "inline-block" }}
      >
        {children}
      </div>

      {visible && pos && createPortal(
        <div
          role="tooltip"
          style={{
            position: "fixed",
            top: placement === "bottom" ? pos.top : placement === "top" ? pos.top - 32 : pos.top,
            left: pos.left,
            transform: placement === "left" || placement === "right"
              ? "translateY(-50%)"
              : "translateX(-50%)",
            zIndex: 300,
            background: theme.text,
            color: "#fff",
            padding: "6px 10px",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: "nowrap",
            maxWidth: 240,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            pointerEvents: "none",
            animation: "tooltipFadeIn 0.15s ease-out",
          }}
        >
          {content}
          <style>{`
            @keyframes tooltipFadeIn {
              from { opacity: 0; transform: translateY(4px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>,
        document.body
      )}
    </>
  );
}
