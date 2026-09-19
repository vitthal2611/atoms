import { Icon } from "./Icon.jsx";
import { theme } from "../../constants/theme.js";

/**
 * Alert component for notifications and messages
 */
export function Alert({
  variant = "info",
  title = null,
  children,
  onClose = null,
  style = {},
}) {
  const variants = {
    info: {
      background: "#E0F2FE",
      border: "#7DD3FC",
      color: "#0369A1",
      icon: "info",
    },
    success: {
      background: "#D1FAE5",
      border: "#6EE7B7",
      color: "#047857",
      icon: "check",
    },
    warning: {
      background: "#FEF3C7",
      border: "#FDE68A",
      color: "#92400E",
      icon: "info",
    },
    danger: {
      background: "#FEE2E2",
      border: "#FECACA",
      color: "#B91C1C",
      icon: "info",
    },
  };

  const variantStyle = variants[variant] || variants.info;

  return (
    <div
      role="alert"
      style={{
        display: "flex",
        gap: 12,
        padding: 14,
        background: variantStyle.background,
        border: `1px solid ${variantStyle.border}`,
        borderRadius: 12,
        ...style,
      }}
    >
      <div style={{ flexShrink: 0, marginTop: 2 }}>
        <Icon name={variantStyle.icon} size={18} color={variantStyle.color} />
      </div>

      <div style={{ flex: 1 }}>
        {title && (
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: variantStyle.color,
              marginBottom: 4,
            }}
          >
            {title}
          </div>
        )}
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: variantStyle.color,
            lineHeight: 1.5,
          }}
        >
          {children}
        </div>
      </div>

      {onClose && (
        <button
          onClick={onClose}
          aria-label="Close alert"
          style={{
            flexShrink: 0,
            padding: 4,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            color: variantStyle.color,
            opacity: 0.7,
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.7)}
        >
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}
