import { theme } from "../../constants/theme.js";

/**
 * Reusable card component
 */
export function Card({
  children,
  padding = 16,
  hoverable = false,
  onClick = null,
  style = {},
  ...props
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: 16,
        padding,
        transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
        cursor: onClick || hoverable ? "pointer" : "default",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (hoverable || onClick) {
          e.currentTarget.style.borderColor = theme.border2;
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(9,45,75,0.1)";
        }
      }}
      onMouseLeave={(e) => {
        if (hoverable || onClick) {
          e.currentTarget.style.borderColor = theme.border;
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "none";
        }
      }}
      {...props}
    >
      {children}
    </div>
  );
}
