import { theme } from "../../constants/theme.js";
import { Button } from "./Button.jsx";

/**
 * Empty state component for when there's no data to display
 */
export function EmptyState({
  icon = "📋",
  title = "Nothing here yet",
  description = null,
  action = null,
  actionLabel = null,
  onAction = null,
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 56,
          marginBottom: 16,
          opacity: 0.8,
        }}
        aria-hidden="true"
      >
        {icon}
      </div>
      
      <h3
        style={{
          fontSize: 18,
          fontWeight: 800,
          color: theme.text,
          margin: "0 0 8px",
        }}
      >
        {title}
      </h3>
      
      {description && (
        <p
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: theme.muted,
            margin: "0 0 24px",
            maxWidth: 400,
          }}
        >
          {description}
        </p>
      )}
      
      {(action || (actionLabel && onAction)) && (
        action || <Button onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  );
}
