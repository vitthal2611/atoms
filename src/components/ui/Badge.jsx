import { theme } from "../../constants/theme.js";

/**
 * Badge component for labels, counts, and status indicators
 */
export function Badge({
  children,
  variant = "default",
  size = "md",
  icon = null,
  style = {},
}) {
  const variants = {
    default: {
      background: theme.surf2,
      color: theme.text2,
    },
    primary: {
      background: `${theme.primary}18`,
      color: theme.primary,
    },
    success: {
      background: "#D1FAE5",
      color: "#047857",
    },
    warning: {
      background: "#FEF3C7",
      color: "#92400E",
    },
    danger: {
      background: "#FEE2E2",
      color: "#B91C1C",
    },
    gold: {
      background: "#FEF3C7",
      color: "#B07B1E",
    },
  };

  const sizes = {
    sm: { padding: "3px 8px", fontSize: 11 },
    md: { padding: "5px 11px", fontSize: 12 },
    lg: { padding: "7px 14px", fontSize: 13 },
  };

  const variantStyle = variants[variant] || variants.default;
  const sizeStyle = sizes[size] || sizes.md;

  return (
    <span
      style={{
        ...sizeStyle,
        ...variantStyle,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        borderRadius: 8,
        fontWeight: 700,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {icon && icon}
      {children}
    </span>
  );
}
