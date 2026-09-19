import { theme } from "../../constants/theme.js";

/**
 * Reusable button component with variants
 */
export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  type = "button",
  fullWidth = false,
  icon = null,
  style = {},
  ...props
}) {
  const variants = {
    primary: {
      background: theme.primary,
      color: "#fff",
      hoverBg: "#0369A1",
    },
    secondary: {
      background: theme.surf2,
      color: theme.primary,
      hoverBg: theme.border2,
    },
    danger: {
      background: theme.red,
      color: "#fff",
      hoverBg: "#DC2626",
    },
    ghost: {
      background: "transparent",
      color: theme.text,
      hoverBg: theme.surf2,
    },
  };

  const sizes = {
    sm: { padding: "8px 14px", fontSize: 13 },
    md: { padding: "11px 20px", fontSize: 14 },
    lg: { padding: "14px 26px", fontSize: 15 },
  };

  const variantStyle = variants[variant] || variants.primary;
  const sizeStyle = sizes[size] || sizes.md;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...sizeStyle,
        background: disabled ? theme.border : variantStyle.background,
        color: disabled ? theme.muted : variantStyle.color,
        border: "none",
        borderRadius: 12,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: fullWidth ? "100%" : "auto",
        transition: "all 0.15s",
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = variantStyle.hoverBg;
          e.currentTarget.style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = variantStyle.background;
          e.currentTarget.style.transform = "translateY(0)";
        }
      }}
      {...props}
    >
      {icon && icon}
      {children}
    </button>
  );
}
