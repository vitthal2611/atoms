# Migration Checklist

Use this checklist to track progress when refactoring the remaining components from the original `App.jsx`.

## Phase 1: Utility Functions ✅ COMPLETED

- [x] Extract date utilities → `utils/dateUtils.js`
- [x] Extract format utilities → `utils/formatUtils.js`
- [x] Extract habit utilities → `utils/habitUtils.js`
- [x] Extract schedule utilities → `utils/scheduleUtils.js`
- [x] Extract milestone utilities → `utils/milestoneUtils.js`
- [x] Extract review utilities → `utils/reviewUtils.js`
- [x] Extract storage utilities → `utils/storageUtils.js`

## Phase 2: Configuration & Constants ✅ COMPLETED

- [x] Extract Firebase config → `config/firebase.js`
- [x] Extract theme constants → `constants/theme.js`
- [x] Extract habit constants → `constants/habits.js`

## Phase 3: Services ✅ COMPLETED

- [x] Extract AI service → `services/aiService.js`
- [x] Extract notification service → `services/notificationService.js`

## Phase 4: Custom Hooks ✅ COMPLETED

- [x] Create useAuth hook → `hooks/useAuth.js`
- [x] Create useFirestore hook → `hooks/useFirestore.js`

## Phase 5: UI Components ✅ COMPLETED

- [x] Button component → `components/ui/Button.jsx`
- [x] Card component → `components/ui/Card.jsx`
- [x] Modal component → `components/ui/Modal.jsx`
- [x] Icon component → `components/ui/Icon.jsx`
- [x] Input/Textarea components → `components/ui/Input.jsx`
- [x] Badge component → `components/ui/Badge.jsx`
- [x] Alert component → `components/ui/Alert.jsx`
- [x] Loading components → `components/ui/LoadingSpinner.jsx`
- [x] Empty state component → `components/ui/EmptyState.jsx`
- [x] Tabs component → `components/ui/Tabs.jsx`
- [x] Tooltip component → `components/ui/Tooltip.jsx`
- [x] UI index file → `components/ui/index.js`

## Phase 6: Feature Components (IN PROGRESS)

### Habits Components
- [x] MilestoneProgress → `components/habits/MilestoneProgress.jsx`
- [ ] HabitRow → `components/habits/HabitRow.jsx`
- [ ] HabitCard → `components/habits/HabitCard.jsx`
- [ ] HabitForm → `components/habits/HabitForm.jsx`
- [ ] HabitRing → `components/habits/HabitRing.jsx`
- [ ] HabitCalendar → `components/habits/HabitCalendar.jsx`
- [ ] FrequencyPicker → `components/habits/FrequencyPicker.jsx`
- [ ] RowMenu → `components/habits/RowMenu.jsx`
- [ ] VotesBadge → `components/habits/VotesBadge.jsx`
- [ ] StreakBadge → `components/habits/StreakBadge.jsx`
- [ ] NotesJournalModal → `components/habits/NotesJournalModal.jsx`
- [ ] LawChip → `components/habits/LawChip.jsx`

### Identity Components
- [ ] IdentityCard → `components/identity/IdentityCard.jsx`
- [ ] IdentityForm → `components/identity/IdentityForm.jsx`
- [ ] IdentityName → `components/identity/IdentityName.jsx`

### Review Components
- [ ] WeeklyReview → `components/review/WeeklyReview.jsx`
- [ ] ReviewWeekStrip → `components/review/ReviewWeekStrip.jsx`
- [ ] MonthReport → `components/review/MonthReport.jsx`
- [ ] HabitReviewModal → `components/review/HabitReviewModal.jsx`

### Task Components
- [ ] TaskList → `components/tasks/TaskList.jsx`
- [ ] TaskItem → `components/tasks/TaskItem.jsx`
- [ ] QuickAddTask → `components/tasks/QuickAddTask.jsx`
- [ ] SimpleFocus → `components/tasks/SimpleFocus.jsx`
- [ ] FocusMode → `components/tasks/FocusMode.jsx`
- [ ] FocusSlotAdd → `components/tasks/FocusSlotAdd.jsx`
- [ ] SwipeRow → `components/tasks/SwipeRow.jsx`

### Navigation Components
- [ ] DayNavigator → `components/navigation/DayNavigator.jsx`
- [ ] DayCalendarModal → `components/navigation/DayCalendarModal.jsx`

### Settings Components
- [ ] ScorecardSettings → `components/settings/ScorecardSettings.jsx`
- [ ] CueSettings → `components/settings/CueSettings.jsx`
- [ ] TribeSettings → `components/settings/TribeSettings.jsx`

### Shared Components
- [ ] Confirm → `components/shared/Confirm.jsx`
- [ ] CounterRing → `components/shared/CounterRing.jsx`

## Phase 7: Main App Refactoring (PENDING)

- [ ] Simplify main App component
- [ ] Extract authentication logic
- [ ] Extract routing logic (if added)
- [ ] Extract global state management
- [ ] Clean up inline styles
- [ ] Add PropTypes or TypeScript

## Phase 8: Testing (PENDING)

### Unit Tests
- [ ] Test date utilities
- [ ] Test format utilities
- [ ] Test habit utilities
- [ ] Test schedule utilities
- [ ] Test review utilities

### Component Tests
- [ ] Test Button component
- [ ] Test Modal component
- [ ] Test Input component
- [ ] Test Card component
- [ ] Test MilestoneProgress component

### Integration Tests
- [ ] Test authentication flow
- [ ] Test habit creation flow
- [ ] Test habit check-in flow
- [ ] Test weekly review flow

## Phase 9: Documentation (✅ PARTIALLY COMPLETED)

- [x] README.md - Project overview
- [x] REFACTORING.md - Architecture guide
- [x] COMPONENT_GUIDE.md - Component documentation
- [x] ARCHITECTURE.md - Deep dive
- [x] IMPORT_GUIDE.md - Import reference
- [x] VISUAL_ARCHITECTURE.md - Diagrams
- [x] REFACTORING_SUMMARY.md - Summary
- [ ] API.md - API documentation
- [ ] TESTING.md - Testing guide
- [ ] CONTRIBUTING.md - Contribution guide

## Phase 10: Optimization (PENDING)

- [ ] Add lazy loading for routes
- [ ] Implement code splitting
- [ ] Add React.memo() where appropriate
- [ ] Add useMemo() for expensive calculations
- [ ] Add useCallback() for stable functions
- [ ] Optimize bundle size
- [ ] Add service worker for PWA
- [ ] Implement offline support

## Phase 11: Developer Experience (PARTIAL)

- [x] Add ESLint configuration
- [x] Add Prettier configuration
- [x] Add global CSS
- [ ] Add pre-commit hooks (Husky)
- [ ] Add commit linting (Commitlint)
- [ ] Set up Storybook
- [ ] Add VSCode settings
- [ ] Add debugging configuration

## Phase 12: Production Ready (PENDING)

- [ ] Add error boundaries
- [ ] Add error tracking (Sentry)
- [ ] Add analytics
- [ ] Add performance monitoring
- [ ] Security audit
- [ ] Accessibility audit
- [ ] Browser compatibility testing
- [ ] Mobile responsiveness testing
- [ ] Load testing
- [ ] SEO optimization

---

## Progress Summary

- **Phase 1-5**: ✅ COMPLETED (100%)
- **Phase 6**: 🔄 IN PROGRESS (8%)
- **Phase 7-12**: ⏳ PENDING (0%)

**Overall Progress**: ~45% complete

---

## Next Actions (Priority Order)

1. **Extract HabitRow component** (most used component)
2. **Extract HabitForm component** (critical functionality)
3. **Extract IdentityCard component** (visual organization)
4. **Extract WeeklyReview component** (major feature)
5. **Extract Task components** (separate feature set)
6. **Add unit tests** for utils
7. **Add component tests** for UI components
8. **Optimize and polish** the refactored code

---

## Tips for Extraction

### When Extracting a Component:

1. **Identify dependencies**: What does it import?
2. **Extract props**: What data does it need?
3. **Move to appropriate folder**: habits/, identity/, tasks/, etc.
4. **Update imports**: Use the new modular structure
5. **Add JSDoc comments**: Document props and behavior
6. **Test in isolation**: Ensure it works standalone
7. **Update App.jsx**: Import from new location

### Component Template:

```javascript
import { useState } from "react";
import { Button, Card } from "../ui";
import { theme } from "../../constants/theme";

/**
 * ComponentName - Brief description
 * 
 * @param {Object} props
 * @param {string} props.propName - Description
 */
export function ComponentName({ propName }) {
  return (
    <Card>
      {/* Component JSX */}
    </Card>
  );
}
```

---

## Notes

- Keep components under 300 lines
- One component per file
- Export as named export (not default)
- Use constants for colors (never hardcode)
- Follow the established import order:
  1. React imports
  2. Custom hooks
  3. UI components
  4. Feature components
  5. Constants & theme
  6. Utils
  7. Services

---

**Last Updated**: [Current Date]
**Maintained By**: Development Team
