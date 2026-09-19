# ⚛️ Atomic Habits Tracker

A beautiful, feature-rich habit tracker built on the principles from James Clear's "Atomic Habits". Track your identity-based habits, build streaks, and become 1% better every day.

## ✨ Features

- **Identity-First Design**: Build habits around who you want to become
- **4 Laws of Behavior Change**: Make it Obvious, Attractive, Easy, and Satisfying
- **Streak Tracking**: Visualize your progress with milestone badges (3-day, 7-day, 21-day, 66-day, 100-day)
- **Habit Stacking**: Link new habits to existing ones
- **Frequency Scheduling**: Daily, weekly, or custom schedules
- **Analytics & Reviews**: AI-powered habit analysis when you're struggling
- **Accountability Partner**: Share progress via email
- **Tribe Feature**: Anonymous cohorts to see how many people share your identity
- **Daily Tasks**: Focus mode with MIT (Most Important Tasks)
- **Weekly Reviews**: Reflect on your week and adjust habits
- **Push Notifications**: Reminder system for habit cues
- **Offline-First**: Works without internet, syncs when online

## 🚀 Quick Start

### Prerequisites

- Node.js 16+
- Firebase account (for backend)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd atoms

# Install dependencies
npm install

# Copy environment file
copy .env.example .env

# Add your Firebase credentials to .env
# See .env.example for required variables

# Start development server
npm run dev
```

### Firebase Setup

1. Create a project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication (Google Sign-In)
3. Create a Firestore database
4. Generate Web Push certificates (optional, for notifications)
5. Copy configuration values to `.env`

## 📁 Project Structure

```
src/
├── config/              # Firebase & app configuration
├── constants/           # Theme, habits constants
├── services/            # AI, notifications, etc.
├── utils/               # Helper functions
├── hooks/               # Custom React hooks
├── components/
│   ├── ui/              # Reusable UI components
│   └── habits/          # Feature-specific components
├── App.jsx              # Main application
└── main.jsx             # Entry point
```

## 📖 Documentation

- **[Refactoring Guide](./REFACTORING.md)** - Architecture overview and migration guide
- **[Component Guide](./COMPONENT_GUIDE.md)** - Complete UI component reference

## 🎨 Design System

Built with the "Ocean Depth" theme - a calming, professional color palette:

- **Background**: #F0F9FF (Sky Blue)
- **Primary**: #0284C7 (Ocean Blue)
- **Accent**: #0EA5E9 (Bright Blue)
- **Gold**: #F59E0B (Milestone rewards)

Typography: **Nunito** (Google Fonts)

## 🛠️ Tech Stack

- **React 18** - UI library
- **Vite** - Build tool & dev server
- **Firebase** - Backend (Auth, Firestore, Functions, Messaging)
- **Pure CSS** - No CSS frameworks, custom design system

## 📦 Available Scripts

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run preview   # Preview production build
```

## 🔧 Configuration

### Environment Variables

Required variables in `.env`:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=        # For push notifications
```

### Firebase Security Rules

See `firestore.rules` for database security configuration.

## 🧩 Component Library

### UI Components

- **Button** - Primary, secondary, danger, ghost variants
- **Card** - Container with hover effects
- **Modal** - Accessible dialog with keyboard navigation
- **Input/Textarea** - Form inputs with error states
- **Icon** - SVG icon system
- **Badge** - Labels and status indicators
- **Alert** - Notifications and messages
- **Loading** - Spinners and overlays
- **EmptyState** - Placeholder for empty data
- **Tabs** - Tab navigation
- **Tooltip** - Hover hints

### Feature Components

- **MilestoneProgress** - Streak badges and progress
- **HabitRow** - Individual habit display
- **WeeklyReview** - Analytics and insights
- **FrequencyPicker** - Schedule selector
- **HabitForm** - Add/edit habits

See [COMPONENT_GUIDE.md](./COMPONENT_GUIDE.md) for complete documentation.

## 🏗️ Architecture Highlights

### Modular Structure
The original 5,683-line `App.jsx` has been refactored into:
- **11 utility modules** - Pure functions for date, format, habit logic
- **9 UI components** - Reusable, accessible components
- **4 feature components** - Domain-specific components
- **2 custom hooks** - State management (auth, Firestore)
- **3 service modules** - Firebase, AI, notifications

### Benefits
- ✅ Each file < 400 lines
- ✅ Single responsibility per module
- ✅ Easy to test and maintain
- ✅ Better code splitting
- ✅ Smaller bundle size

## 🎯 Key Concepts

### Identity-Based Habits

Instead of "I want to run," you become "I am a runner." Habits are grouped by identity:

```javascript
{
  identity: "I am a reader",
  habits: [
    { label: "Read 10 pages", trigger: "After I have breakfast" }
  ]
}
```

### The 4 Laws

Each habit can be optimized using:

1. **Cue** (Make it Obvious) - When & where
2. **Craving** (Make it Attractive) - Bundle with something you enjoy
3. **Response** (Make it Easy) - 2-minute starter version
4. **Reward** (Make it Satisfying) - Immediate gratification

### Streak Milestones

Gamified progress tracking:
- ✨ 3-Day Spark
- ⚡ 1-Week Warrior
- 🔨 2-Week Forge
- 🧠 21-Day Habit
- 🏆 Month Master
- 🚀 Automatic (66 days)
- 💎 Century (100 days)

## 🤝 Contributing

Contributions welcome! Please read the refactoring guide first to understand the architecture.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🙏 Acknowledgments

- **James Clear** - "Atomic Habits" book and methodology
- **Firebase** - Backend infrastructure
- **React Team** - Amazing framework
- **Nunito Font** - Beautiful typography

## 📧 Support

For issues or questions:
- Open a GitHub issue
- Check the documentation files
- Review component examples

---

Built with ❤️ to help you become 1% better every day.

**Never miss twice. Every action you take is a vote for who you want to become.**
