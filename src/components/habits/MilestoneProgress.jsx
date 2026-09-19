import { useState, useRef } from "react";
import { Icon } from "../ui/Icon.jsx";
import { getMilestone, getNextMilestone } from "../../utils/milestoneUtils.js";
import { MILESTONES } from "../../constants/habits.js";
import { theme } from "../../constants/theme.js";

/**
 * Milestone progress indicator with earned badge and progress to next milestone
 */
export function MilestoneProgress({ streak = 0 }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  
  const earned = getMilestone(streak);
  const next = getNextMilestone(streak);
  
  if (!earned && !next) return null;
  
  const gold = "#B07B1E";
  const prevDays = earned ? earned.days : 0;
  const span = next ? next.days - prevDays : 1;
  const frac = next ? Math.max(0, Math.min(1, (streak - prevDays) / span)) : 1;
  const remain = next ? next.days - streak : 0;
  const W = 210;

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) {
      setPos({
        top: r.bottom + 6,
        left: Math.min(Math.max(8, r.right - W), window.innerWidth - W - 8)
      });
    }
    setOpen(true);
  };
  
  const hide = () => setOpen(false);

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        marginLeft: "auto",
        flexShrink: 0,
        minWidth: 92,
        maxWidth: 150,
        textAlign: "right",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onClick={(e) => {
        e.stopPropagation();
        open ? hide() : show();
      }}
      aria-label={
        earned
          ? `Milestone reached: ${earned.label}${next ? `, ${remain} days to ${next.label}` : ""}. Tap for the full ladder.`
          : `${remain} days to your first milestone, ${next.label}. Tap for the full ladder.`
      }
    >
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 4,
        fontSize: 11,
        fontWeight: 800,
        color: earned ? gold : theme.muted,
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}>
        {earned ? (
          <>
            <span aria-hidden="true">{earned.emoji}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {earned.label}
            </span>
          </>
        ) : (
          <span>Next reward</span>
        )}
      </div>
      
      {next && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 6,
          marginTop: 4,
        }}>
          <div style={{
            flex: 1,
            maxWidth: 60,
            height: 5,
            borderRadius: 5,
            background: "#EBE0C6",
            overflow: "hidden",
          }}>
            <div style={{
              width: `${Math.round(frac * 100)}%`,
              height: "100%",
              background: theme.gold,
              borderRadius: 5,
            }} />
          </div>
          <span style={{
            fontSize: 10.5,
            fontWeight: 800,
            color: gold,
            whiteSpace: "nowrap",
          }}>
            {remain}d → <span aria-hidden="true">{next.emoji}</span>
          </span>
        </div>
      )}

      {open && pos && (
        <div
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            zIndex: 200,
            width: W,
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: 12,
            boxShadow: "0 10px 28px rgba(9,45,75,0.2)",
            padding: "11px 13px",
            textAlign: "left",
          }}
        >
          <div style={{
            fontSize: 12,
            fontWeight: 900,
            color: theme.text,
            marginBottom: 2,
          }}>
            {earned ? `${earned.emoji} ${earned.label}` : "No milestone yet"}
          </div>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: theme.muted,
            marginBottom: 9,
          }}>
            {streak}-day streak
            {next ? ` · ${remain} to go for ${next.emoji} ${next.label}` : " · top badge earned 🎉"}
          </div>
          
          {MILESTONES.map((m) => {
            const done = streak >= m.days;
            const isNext = next && m.days === next.days;
            return (
              <div
                key={m.days}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "3px 0",
                  opacity: done || isNext ? 1 : 0.5,
                }}
              >
                <span aria-hidden="true" style={{
                  width: 18,
                  textAlign: "center",
                  fontSize: 13,
                }}>
                  {m.emoji}
                </span>
                <span style={{
                  flex: 1,
                  fontSize: 11.5,
                  fontWeight: isNext ? 900 : 700,
                  color: done ? gold : isNext ? theme.text : theme.muted,
                }}>
                  {m.label}
                </span>
                <span style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  color: theme.muted,
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {m.days}d
                </span>
                {done && <Icon name="check" size={12} color="#0F9D74" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
