# Import Guide - Quick Reference

A cheat sheet for importing from the refactored codebase.

## 🎨 UI Components

### Import Individual Components
```javascript
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { Modal } from './components/ui/Modal';
```

### Import Multiple Components (Recommended)
```javascript
import {
  Button,
  Card,
  Modal,
  Icon,
  Input,
  Textarea,
  Badge,
  Alert,
  LoadingSpinner,
  EmptyState,
  Tabs,
  Tooltip
} from './components/ui';
```

## 🎯 Feature Components

```javascript
import { MilestoneProgress } from './components/habits/MilestoneProgress';
```

## 🔧 Configuration

```javascript
import { app, db, auth, firestoreRefs, getMissingEnvVars } from './config/firebase';

// Usage
const identitiesRef = firestoreRefs.identities(userId);
const checkInsRef = firestoreRefs.checkIns(userId);
```

## 🎨 Theme & Constants

```javascript
import { theme } from './constants/theme';
import {
  IDENTITY_COLORS,
  MILESTONES,
  CUE_EMOJI,
  CUE_ICONS,
  DAY_LABELS,
  DEFAULT_FREQUENCY,
  DIAGNOSES,
  PRIORITIES
} from './constants/habits';

// Usage
const styles = {
  background: theme.bg,
  color: theme.text,
  border: `1px solid ${theme.border}`
};
```

## 🛠️ Utilities

### Date Utilities
```javascript
import {
  dateToKey,
  getTodayKey,
  addDaysKey,
  daysBetweenKeys,
  weekStartKey,
  weekDaysFrom,
  getWeekDates,
  formatNavDate
} from './utils/dateUtils';

// Usage
const today = getTodayKey();  // "2024-12-15"
const tomorrow = addDaysKey(today, 1);  // "2024-12-16"
const daysDiff = daysBetweenKeys(today, tomorrow);  // 1
```

### Format Utilities
```javascript
import {
  fmtNum,
  to24h,
  shortLabel,
  capFirst,
  uid,
  parseHour,
  getSlotId,
  habitSortMinutes,
  byHabitTime
} from './utils/formatUtils';

// Usage
fmtNum(3.14159);  // "3.1"
to24h("7:30 pm");  // "19:30"
shortLabel("I am a runner");  // "runner"
capFirst("hello");  // "Hello"
```

### Habit Utilities
```javascript
import {
  cueEmoji,
  cohortKey,
  anchorHabitId,
  partnerMailto,
  habitStartKey
} from './utils/habitUtils';

// Usage
const emoji = cueEmoji("brush teeth");  // "🪥"
const key = cohortKey("I am a reader");  // "reader"
```

### Schedule Utilities
```javascript
import {
  isScheduledOn,
  getFreqLabel,
  getFreqColor,
  scheduledDaysSince
} from './utils/scheduleUtils';

// Usage
const scheduled = isScheduledOn(habit.frequency, "2024-12-15");  // true/false
const label = getFreqLabel(habit.frequency);  // "Every day" or "Mon – Fri"
const colors = getFreqColor(habit.frequency);  // { bg: "#...", color: "#..." }
```

### Milestone Utilities
```javascript
import { getMilestone, getNextMilestone } from './utils/milestoneUtils';

// Usage
const earned = getMilestone(25);  // { days: 21, label: "21-Day Habit", emoji: "🧠" }
const next = getNextMilestone(25);  // { days: 30, label: "Month Master", emoji: "🏆" }
```

### Review Utilities
```javascript
import {
  habitReviewStats,
  missPattern,
  pickReviewTarget,
  reviewLog,
  failedFixCount,
  pendingFollowUp,
  diagnosisById
} from './utils/reviewUtils';

// Usage
const stats = habitReviewStats(habit, allData, todayKey);
// { days: [...], due: 14, kept: 8, rate: 0.57 }

const pattern = missPattern(stats);
// { kind: "schedule", days: [5,6], text: "Kept it on weekdays..." }
```

### Storage Utilities
```javascript
import {
  getDeviceId,
  loadDismissedCues,
  saveDismissedCues,
  loadCustomCues,
  saveCustomCues
} from './utils/storageUtils';

// Usage
const deviceId = getDeviceId();  // "abc-123-def-456"
const dismissed = loadDismissedCues();  // ["cue1", "cue2"]
saveDismissedCues(["cue1", "cue2", "cue3"]);
```

## 🔌 Services

### AI Service
```javascript
import { fetchFieldSuggestion } from './services/aiService';

// Usage
const suggestion = await fetchFieldSuggestion(habit, identityLabel, 'trigger');
// { value: "After I pour my morning coffee", note: "..." }
```

### Notification Service
```javascript
import { enableHabitReminders } from './services/notificationService';

// Usage
try {
  const token = await enableHabitReminders(userId);
  console.log('Notifications enabled:', token);
} catch (error) {
  console.error('Failed:', error.message);
}
```

## 🪝 Custom Hooks

### useAuth Hook
```javascript
import { useAuth } from './hooks/useAuth';

function MyComponent() {
  const { user, loading, error, signIn, signOut } = useAuth();
  
  if (loading) return <LoadingSpinner />;
  if (error) return <Alert variant="danger">{error.message}</Alert>;
  if (!user) return <Button onClick={signIn}>Sign In</Button>;
  
  return (
    <div>
      <p>Hello, {user.displayName}!</p>
      <Button onClick={signOut}>Sign Out</Button>
    </div>
  );
}
```

### useFirestoreDoc Hook
```javascript
import { useFirestoreDoc } from './hooks/useFirestore';
import { firestoreRefs } from './config/firebase';

function MyComponent({ userId }) {
  const { data, loading, error, save } = useFirestoreDoc(
    firestoreRefs.identities(userId),
    { realtime: true }
  );
  
  const handleUpdate = async () => {
    await save({ identities: [...data.identities, newIdentity] });
  };
  
  if (loading) return <LoadingSpinner />;
  if (error) return <Alert variant="danger">{error.message}</Alert>;
  
  return <div>{/* Render data */}</div>;
}
```

## 🎯 Complete Example Component

```javascript
import React, { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useFirestoreDoc } from './hooks/useFirestore';
import { firestoreRefs } from './config/firebase';
import {
  Button,
  Card,
  Modal,
  Input,
  LoadingSpinner,
  EmptyState,
  Icon
} from './components/ui';
import { MilestoneProgress } from './components/habits/MilestoneProgress';
import { theme } from './constants/theme';
import { getTodayKey } from './utils/dateUtils';
import { getMilestone } from './utils/milestoneUtils';

function HabitDashboard() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [habitName, setHabitName] = useState('');
  
  const { user, loading: authLoading } = useAuth();
  const { data, loading, save } = useFirestoreDoc(
    user ? firestoreRefs.identities(user.uid) : null,
    { realtime: true }
  );
  
  if (authLoading || loading) return <LoadingSpinner />;
  if (!user) return <div>Please sign in</div>;
  
  const habits = data?.identities?.[0]?.habits || [];
  const todayKey = getTodayKey();
  
  const handleAddHabit = async () => {
    const newHabit = {
      id: crypto.randomUUID(),
      label: habitName,
      createdAt: todayKey
    };
    
    await save({
      identities: [{
        ...data.identities[0],
        habits: [...habits, newHabit]
      }]
    });
    
    setShowAddModal(false);
    setHabitName('');
  };
  
  return (
    <div style={{ padding: 20, background: theme.bg, minHeight: '100vh' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 24 
        }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: theme.text }}>
            My Habits
          </h1>
          <Button 
            icon={<Icon name="plus" />}
            onClick={() => setShowAddModal(true)}
          >
            Add Habit
          </Button>
        </div>
        
        {habits.length === 0 ? (
          <EmptyState
            icon="🎯"
            title="No habits yet"
            description="Start building better habits by adding your first one."
            actionLabel="Add Your First Habit"
            onAction={() => setShowAddModal(true)}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {habits.map(habit => (
              <Card key={habit.id} hoverable>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center' 
                }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                    {habit.label}
                  </h3>
                  <MilestoneProgress streak={habit.streak || 0} />
                </div>
              </Card>
            ))}
          </div>
        )}
        
        {showAddModal && (
          <Modal title="Add Habit" onClose={() => setShowAddModal(false)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Input
                label="Habit Name"
                value={habitName}
                onChange={e => setHabitName(e.target.value)}
                placeholder="e.g., Read for 10 minutes"
              />
              
              <div style={{ display: 'flex', gap: 12 }}>
                <Button 
                  onClick={handleAddHabit} 
                  disabled={!habitName.trim()}
                  fullWidth
                >
                  Add Habit
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => setShowAddModal(false)}
                  fullWidth
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}

export default HabitDashboard;
```

## 💡 Pro Tips

### 1. Use Named Imports
```javascript
// ✅ Good - Clear what you're using
import { Button, Card } from './components/ui';

// ❌ Avoid - Imports everything
import * as UI from './components/ui';
```

### 2. Import from Index Files
```javascript
// ✅ Good - Clean, one line
import { Button, Card, Modal } from './components/ui';

// ❌ Avoid - Verbose, multiple lines
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { Modal } from './components/ui/Modal';
```

### 3. Destructure What You Need
```javascript
// ✅ Good - Only import what you use
import { theme } from './constants/theme';
const { primary, text } = theme;

// ❌ Avoid - Importing everything
import { IDENTITY_COLORS, MILESTONES, CUE_EMOJI, ... } from './constants/habits';
```

### 4. Use Absolute Imports (Optional)
```javascript
// Configure in vite.config.js
resolve: {
  alias: {
    '@': '/src',
    '@components': '/src/components',
    '@utils': '/src/utils',
  }
}

// Then import like this:
import { Button } from '@components/ui';
import { dateToKey } from '@utils/dateUtils';
```

## 🔍 Finding the Right Import

| What you need | Where to import from |
|--------------|---------------------|
| **UI element** | `./components/ui` |
| **Date logic** | `./utils/dateUtils` |
| **Text formatting** | `./utils/formatUtils` |
| **Habit calculations** | `./utils/habitUtils` |
| **Frequency/schedule** | `./utils/scheduleUtils` |
| **Milestones** | `./utils/milestoneUtils` |
| **Review analytics** | `./utils/reviewUtils` |
| **LocalStorage** | `./utils/storageUtils` |
| **Colors/theme** | `./constants/theme` |
| **App constants** | `./constants/habits` |
| **Firebase refs** | `./config/firebase` |
| **AI suggestions** | `./services/aiService` |
| **Notifications** | `./services/notificationService` |
| **Auth state** | `./hooks/useAuth` |
| **Firestore data** | `./hooks/useFirestore` |

---

**Remember**: The import path is relative to where your file is located. Adjust `./` to `../` or `../../` as needed!
