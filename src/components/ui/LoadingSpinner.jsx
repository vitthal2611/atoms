import { theme } from "../../constants/theme.js";

/**
 * Loading spinner component
 */
export function LoadingSpinner({ size = 24, color = theme.primary, style = {} }) {
  return (
    <div
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: `3px solid ${theme.border}`,
        borderTopColor: color,
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
        ...style,
      }}
      role="status"
      aria-label="Loading"
    >
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/**
 * Full-screen loading overlay
 */
export function LoadingOverlay({ message = "Loading..." }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        background: "rgba(240,249,255,0.9)",
        backdropFilter: "blur(4px)",
      }}
    >
      <LoadingSpinner size={40} />
      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: theme.text2,
        }}
      >
        {message}
      </div>
    </div>
  );
}
