# Visual Architecture Guide

## 🏗️ Layered Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           USER INTERFACE                         │
│  Components render visual elements and handle user interactions  │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                       │
│                      components/ui/                              │
│  • Button  • Card  • Modal  • Input  • Icon                     │
│  • Badge   • Alert • Tabs   • Tooltip                           │
│                                                                  │
│  Reusable, styled components with consistent design             │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                        FEATURE COMPONENTS                        │
│                      components/habits/                          │
│  • MilestoneProgress • HabitRow (to be extracted)               │
│  • HabitCard (TBD)   • WeeklyReview (TBD)                       │
│                                                                  │
│  Domain-specific components with business logic                  │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                         CUSTOM HOOKS LAYER                       │
│                          hooks/                                  │
│  • useAuth       → Manages authentication state                 │
│  • useFirestore  → Handles real-time data sync                  │
│                                                                  │
│  Encapsulates state logic and side effects                       │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                         SERVICES LAYER                           │
│                         services/                                │
│  • aiService            → AI-powered suggestions                │
│  • notificationService  → Push notifications                     │
│                                                                  │
│  External integrations and API calls                             │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                          UTILS LAYER                             │
│                           utils/                                 │
│  • dateUtils      → Date calculations                           │
│  • formatUtils    → Text/number formatting                      │
│  • habitUtils     → Habit-specific logic                        │
│  • scheduleUtils  → Frequency calculations                      │
│  • reviewUtils    → Performance analytics                       │
│                                                                  │
│  Pure functions with no side effects                             │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                    CONFIGURATION & CONSTANTS                     │
│                   config/ + constants/                           │
│  • firebase.js   → Firebase initialization                      │
│  • theme.js      → Design system colors                         │
│  • habits.js     → App constants                                │
│                                                                  │
│  Static configuration with no dependencies                       │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SERVICES                         │
│                                                                  │
│  🔥 Firebase Auth    🔥 Firestore    ☁️ Cloud Functions        │
│  📱 Cloud Messaging  🤖 Gemini AI                               │
└─────────────────────────────────────────────────────────────────┘
```

## 📊 Component Hierarchy

```
App.jsx
├── AuthCheck (useAuth hook)
│   ├── SignInScreen
│   │   └── Button → "Sign in with Google"
│   │
│   └── MainApp (authenticated)
│       ├── Header
│       │   ├── UserProfile
│       │   └── SettingsButton
│       │
│       ├── Tabs
│       │   ├── HabitsTab
│       │   │   ├── IdentityCard (for each identity)
│       │   │   │   ├── IdentityHeader
│       │   │   │   └── HabitRow (for each habit)
│       │   │   │       ├── HabitRing (check-off)
│       │   │   │       ├── MilestoneProgress
│       │   │   │       └── RowMenu
│       │   │   │
│       │   │   └── EmptyState (if no habits)
│       │   │
│       │   ├── TasksTab
│       │   │   ├── QuickAddTask
│       │   │   ├── TaskList
│       │   │   │   └── TaskItem (for each task)
│       │   │   └── FocusMode
│       │   │
│       │   └── ReviewTab
│       │       ├── WeeklyReview
│       │       ├── HabitCalendar
│       │       └── ReviewStats
│       │
│       └── Modals (conditional)
│           ├── HabitFormModal
│           ├── IdentityFormModal
│           ├── SettingsModal
│           └── ReviewModal
```

## 🔄 Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                         FIRESTORE                             │
│  /users/{userId}/atomicHabits/                               │
│    • identities    • checkIns    • dailyTasks                │
│    • habitNotes    • reviews     • settings                  │
└──────────────────────────────────────────────────────────────┘
                    ↕ Real-time Listener
┌──────────────────────────────────────────────────────────────┐
│                    useFirestoreDoc Hook                       │
│  const { data, loading, save } = useFirestoreDoc(ref)        │
└──────────────────────────────────────────────────────────────┘
                    ↕ State Updates
┌──────────────────────────────────────────────────────────────┐
│                    App Component State                        │
│  • identities   • checkIns   • dailyTasks                    │
└──────────────────────────────────────────────────────────────┘
                    ↕ Props
┌──────────────────────────────────────────────────────────────┐
│                    Child Components                           │
│  HabitRow receives: habit, checked, toggle                   │
└──────────────────────────────────────────────────────────────┘
                    ↕ User Interaction
┌──────────────────────────────────────────────────────────────┐
│                    User Action (e.g., check habit)           │
└──────────────────────────────────────────────────────────────┘
                    ↕ Event Handler
┌──────────────────────────────────────────────────────────────┐
│                    Update Firestore                           │
│  save({ [habitId]: true })                                   │
└──────────────────────────────────────────────────────────────┘
                    ↕ Listener Triggers
                    (Loop back to top)
```

## 🎯 Import Dependency Graph

```
                    App.jsx
                       ↓
        ┌──────────────┼──────────────┐
        ↓              ↓              ↓
    useAuth      useFirestore    Components
        ↓              ↓              ↓
    ┌───┴───┐      ┌──┴──┐       ┌───┴────┐
    ↓       ↓      ↓     ↓       ↓        ↓
  auth   config   db   utils    UI      habits
    ↓       ↓      ↓     ↓       ↓        ↓
    └───────┴──────┴─────┴───────┴────────┘
                    ↓
            ┌───────┴────────┐
            ↓                ↓
        constants        theme
```

### Dependency Rules

✅ **Allowed**:
- Components → Hooks
- Components → Utils
- Components → Constants
- Hooks → Services
- Hooks → Config
- Services → Config
- Utils → Constants

❌ **Forbidden**:
- Constants → Anything (must be leaf nodes)
- Config → Anything (must be leaf nodes)
- Utils → Components (creates circular deps)
- Hooks → Components (creates circular deps)

## 🎨 Component Composition Patterns

### Pattern 1: Render Props
```jsx
<Tabs tabs={tabData}>
  {(activeTab) => (
    <div>
      {activeTab === 'habits' && <HabitsList />}
      {activeTab === 'tasks' && <TasksList />}
    </div>
  )}
</Tabs>
```

### Pattern 2: Compound Components
```jsx
<Modal title="Edit" onClose={close}>
  <Input label="Name" value={name} onChange={setName} />
  <Button onClick={save}>Save</Button>
</Modal>
```

### Pattern 3: Container/Presentation
```jsx
// Container (logic)
function HabitListContainer() {
  const { data } = useFirestoreDoc(...);
  return <HabitList habits={data.habits} />;
}

// Presentation (UI)
function HabitList({ habits }) {
  return habits.map(h => <HabitRow key={h.id} habit={h} />);
}
```

## 🔐 Security Flow

```
User Action
    ↓
Client-side Validation
    ↓
Firebase Auth Check
    ↓
Firestore Security Rules
    ↓
┌─────────────────────────────┐
│ Rules Check:                │
│ • Is user authenticated?    │
│ • Does userId match?        │
│ • Is data structure valid?  │
└─────────────────────────────┘
    ↓
Action Allowed/Denied
    ↓
Response to Client
```

## 📱 State Management Flow

### Local UI State
```
useState → Component State → UI Update
```

### Firestore State (Source of Truth)
```
Firestore → Listener → useFirestoreDoc → Component State → UI Update
```

### LocalStorage Cache
```
User Action → LocalStorage → Persist → Page Reload → Restore
```

## 🎯 Event Flow Example: Checking Off a Habit

```
1. User clicks HabitRing
        ↓
2. onClick handler in HabitRow
        ↓
3. toggle(habitId) function
        ↓
4. save({ [todayKey]: { [habitId]: true } })
        ↓
5. Firestore setDoc()
        ↓
6. Firestore listener triggers
        ↓
7. useFirestoreDoc updates data state
        ↓
8. React re-renders with new data
        ↓
9. HabitRing shows checked state
        ↓
10. Streak count updates
        ↓
11. MilestoneProgress updates (if milestone reached)
```

## 🚀 Performance Optimization Points

```
┌─────────────────────────────────────────────┐
│  Level 1: Code Splitting                    │
│  • Lazy load heavy components               │
│  • Dynamic imports for routes               │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Level 2: Memoization                       │
│  • useMemo for expensive calculations       │
│  • memo() for pure components               │
│  • useCallback for stable functions         │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Level 3: Firestore Optimization            │
│  • Batch writes                             │
│  • Indexed queries                          │
│  • Pagination                               │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Level 4: Bundle Optimization               │
│  • Tree shaking                             │
│  • Minification                             │
│  • Gzip compression                         │
└─────────────────────────────────────────────┘
```

## 📦 Build Process Flow

```
Source Files (src/)
        ↓
    Vite Build
        ↓
┌───────┴────────┐
↓                ↓
Transpile     Bundle
(JSX → JS)    (Modules)
↓                ↓
└───────┬────────┘
        ↓
    Optimize
    • Minify
    • Tree shake
    • Code split
        ↓
   dist/ folder
        ↓
Firebase Hosting
        ↓
    CDN Edge
        ↓
   User Browser
```

## 🧪 Testing Pyramid

```
                 /\
                /  \
               /E2E \          ← Few, slow, high confidence
              /______\
             /        \
            /Integration\      ← Some, medium speed
           /____________\
          /              \
         /  Unit Tests    \    ← Many, fast, focused
        /__________________\
```

## 🎯 Feature Development Flow

```
1. Plan Feature
        ↓
2. Design Component API
        ↓
3. Create Utils (if needed)
        ↓
4. Create UI Components
        ↓
5. Create Feature Component
        ↓
6. Integrate with App
        ↓
7. Test Manually
        ↓
8. Write Unit Tests
        ↓
9. Update Documentation
        ↓
10. Deploy
```

---

This visual guide helps understand:
- How components connect
- Where to place new code
- How data flows through the app
- Where dependencies should go
- How to maintain clean architecture
