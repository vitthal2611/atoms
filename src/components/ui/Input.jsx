import { theme } from "../../constants/theme.js";

/**
 * Reusable input component
 */
export function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
  error = null,
  label = null,
  icon = null,
  style = {},
  ...props
}) {
  return (
    <div style={{ width: "100%" }}>
      {label && (
        <label style={{
          display: "block",
          fontSize: 13,
          fontWeight: 700,
          color: theme.text2,
          marginBottom: 6,
        }}>
          {label}
        </label>
      )}
      
      <div style={{ position: "relative" }}>
        {icon && (
          <div style={{
            position: "absolute",
            left: 14,
            top: "50%",
            transform: "translateY(-50%)",
            color: theme.muted,
            pointerEvents: "none",
          }}>
            {icon}
          </div>
        )}
        
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            width: "100%",
            padding: icon ? "11px 14px 11px 42px" : "11px 14px",
            fontSize: 14,
            fontWeight: 500,
            color: theme.text,
            background: disabled ? theme.surf2 : theme.surface,
            border: `1px solid ${error ? theme.red : theme.border}`,
            borderRadius: 10,
            outline: "none",
            transition: "all 0.15s",
            fontFamily: "'Nunito', -apple-system, sans-serif",
            ...style,
          }}
          onFocus={(e) => {
            if (!error) {
              e.currentTarget.style.borderColor = theme.primary;
              e.currentTarget.style.boxShadow = `0 0 0 3px ${theme.primary}18`;
            }
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error ? theme.red : theme.border;
            e.currentTarget.style.boxShadow = "none";
          }}
          {...props}
        />
      </div>
      
      {error && (
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: theme.red,
          marginTop: 4,
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

/**
 * Textarea component
 */
export function Textarea({
  value,
  onChange,
  placeholder,
  disabled = false,
  error = null,
  label = null,
  rows = 4,
  style = {},
  ...props
}) {
  return (
    <div style={{ width: "100%" }}>
      {label && (
        <label style={{
          display: "block",
          fontSize: 13,
          fontWeight: 700,
          color: theme.text2,
          marginBottom: 6,
        }}>
          {label}
        </label>
      )}
      
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        style={{
          width: "100%",
          padding: "11px 14px",
          fontSize: 14,
          fontWeight: 500,
          color: theme.text,
          background: disabled ? theme.surf2 : theme.surface,
          border: `1px solid ${error ? theme.red : theme.border}`,
          borderRadius: 10,
          outline: "none",
          transition: "all 0.15s",
          fontFamily: "'Nunito', -apple-system, sans-serif",
          resize: "vertical",
          ...style,
        }}
        onFocus={(e) => {
          if (!error) {
            e.currentTarget.style.borderColor = theme.primary;
            e.currentTarget.style.boxShadow = `0 0 0 3px ${theme.primary}18`;
          }
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? theme.red : theme.border;
          e.currentTarget.style.boxShadow = "none";
        }}
        {...props}
      />
      
      {error && (
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: theme.red,
          marginTop: 4,
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
