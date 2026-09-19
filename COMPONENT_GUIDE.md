# UI Component Guide

Complete reference for the Atomic Habits Tracker component library.

## 🎨 Design System

### Colors (Ocean Depth Theme)

```javascript
import { theme } from './constants/theme';
```

| Token | Value | Usage |
|-------|-------|-------|
| `theme.bg` | #F0F9FF | Page background |
| `theme.surface` | #FFFFFF | Card/modal background |
| `theme.surf2` | #E0F2FE | Secondary surface |
| `theme.border` | #D6E9F2 | Subtle borders |
| `theme.border2` | #7DD3FC | Active borders |
| `theme.text` | #26333B | Primary text |
| `theme.text2` | #4A6572 | Secondary text |
| `theme.muted` | #5F6E7A | Tertiary/meta text |
| `theme.accent` | #0EA5E9 | Accent color |
| `theme.primary` | #0284C7 | Primary actions |
| `theme.gold` | #F59E0B | Milestones/rewards |
| `theme.red` | #EF4444 | Errors/danger |

### Typography

**Font Family**: Nunito (preloaded in index.html)

**Font Weights**:
- 400: Regular
- 500: Medium
- 600: Semi-bold
- 700: Bold
- 800: Extra-bold

### Spacing Scale

Use multiples of 4px: 4, 8, 12, 16, 20, 24, 32, 40, 48, 60

### Border Radius

- Small elements: 8-10px
- Cards/inputs: 12-16px
- Modals: 20px

---

## 📦 UI Components

### Button

Versatile button component with multiple variants and sizes.

```jsx
import { Button } from './components/ui/Button';
import { Icon } from './components/ui/Icon';

// Primary button
<Button variant="primary" onClick={handleClick}>
  Save Changes
</Button>

// With icon
<Button variant="secondary" icon={<Icon name="plus" size={16} />}>
  Add New
</Button>

// Full width
<Button fullWidth variant="primary">
  Continue
</Button>

// Disabled state
<Button disabled>
  Can't Click
</Button>
```

**Props**:
- `variant`: "primary" | "secondary" | "danger" | "ghost"
- `size`: "sm" | "md" | "lg"
- `disabled`: boolean
- `fullWidth`: boolean
- `icon`: ReactNode
- `onClick`: function

---

### Card

Container component with optional hover effects.

```jsx
import { Card } from './components/ui/Card';

// Basic card
<Card>
  Content here
</Card>

// Hoverable card
<Card hoverable>
  Interactive content
</Card>

// Clickable card
<Card onClick={handleClick}>
  Click me
</Card>

// Custom padding
<Card padding={24}>
  More spacious content
</Card>
```

**Props**:
- `children`: ReactNode
- `padding`: number (default: 16)
- `hoverable`: boolean
- `onClick`: function
- `style`: CSSProperties

---

### Modal

Accessible modal dialog with keyboard navigation.

```jsx
import { Modal } from './components/ui/Modal';

<Modal
  title="Edit Habit"
  onClose={handleClose}
  maxWidth={600}
>
  <form>
    {/* Form content */}
  </form>
</Modal>
```

**Features**:
- Focus trap (Tab cycles through focusable elements)
- Escape key closes modal
- Returns focus to trigger element
- Backdrop blur effect
- Smooth animations

**Props**:
- `title`: string
- `onClose`: function
- `maxWidth`: number (default: 560)
- `descriptionId`: string (for aria-describedby)

---

### Input & Textarea

Form input components with error states.

```jsx
import { Input, Textarea } from './components/ui/Input';
import { Icon } from './components/ui/Icon';

// Text input with label
<Input
  label="Habit Name"
  value={habitName}
  onChange={e => setHabitName(e.target.value)}
  placeholder="e.g., Read for 10 minutes"
/>

// Input with icon
<Input
  icon={<Icon name="clock" />}
  placeholder="Time"
  value={time}
  onChange={e => setTime(e.target.value)}
/>

// Input with error
<Input
  label="Email"
  value={email}
  onChange={e => setEmail(e.target.value)}
  error={emailError}
/>

// Textarea
<Textarea
  label="Notes"
  value={notes}
  onChange={e => setNotes(e.target.value)}
  rows={6}
  placeholder="Write your thoughts..."
/>
```

**Input Props**:
- `value`: string
- `onChange`: function
- `placeholder`: string
- `type`: string (default: "text")
- `label`: string
- `error`: string
- `icon`: ReactNode
- `disabled`: boolean

**Textarea Props**:
- Same as Input, plus:
- `rows`: number (default: 4)

---

### Icon

SVG icon system with consistent sizing.

```jsx
import { Icon } from './components/ui/Icon';

<Icon name="check" size={18} color="#0EA5E9" />
<Icon name="x" size={16} />
<Icon name="plus" size={20} />
```

**Available Icons**:
- Actions: check, x, plus, edit, trash, menu
- Navigation: chevronDown, chevronRight, chevronLeft
- UI: star, calendar, clock, bell, settings, info
- Features: user, fire, target, bookmark, heart, lightning, trophy

**Props**:
- `name`: string (icon name)
- `size`: number (default: 13)
- `color`: string (default: "currentColor")
- `fill`: string (default: "none")

---

### Badge

Label component for status indicators and counts.

```jsx
import { Badge } from './components/ui/Badge';
import { Icon } from './components/ui/Icon';

// Default badge
<Badge>New</Badge>

// Colored variants
<Badge variant="primary">Active</Badge>
<Badge variant="success">Completed</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="danger">Failed</Badge>
<Badge variant="gold">🏆 Milestone</Badge>

// With icon
<Badge variant="success" icon={<Icon name="check" size={11} />}>
  Done
</Badge>

// Different sizes
<Badge size="sm">Small</Badge>
<Badge size="md">Medium</Badge>
<Badge size="lg">Large</Badge>
```

**Props**:
- `variant`: "default" | "primary" | "success" | "warning" | "danger" | "gold"
- `size`: "sm" | "md" | "lg"
- `icon`: ReactNode

---

### Alert

Notification component for messages and feedback.

```jsx
import { Alert } from './components/ui/Alert';

// Info alert
<Alert variant="info" title="Did you know?">
  Habits take 66 days on average to become automatic.
</Alert>

// Success alert
<Alert variant="success">
  Your habit was saved successfully!
</Alert>

// Warning with dismiss
<Alert variant="warning" title="Warning" onClose={handleDismiss}>
  You're about to delete this habit.
</Alert>

// Danger alert
<Alert variant="danger" title="Error">
  Failed to save. Please try again.
</Alert>
```

**Props**:
- `variant`: "info" | "success" | "warning" | "danger"
- `title`: string
- `children`: ReactNode
- `onClose`: function

---

### Loading Spinner

Loading indicator with optional overlay.

```jsx
import { LoadingSpinner, LoadingOverlay } from './components/ui/LoadingSpinner';

// Inline spinner
<LoadingSpinner size={32} />

// Custom color
<LoadingSpinner size={24} color="#0EA5E9" />

// Full-screen overlay
<LoadingOverlay message="Saving your changes..." />
```

**LoadingSpinner Props**:
- `size`: number (default: 24)
- `color`: string (default: theme.primary)

**LoadingOverlay Props**:
- `message`: string (default: "Loading...")

---

### Empty State

Placeholder for empty lists or data.

```jsx
import { EmptyState } from './components/ui/EmptyState';

<EmptyState
  icon="🎯"
  title="No habits yet"
  description="Start building better habits by adding your first one."
  actionLabel="Add Your First Habit"
  onAction={handleAddHabit}
/>

// Custom action
<EmptyState
  icon="📅"
  title="No data for this week"
  action={<Button onClick={handleChange}>Change Week</Button>}
/>
```

**Props**:
- `icon`: string | ReactNode
- `title`: string
- `description`: string
- `actionLabel`: string
- `onAction`: function
- `action`: ReactNode (custom action element)

---

### Tooltip

Hover hint component.

```jsx
import { Tooltip } from './components/ui/Tooltip';
import { Icon } from './components/ui/Icon';

<Tooltip content="Mark as complete">
  <button>
    <Icon name="check" />
  </button>
</Tooltip>

// Different placements
<Tooltip content="Click to edit" placement="right">
  <Icon name="edit" />
</Tooltip>
```

**Props**:
- `content`: string
- `placement`: "top" | "bottom" | "left" | "right"
- `delay`: number (ms, default: 400)

---

### Tabs

Tab navigation component.

```jsx
import { Tabs } from './components/ui/Tabs';

const tabs = [
  { id: 'habits', label: 'Habits', icon: '🎯', badge: 5 },
  { id: 'tasks', label: 'Tasks', icon: '📋' },
  { id: 'review', label: 'Review', icon: '📊' },
];

<Tabs
  tabs={tabs}
  defaultTab="habits"
  onChange={handleTabChange}
>
  {(activeTab) => (
    <div>
      {activeTab === 'habits' && <HabitsList />}
      {activeTab === 'tasks' && <TasksList />}
      {activeTab === 'review' && <WeeklyReview />}
    </div>
  )}
</Tabs>
```

**Props**:
- `tabs`: Array<{ id: string, label: string, icon?: string, badge?: number }>
- `defaultTab`: string
- `onChange`: function(tabId)

---

## 🎯 Feature Components

### MilestoneProgress

Displays streak milestones with progress indicator.

```jsx
import { MilestoneProgress } from './components/habits/MilestoneProgress';

<MilestoneProgress streak={18} />
```

**Props**:
- `streak`: number (current streak days)

**Features**:
- Shows earned milestone badge
- Progress bar to next milestone
- Hover/click reveals full milestone ladder
- Responsive tooltip positioning

---

## 🔧 Usage Patterns

### Form Layout

```jsx
<form onSubmit={handleSubmit}>
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <Input
      label="Habit Name"
      value={name}
      onChange={e => setName(e.target.value)}
      placeholder="e.g., Read for 10 minutes"
    />
    
    <Textarea
      label="Cue (When & Where)"
      value={cue}
      onChange={e => setCue(e.target.value)}
      rows={3}
    />
    
    <div style={{ display: 'flex', gap: 12 }}>
      <Button type="submit" variant="primary" fullWidth>
        Save
      </Button>
      <Button type="button" variant="ghost" onClick={onCancel} fullWidth>
        Cancel
      </Button>
    </div>
  </div>
</form>
```

### Card Grid

```jsx
<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: 16,
}}>
  {habits.map(habit => (
    <Card key={habit.id} hoverable onClick={() => handleView(habit)}>
      {/* Card content */}
    </Card>
  ))}
</div>
```

### Conditional Rendering with Empty State

```jsx
{habits.length === 0 ? (
  <EmptyState
    icon="🎯"
    title="No habits yet"
    actionLabel="Add Habit"
    onAction={handleAddHabit}
  />
) : (
  habits.map(habit => <HabitCard key={habit.id} habit={habit} />)
)}
```

---

## ♿ Accessibility

All components follow WCAG 2.1 AA guidelines:

- **Keyboard navigation**: All interactive elements are keyboard accessible
- **Focus indicators**: Clear visual focus states
- **ARIA attributes**: Proper roles, labels, and descriptions
- **Color contrast**: 4.5:1 minimum for text
- **Screen reader support**: Meaningful labels and announcements

### Keyboard Shortcuts

- **Modal**: `Escape` to close, `Tab` to navigate
- **Tabs**: Arrow keys to switch (when implemented)
- **Forms**: `Enter` to submit

---

## 🎨 Theming

To customize the theme, edit `src/constants/theme.js`:

```javascript
export const theme = {
  bg: "#F0F9FF",
  surface: "#FFFFFF",
  // ... other tokens
};
```

All components automatically use theme tokens, so changes propagate instantly.

---

## 📱 Responsive Design

Components adapt to screen size:
- Mobile-first approach
- Touch-friendly targets (minimum 44x44px)
- Flexible layouts with `gap` instead of margins
- `dvh` units for mobile viewports

---

## 🚀 Performance Tips

1. **Use memoization** for expensive renders:
   ```jsx
   const MemoizedCard = memo(HabitCard);
   ```

2. **Lazy load heavy components**:
   ```jsx
   const WeeklyReview = lazy(() => import('./components/review/WeeklyReview'));
   ```

3. **Virtualize long lists** (use react-window or similar)

4. **Debounce search inputs**:
   ```jsx
   const debouncedSearch = useMemo(
     () => debounce(handleSearch, 300),
     []
   );
   ```

---

**Need a component that doesn't exist?** Follow the existing patterns in `src/components/ui/` to create new reusable components!
