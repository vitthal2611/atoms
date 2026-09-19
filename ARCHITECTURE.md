# Architecture Overview

## 🏛️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
├─────────────────────────────────────────────────────────────┤
│  React Application (src/)                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Components Layer                                     │   │
│  │  • UI Components (Button, Modal, Card, etc.)         │   │
│  │  • Feature Components (HabitRow, MilestoneProgress)  │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Hooks Layer                                          │   │
│  │  • useAuth (Authentication state)                    │   │
│  │  • useFirestore (Real-time data sync)                │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Services Layer                                       │   │
│  │  • aiService (Gemini suggestions)                    │   │
│  │  • notificationService (Push notifications)          │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Utils Layer                                          │   │
│  │  • dateUtils, formatUtils, habitUtils, etc.          │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Config & Constants                                   │   │
│  │  • Firebase config                                    │   │
│  │  • Theme constants                                    │   │
│  │  • Habit constants                                    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    Firebase Services                         │
├─────────────────────────────────────────────────────────────┤
│  • Authentication (Google Sign-In)                           │
│  • Firestore (Real-time database)                           │
│  • Cloud Functions (AI suggestions)                          │
│  • Cloud Messaging (Push notifications)                      │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Data Flow

### Authentication Flow

```
User clicks "Sign In"
    ↓
useAuth hook → signIn()
    ↓
Firebase Auth → Google OAuth
    ↓
onAuthStateChanged listener
    ↓
Update user state
    ↓
Render authenticated UI
```

### Habit Data Flow

```
App renders
    ↓
useFirestoreDoc(identitiesRef(user.uid))
    ↓
Firestore listener (real-time)
    ↓
Update local state
    ↓
Render habits list
    ↓
User checks off habit
    ↓
setDoc(checkInsRef, { [habitId]: true })
    ↓
Firestore updates
    ↓
Listener triggers
    ↓
UI updates automatically
```

### AI Suggestion Flow

```
User struggles with habit (low completion rate)
    ↓
reviewUtils.pickReviewTarget()
    ↓
Show review dialog
    ↓
User selects diagnosis
    ↓
aiService.fetchFieldSuggestion()
    ↓
Cloud Function → Gemini API
    ↓
Return tailored suggestion
    ↓
User applies or edits
    ↓
Update habit in Firestore
```

## 🗂️ File Organization

### Separation of Concerns

```
config/          → Configuration (Firebase, env vars)
constants/       → Static data (theme, milestones, icons)
services/        → External integrations (Firebase, AI)
utils/           → Pure functions (calculations, formatting)
hooks/           → React state management
components/ui/   → Presentational components
components/*/    → Feature-specific components
```

### Dependency Graph

```
App.jsx
  ├─→ hooks/useAuth
  │     └─→ config/firebase
  ├─→ hooks/useFirestore
  │     └─→ config/firebase
  ├─→ components/ui/*
  │     └─→ constants/theme
  ├─→ components/habits/*
  │     ├─→ components/ui/*
  │     ├─→ utils/*
  │     └─→ constants/*
  └─→ utils/*
        └─→ constants/*
```

**Rules**:
- Config/constants have **no dependencies**
- Utils depend only on constants
- Services depend on config
- Hooks depend on services/config
- Components depend on everything below them

## 🔐 Security Architecture

### Firestore Rules

```
users/{userId}/atomicHabits/{document}
  - Read/Write: Only authenticated user
  - Validation: Data structure enforced

cohorts/{cohortId}/members/{memberId}
  - Write: Only the member themselves
  - Read: Aggregated counts only

pushTokens/{userId}/devices/{deviceId}
  - Write: Only the user themselves
  - Read: Cloud Functions only
```

### Client-Side Security

- Environment variables validated on startup
- No secrets in client code
- All sensitive operations server-side
- CORS properly configured

## 📱 State Management

### Local State

```javascript
// Component-level state for UI
const [open, setOpen] = useState(false);
```

### Firestore State (Source of Truth)

```javascript
// Real-time synced state
const { data, save } = useFirestoreDoc(docRef, { realtime: true });
```

### LocalStorage (Persistence)

```javascript
// Caching & offline support
storageUtils.loadCustomCues();
storageUtils.saveCustomCues(newCues);
```

## 🎯 Component Patterns

### Container/Presentation Pattern

**Container** (smart component):
```javascript
function HabitListContainer() {
  const { user } = useAuth();
  const { data, save } = useFirestoreDoc(identitiesRef(user.uid));
  
  const handleCheck = (habitId) => {
    // Business logic
  };
  
  return <HabitList habits={data.habits} onCheck={handleCheck} />;
}
```

**Presentation** (dumb component):
```javascript
function HabitList({ habits, onCheck }) {
  return habits.map(h => <HabitRow key={h.id} habit={h} onCheck={onCheck} />);
}
```

### Compound Components

```javascript
<Modal title="Edit Habit" onClose={handleClose}>
  <Input label="Name" value={name} onChange={setName} />
  <Textarea label="Cue" value={cue} onChange={setCue} />
  <Button onClick={handleSave}>Save</Button>
</Modal>
```

### Render Props

```javascript
<Tabs tabs={tabs} defaultTab="habits">
  {(activeTab) => (
    <div>
      {activeTab === 'habits' && <HabitsList />}
      {activeTab === 'tasks' && <TasksList />}
    </div>
  )}
</Tabs>
```

## 🚀 Performance Optimizations

### Code Splitting

```javascript
// Lazy load heavy components
const WeeklyReview = lazy(() => import('./components/review/WeeklyReview'));

<Suspense fallback={<LoadingSpinner />}>
  <WeeklyReview />
</Suspense>
```

### Memoization

```javascript
// Expensive calculations
const sortedHabits = useMemo(
  () => habits.sort(byHabitTime),
  [habits]
);

// Prevent unnecessary re-renders
const MemoizedHabitRow = memo(HabitRow);
```

### Debouncing

```javascript
// Search input
const debouncedSearch = useMemo(
  () => debounce(handleSearch, 300),
  []
);
```

## 🧪 Testing Strategy

### Unit Tests (Utils)

```javascript
// utils/dateUtils.test.js
describe('dateToKey', () => {
  it('formats date correctly', () => {
    expect(dateToKey(new Date('2024-01-15'))).toBe('2024-01-15');
  });
});
```

### Component Tests

```javascript
// components/ui/Button.test.jsx
render(<Button onClick={handleClick}>Click</Button>);
fireEvent.click(screen.getByText('Click'));
expect(handleClick).toHaveBeenCalled();
```

### Integration Tests

```javascript
// Test full user flow
render(<App />);
fireEvent.click(screen.getByText('Add Habit'));
fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Read' } });
fireEvent.click(screen.getByText('Save'));
await waitFor(() => expect(screen.getByText('Read')).toBeInTheDocument());
```

## 📦 Build & Deployment

### Development

```bash
npm run dev        # Vite dev server with HMR
```

### Production

```bash
npm run build      # Vite production build
npm run preview    # Test production build locally
```

### Firebase Hosting

```bash
firebase deploy --only hosting
```

### Bundle Analysis

```bash
npm run build -- --mode analyze
```

## 🔄 Data Migration

When refactoring, existing user data remains compatible:

1. **Backward compatibility**: Old data structures still work
2. **Graceful degradation**: Missing fields use defaults
3. **Progressive enhancement**: New fields added incrementally
4. **No breaking changes**: Users never lose data

Example:
```javascript
// Old habits didn't have `createdAt`
const startKey = habitStartKey(habit, allData);
// Falls back to inferring from check-in history
```

## 🎨 Theming System

### CSS Variables (Future Enhancement)

```css
:root {
  --color-bg: #F0F9FF;
  --color-primary: #0284C7;
  /* ... */
}

[data-theme="dark"] {
  --color-bg: #0C1821;
  --color-primary: #38BDF8;
}
```

### Theme Provider (Future Enhancement)

```javascript
const ThemeContext = createContext(theme);

function ThemeProvider({ children }) {
  const [currentTheme, setTheme] = useState('light');
  return (
    <ThemeContext.Provider value={{ theme: themes[currentTheme], setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

## 🔮 Future Enhancements

### TypeScript Migration

```typescript
interface Habit {
  id: string;
  label: string;
  trigger?: string;
  frequency: Frequency;
  createdAt: string;
}
```

### State Management Library

```javascript
// Redux Toolkit or Zustand for complex state
const useHabitStore = create((set) => ({
  habits: [],
  addHabit: (habit) => set((state) => ({ habits: [...state.habits, habit] })),
}));
```

### GraphQL API

```graphql
query GetHabits($userId: ID!) {
  user(id: $userId) {
    identities {
      id
      label
      habits {
        id
        label
        streak
      }
    }
  }
}
```

---

This architecture prioritizes **simplicity**, **maintainability**, and **scalability** while keeping the bundle size small and the developer experience smooth.
