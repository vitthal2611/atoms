/**
 * Example App.jsx using the refactored modular structure
 * This demonstrates how to import and use the new components and utilities
 */

import { useState, useEffect } from "react";

// Custom Hooks
import { useAuth } from "./hooks/useAuth";
import { useFirestoreDoc } from "./hooks/useFirestore";

// Configuration
import { firestoreRefs, getMissingEnvVars } from "./config/firebase";

// UI Components
import {
  Button,
  Card,
  Modal,
  Input,
  Textarea,
  LoadingSpinner,
  LoadingOverlay,
  EmptyState,
  Alert,
  Badge,
  Icon,
} from "./components/ui";

// Feature Components
import { MilestoneProgress } from "./components/habits/MilestoneProgress";

// Theme and Constants
import { theme } from "./constants/theme";
import { IDENTITY_COLORS, ICONS } from "./constants/habits";

// Utilities
import { getTodayKey } from "./utils/dateUtils";
import { uid } from "./utils/formatUtils";
import { cueEmoji } from "./utils/habitUtils";

// Main App Component
function App() {
  // Check for missing environment variables
  const envMissing = getMissingEnvVars();
  if (envMissing.length > 0) {
    return <EnvErrorScreen missing={envMissing} />;
  }

  return <AppContent />;
}

// Environment Error Screen
function EnvErrorScreen({ missing }) {
  return (
    <div style={styles.fullScreen}>
      <Alert variant="danger" title="Configuration Error">
        Missing environment variables: {missing.join(", ")}
        <br />
        <br />
        Copy .env.example to .env and fill in your Firebase credentials.
      </Alert>
    </div>
  );
}

// Main App Content (after env check)
function AppContent() {
  const { user, loading: authLoading, signIn, signOut } = useAuth();

  if (authLoading) {
    return <LoadingOverlay message="Loading..." />;
  }

  if (!user) {
    return <SignInScreen onSignIn={signIn} />;
  }

  return <AuthenticatedApp user={user} onSignOut={signOut} />;
}

// Sign In Screen
function SignInScreen({ onSignIn }) {
  return (
    <div style={styles.fullScreen}>
      <Card padding={40} style={{ maxWidth: 400, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>⚛️</div>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Atomic Habits</h1>
        <p style={{ color: theme.muted, marginBottom: 32 }}>
          Track your habits and become 1% better every day
        </p>
        <Button onClick={onSignIn} fullWidth icon={<Icon name="user" />}>
          Sign in with Google
        </Button>
      </Card>
    </div>
  );
}

// Authenticated App
function AuthenticatedApp({ user, onSignOut }) {
  const [activeView, setActiveView] = useState("habits");
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Fetch user data with real-time updates
  const { data: identitiesData, loading, save: saveIdentities } = useFirestoreDoc(
    firestoreRefs.identities(user.uid),
    { realtime: true }
  );

  const { data: checkInsData, save: saveCheckIns } = useFirestoreDoc(
    firestoreRefs.checkIns(user.uid),
    { realtime: true }
  );

  const identities = identitiesData?.identities || [];
  const todayKey = getTodayKey();
  const todayCheckIns = checkInsData?.[todayKey] || {};

  // Handle adding a new habit
  const handleAddHabit = async (habitData) => {
    const newIdentities = [...identities];
    if (newIdentities.length === 0) {
      // Create default identity if none exists
      newIdentities.push({
        id: uid(),
        label: "I am healthy",
        color: IDENTITY_COLORS[0],
        icon: ICONS[0],
        habits: [],
      });
    }
    
    newIdentities[0].habits.push({
      ...habitData,
      id: uid(),
      createdAt: todayKey,
    });

    await saveIdentities({ identities: newIdentities });
    setShowAddHabit(false);
  };

  // Toggle habit check-in
  const handleToggleHabit = async (habitId) => {
    const newCheckIns = { ...todayCheckIns };
    newCheckIns[habitId] = !newCheckIns[habitId];

    await saveCheckIns({ [todayKey]: newCheckIns });
  };

  if (loading) {
    return <LoadingOverlay message="Loading your habits..." />;
  }

  return (
    <div style={styles.app}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.logo}>⚛️ Atomic Habits</h1>
          <div style={styles.headerActions}>
            <Button
              variant="ghost"
              size="sm"
              icon={<Icon name="settings" />}
              onClick={() => setShowSettings(true)}
            >
              Settings
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={styles.main}>
        <div style={styles.container}>
          {/* Action Bar */}
          <div style={styles.actionBar}>
            <h2 style={styles.viewTitle}>
              {activeView === "habits" ? "My Habits" : "Daily Tasks"}
            </h2>
            <Button icon={<Icon name="plus" />} onClick={() => setShowAddHabit(true)}>
              Add Habit
            </Button>
          </div>

          {/* Habits List */}
          {identities.length === 0 || identities.every(i => !i.habits?.length) ? (
            <EmptyState
              icon="🎯"
              title="No habits yet"
              description="Start building better habits by adding your first one."
              actionLabel="Add Your First Habit"
              onAction={() => setShowAddHabit(true)}
            />
          ) : (
            <div style={styles.habitsList}>
              {identities.map((identity) =>
                identity.habits?.map((habit) => (
                  <HabitCard
                    key={habit.id}
                    habit={habit}
                    identity={identity}
                    checked={todayCheckIns[habit.id] || false}
                    onToggle={() => handleToggleHabit(habit.id)}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </main>

      {/* Add Habit Modal */}
      {showAddHabit && (
        <AddHabitModal
          onSave={handleAddHabit}
          onClose={() => setShowAddHabit(false)}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          user={user}
          onSignOut={onSignOut}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

// Habit Card Component
function HabitCard({ habit, identity, checked, onToggle }) {
  const emoji = cueEmoji(habit.label) || habit.icon || "⚡";
  const streak = habit.streak || 0;

  return (
    <Card hoverable style={styles.habitCard}>
      <div style={styles.habitCardContent}>
        {/* Check Button */}
        <button
          onClick={onToggle}
          style={{
            ...styles.checkButton,
            background: checked ? theme.primary : theme.surface,
            border: `2px solid ${checked ? theme.primary : theme.border}`,
          }}
          aria-label={checked ? "Mark as incomplete" : "Mark as complete"}
        >
          {checked && <Icon name="check" size={18} color="#fff" />}
        </button>

        {/* Habit Info */}
        <div style={styles.habitInfo}>
          <div style={styles.habitHeader}>
            <span style={{ fontSize: 18, marginRight: 8 }}>{emoji}</span>
            <h3 style={styles.habitLabel}>{habit.label}</h3>
            <Badge variant="primary" size="sm" style={{ marginLeft: 8 }}>
              {identity.label.replace(/^I am (a |an )?/i, "")}
            </Badge>
          </div>

          {habit.trigger && (
            <p style={styles.habitTrigger}>{habit.trigger}</p>
          )}
        </div>

        {/* Milestone Progress */}
        <MilestoneProgress streak={streak} />
      </div>
    </Card>
  );
}

// Add Habit Modal
function AddHabitModal({ onSave, onClose }) {
  const [label, setLabel] = useState("");
  const [trigger, setTrigger] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (label.trim()) {
      onSave({ label: label.trim(), trigger: trigger.trim() });
    }
  };

  return (
    <Modal title="Add New Habit" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input
            label="Habit Name"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g., Read for 10 minutes"
            autoFocus
          />

          <Textarea
            label="Cue (When & Where)"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            placeholder="After I pour my morning coffee..."
            rows={3}
          />

          <Alert variant="info">
            💡 Make it specific: "After I [CURRENT HABIT], I will [NEW HABIT]"
          </Alert>

          <div style={{ display: "flex", gap: 12 }}>
            <Button type="submit" fullWidth disabled={!label.trim()}>
              Add Habit
            </Button>
            <Button type="button" variant="ghost" onClick={onClose} fullWidth>
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// Settings Modal
function SettingsModal({ user, onSignOut, onClose }) {
  return (
    <Modal title="Settings" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* User Info */}
        <Card padding={16}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img
              src={user.photoURL}
              alt={user.displayName}
              style={{ width: 48, height: 48, borderRadius: "50%" }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{user.displayName}</div>
              <div style={{ color: theme.muted, fontSize: 13 }}>{user.email}</div>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <Button variant="danger" onClick={onSignOut} fullWidth>
          Sign Out
        </Button>
      </div>
    </Modal>
  );
}

// Styles
const styles = {
  app: {
    minHeight: "100vh",
    background: theme.bg,
  },
  fullScreen: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  header: {
    background: theme.surface,
    borderBottom: `1px solid ${theme.border}`,
    padding: "16px 0",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  headerContent: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "0 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    fontSize: 20,
    fontWeight: 800,
    color: theme.text,
    margin: 0,
  },
  headerActions: {
    display: "flex",
    gap: 12,
  },
  main: {
    padding: "32px 0",
  },
  container: {
    maxWidth: 800,
    margin: "0 auto",
    padding: "0 20px",
  },
  actionBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  viewTitle: {
    fontSize: 24,
    fontWeight: 800,
    color: theme.text,
    margin: 0,
  },
  habitsList: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  habitCard: {
    padding: 20,
  },
  habitCardContent: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  checkButton: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all 0.2s",
    flexShrink: 0,
  },
  habitInfo: {
    flex: 1,
    minWidth: 0,
  },
  habitHeader: {
    display: "flex",
    alignItems: "center",
    marginBottom: 4,
  },
  habitLabel: {
    fontSize: 16,
    fontWeight: 700,
    color: theme.text,
    margin: 0,
  },
  habitTrigger: {
    fontSize: 13,
    color: theme.muted,
    margin: 0,
  },
};

export default App;
