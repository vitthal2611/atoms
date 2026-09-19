import { useState } from "react";
import { theme } from "../../constants/theme.js";

/**
 * Tabs component for navigation between views
 */
export function Tabs({
  tabs = [],
  defaultTab = null,
  onChange = null,
  children,
}) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (onChange) onChange(tabId);
  };

  return (
    <div>
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: 4,
          borderBottom: `2px solid ${theme.border}`,
          marginBottom: 20,
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => handleTabChange(tab.id)}
              style={{
                padding: "10px 18px",
                border: "none",
                background: "transparent",
                borderBottom: `2px solid ${isActive ? theme.primary : "transparent"}`,
                marginBottom: -2,
                fontSize: 14,
                fontWeight: isActive ? 800 : 600,
                color: isActive ? theme.primary : theme.muted,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = theme.text2;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = theme.muted;
                }
              }}
            >
              {tab.icon && <span style={{ marginRight: 6 }}>{tab.icon}</span>}
              {tab.label}
              {tab.badge && (
                <span
                  style={{
                    marginLeft: 6,
                    padding: "2px 6px",
                    background: theme.surf2,
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {typeof children === "function" ? children(activeTab) : children}
      </div>
    </div>
  );
}
