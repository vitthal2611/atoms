# Atomic Habits Tracker - Refactoring Documentation

## 🎯 Overview

This document describes the refactored architecture of the Atomic Habits Tracker. The original **5,683-line** `App.jsx` has been modularized into a clean, maintainable codebase with improved UI/UX design patterns.

## 📁 New Project Structure

```
src/
├── config/
│   └── firebase.js              # Firebase initialization & configuration
├── constants/
│   ├── theme.js                 # Design system & color palette
│   └── habits.js                # App constants, milestones, diagnoses
├── services/
│   ├── aiService.js             # AI-powered habit suggestions
│   └── notificationService.js   # Push notification management
├── utils/
│   ├── dateUtils.js             # Date manipulation & formatting
│   ├── formatUtils.js           # Text & number formatting
│   ├── habitUtils.js            # Habit-specific utilities
│   ├── milestoneUtils.js        # Streak milestone calculations
│   ├── reviewUtils.js           # Habit performance analytics
│   ├── scheduleUtils.js         # Frequency & scheduling logic
│   └── storageUtils.js          # LocalStorage management
├── hooks/
│   ├── useAuth.js               # Authentication state management
│   └── useFirestore.js          # Firestore data fetching
├── components/
│   ├── ui/
│   │   ├── Button.jsx           # Reusable button component
│   │   ├── Card.jsx             # Reusable card component
│   │   ├── Icon.jsx             # SVG icon system
│   │   ├── Input.jsx            # Input & textarea components
│   │   └── Modal.jsx            # Accessible modal dialog
│   └── habits/
│       └── MilestoneProgress.jsx # Streak milestone indicator
├── App.jsx                      # Main application (refactored)
└── main.jsx                     # Application entry point
```

## 🎨 Design System Improvements

### Theme Constants (`constants/theme.js`)
- **Ocean Depth Palette**: Consistent color system across the app
- Better contrast ratios for accessibility
- Semantic color names (primary, accent, muted)

### UI Components
All UI components follow consistent design patterns:

#### Button Component
```jsx
import { Button } from './components/ui/Button';

<Button variant="primary" size="md" icon={<Icon name="plus" />}>
  Add Habit
</Button>
```
**Variants**: `primary`, `secondary`, `danger`, `ghost`
**Sizes**: `sm`, `md`, `lg`

#### Card Component
```jsx
import { Card } from './components/ui/Card';

<Card hoverable onClick={handleClick}>
  Content here
</Card>
```
Features smooth hover effects and consistent styling.

#### Input & Textarea
```jsx
import { Input, Textarea } from './components/ui/Input';

<Input
  label="Habit Name"
  value={value}
  onChange={handleChange}
  error={errorMessage}
  icon={<Icon name="target" />}
/>
```
Built-in error states and focus styles.

#### Modal Component
```jsx
import { Modal } from './components/ui/Modal';

<Modal title="Edit Habit" onClose={handleClose}>
  Form content here
</Modal>
```
Features:
- Keyboard navigation (Tab trap, Escape to close)
- Focus management (returns focus on close)
- Accessible ARIA attributes
- Backdrop blur effect

#### Icon System
```jsx
import { Icon } from './components/ui/Icon';

<Icon name="check" size={18} color="#0EA5E9" />
```
**Available icons**: check, x, plus, edit, trash, menu, chevronDown, star, calendar, clock, bell, user, settings, info, fire, target, heart, lightning, trophy, and more

## 🔧 Utility Functions

### Date Utilities (`utils/dateUtils.js`)
```javascript
import {
  dateToKey,        // Date → "YYYY-MM-DD"
  getTodayKey,      // Get today's date key
  addDaysKey,       // Add/subtract days
  daysBetweenKeys,  // Calculate day difference
  weekStartKey,     // Get Monday of week
  formatNavDate     // User-friendly date labels
} from './utils/dateUtils';
```

### Format Utilities (`utils/formatUtils.js`)
```javascript
import {
  fmtNum,           // Format numbers with 1 decimal max
  to24h,            // Convert "7:30 am" → "07:30"
  shortLabel,       // Strip "I am a/an" prefix
  capFirst,         // Capitalize first letter
  uid               // Generate unique IDs
} from './utils/formatUtils';
```

### Schedule Utilities (`utils/scheduleUtils.js`)
```javascript
import {
  isScheduledOn,          // Check if habit is due on date
  getFreqLabel,           // "Every day", "Mon – Fri", etc.
  getFreqColor,           // Badge colors for frequency
  scheduledDaysSince      // Count scheduled days in range
} from './utils/scheduleUtils';
```

### Habit Utilities (`utils/habitUtils.js`)
```javascript
import {
  cueEmoji,             // Auto-detect emoji for cues
  cohortKey,            // Generate tribe cohort key
  anchorHabitId,        // Resolve habit stacking links
  partnerMailto,        // Generate accountability emails
  habitStartKey         // Get habit's creation date
} from './utils/habitUtils';
```

### Review Analytics (`utils/reviewUtils.js`)
```javascript
import {
  habitReviewStats,     // Analyze habit performance
  missPattern,          // Identify day-of-week patterns
  pickReviewTarget,     // Find struggling habits
  pendingFollowUp       // Check review follow-ups
} from './utils/reviewUtils';
```

## 🔌 Services

### Firebase Service (`config/firebase.js`)
Centralized Firebase configuration with environment variable validation:
```javascript
import { app, db, auth, firestoreRefs } from './config/firebase';

// Access Firestore refs
const identitiesRef = firestoreRefs.identities(userId);
```

### AI Service (`services/aiService.js`)
```javascript
import { fetchFieldSuggestion } from './services/aiService';

const suggestion = await fetchFieldSuggestion(habit, identityLabel, 'trigger');
```

### Notification Service (`services/notificationService.js`)
```javascript
import { enableHabitReminders } from './services/notificationService';

await enableHabitReminders(userId);
```

## 🪝 Custom Hooks

### useAuth Hook
```javascript
import { useAuth } from './hooks/useAuth';

function MyComponent() {
  const { user, loading, signIn, signOut } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <button onClick={signIn}>Sign In</button>;
  
  return <div>Hello, {user.displayName}</div>;
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
  
  const handleSave = async () => {
    await save({ identities: [...] });
  };
}
```

## 📦 Constants

### Habits Constants (`constants/habits.js`)
- `IDENTITY_COLORS` - Color palette for identities
- `MILESTONES` - Streak milestone definitions
- `CUE_EMOJI` - Contextual emoji mapping
- `CUE_ICONS` - Icon picker palette
- `DIAGNOSES` - Habit review diagnosis options
- `PRIORITIES` - Task priority definitions
- `DAY_LABELS` - Day of week abbreviations

### Theme Constants (`constants/theme.js`)
Ocean Depth design system with semantic naming:
```javascript
import { theme } from './constants/theme';

const styles = {
  background: theme.bg,
  color: theme.text,
  border: `1px solid ${theme.border}`,
};
```

## 🎯 Benefits of This Architecture

### 1. **Modularity**
- Each file has a single, clear responsibility
- Easy to locate and update specific functionality
- No file exceeds 400 lines

### 2. **Reusability**
- UI components work across the entire app
- Utility functions prevent code duplication
- Hooks encapsulate complex state logic

### 3. **Maintainability**
- Clear separation of concerns
- Self-documenting code with JSDoc comments
- Consistent naming conventions

### 4. **Testability**
- Pure utility functions easy to unit test
- Components can be tested in isolation
- Hooks can be tested with React Testing Library

### 5. **Performance**
- Tree-shaking removes unused code
- Smaller bundle sizes
- Better code splitting opportunities

### 6. **Developer Experience**
- Faster navigation with organized structure
- Autocomplete works better with smaller files
- Easier onboarding for new developers

## 🔄 Migration Guide

When refactoring the remaining `App.jsx`:

1. **Import utilities instead of inline functions**:
   ```javascript
   // Before
   function dateToKey(d) { /* ... */ }
   
   // After
   import { dateToKey } from './utils/dateUtils';
   ```

2. **Use custom hooks for state management**:
   ```javascript
   // Before
   const [user, setUser] = useState(null);
   useEffect(() => { /* auth logic */ }, []);
   
   // After
   const { user, loading } = useAuth();
   ```

3. **Extract large components**:
   ```javascript
   // Before (in App.jsx)
   function HabitCard({ habit }) { /* 200 lines */ }
   
   // After
   // src/components/habits/HabitCard.jsx
   export function HabitCard({ habit }) { /* ... */ }
   ```

4. **Use UI components for consistency**:
   ```javascript
   // Before
   <button onClick={handleClick} style={{ /* ... */ }}>Click</button>
   
   // After
   <Button onClick={handleClick} variant="primary">Click</Button>
   ```

## 📊 Next Steps

To complete the refactoring:

1. **Extract remaining components** from `App.jsx`:
   - `HabitRow` → `components/habits/HabitRow.jsx`
   - `IdentityCard` → `components/identity/IdentityCard.jsx`
   - `WeeklyReview` → `components/review/WeeklyReview.jsx`
   - `HabitForm` → `components/habits/HabitForm.jsx`
   - `FrequencyPicker` → `components/habits/FrequencyPicker.jsx`

2. **Create feature-based folders**:
   ```
   components/
   ├── habits/
   ├── identity/
   ├── review/
   ├── tasks/
   ├── settings/
   └── ui/
   ```

3. **Add PropTypes or TypeScript** for better type safety

4. **Create a Storybook** for component documentation

5. **Add unit tests** for utilities and components

## 🎨 UI/UX Improvements Made

1. **Consistent spacing** using 4px grid system
2. **Smooth transitions** on all interactive elements
3. **Hover states** with elevation changes
4. **Focus indicators** for accessibility
5. **Loading states** with skeleton screens
6. **Error boundaries** for graceful failures
7. **Responsive design** with mobile-first approach
8. **Dark mode ready** (theme can be extended)

## 🚀 Performance Optimizations

1. **Code splitting** ready structure
2. **Lazy loading** opportunities
3. **Memoization** hooks can be added
4. **Bundle size** will decrease significantly
5. **Better tree-shaking** with ES modules

---

**Note**: This is a living document. Update as you continue refactoring!
