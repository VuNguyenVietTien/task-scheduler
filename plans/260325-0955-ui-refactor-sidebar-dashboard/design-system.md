# Design System - Task Scheduler

## Color Palette (SaaS General - Trust Blue)

### Core Colors
| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| **Primary** | `#2563EB` | `blue-600` | Active states, links, primary buttons |
| **Primary Light** | `#3B82F6` | `blue-500` | Hover states, secondary emphasis |
| **Primary Dark** | `#1D4ED8` | `blue-700` | Pressed states, sidebar bg |
| **Secondary** | `#64748B` | `slate-500` | Secondary text, icons |
| **CTA/Accent** | `#F97316` | `orange-500` | Warnings, urgent indicators |
| **Success** | `#10B981` | `emerald-500` | Done, on-schedule |
| **Danger** | `#EF4444` | `red-500` | Overdue, bugs, errors |
| **Warning** | `#F59E0B` | `amber-500` | In-progress, pending |

### Surface Colors
| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| **Background** | `#F8FAFC` | `slate-50` | Main content bg |
| **Surface** | `#FFFFFF` | `white` | Cards, panels |
| **Sidebar BG** | `#0F172A` | `slate-900` | Left sidebar |
| **Sidebar Hover** | `#1E293B` | `slate-800` | Sidebar hover state |
| **Sidebar Active** | `#1D4ED8` | `blue-700` | Active sidebar item bg |
| **Border** | `#E2E8F0` | `slate-200` | Card borders, dividers |
| **Text Primary** | `#1E293B` | `slate-800` | Headings, primary text |
| **Text Secondary** | `#475569` | `slate-600` | Description, labels |
| **Text Muted** | `#94A3B8` | `slate-400` | Timestamps, hints |
| **Text Sidebar** | `#CBD5E1` | `slate-300` | Sidebar text |

## Typography

**Font Family:** Inter (system default fallback, already in Next.js)

| Level | Size | Weight | Line Height | Tailwind |
|-------|------|--------|-------------|----------|
| H1 | 24px | 700 | 1.3 | `text-2xl font-bold` |
| H2 | 20px | 600 | 1.35 | `text-xl font-semibold` |
| H3 | 16px | 600 | 1.4 | `text-base font-semibold` |
| Body | 14px | 400 | 1.5 | `text-sm` |
| Caption | 12px | 500 | 1.4 | `text-xs font-medium` |
| Tiny | 11px | 400 | 1.3 | `text-[11px]` |

## Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | `p-1` | Icon padding, tight gaps |
| `sm` | 8px | `p-2` | Compact component padding |
| `md` | 12px | `p-3` | Default component padding |
| `lg` | 16px | `p-4` | Card padding, section gaps |
| `xl` | 24px | `p-6` | Page padding, major sections |

## Component Patterns

### Sidebar (Dark)
```
w-60 bg-slate-900 text-slate-300
├── Logo section: h-14 px-4 border-b border-slate-700
├── Dashboard link: px-3 py-2 rounded-md hover:bg-slate-800
├── Projects label: px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider
├── Project item (collapsed): px-3 py-2 rounded-md hover:bg-slate-800 cursor-pointer
│   ├── ChevronRight icon (w-4 h-4)
│   └── Project name (text-sm truncate)
├── Project item (expanded): bg-slate-800/50 rounded-md
│   ├── Project header: px-3 py-2 (ChevronDown + name)
│   └── Sub-items: pl-8 py-1.5 text-sm hover:text-blue-400
│       ├── Tasks (active: text-blue-400 bg-blue-500/10)
│       ├── Kanban
│       ├── Gantt Chart
│       ├── Members
│       └── Reports
└── Bottom: User avatar + name + logout (optional)
```

### Summary Cards
```
grid grid-cols-2 lg:grid-cols-4 gap-4
└── Card: bg-white rounded-lg border border-slate-200 p-4
    ├── Icon + Label: flex items-center gap-2 text-sm text-slate-600
    ├── Value: text-2xl font-bold mt-1 (colored per type)
    └── Trend (optional): text-xs text-slate-400
```

### Data Tables
```
bg-white rounded-lg border border-slate-200 overflow-hidden
├── Header row: bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wider
├── Body rows: text-sm border-t border-slate-100 hover:bg-slate-50 cursor-pointer
├── Cell padding: px-4 py-3
└── Responsive: overflow-x-auto wrapper
```

### Status Badges
| Status | Tailwind Classes |
|--------|-----------------|
| todo | `bg-slate-100 text-slate-700` |
| doing | `bg-blue-100 text-blue-700` |
| review | `bg-purple-100 text-purple-700` |
| done | `bg-emerald-100 text-emerald-700` |
| close | `bg-slate-100 text-slate-500` |
| blocked | `bg-red-100 text-red-700` |
| pending | `bg-amber-100 text-amber-700` |

### Task Type Badges
| Type | Tailwind Classes |
|------|-----------------|
| bug | `bg-red-50 text-red-700 border border-red-200` |
| feature | `bg-blue-50 text-blue-700 border border-blue-200` |
| enhancement | `bg-purple-50 text-purple-700 border border-purple-200` |
| documentation | `bg-emerald-50 text-emerald-700 border border-emerald-200` |

### Priority Badges
| Priority | Tailwind Classes |
|----------|-----------------|
| critical | `bg-red-600 text-white` |
| urgent | `bg-orange-500 text-white` |
| high | `bg-amber-100 text-amber-800` |
| medium | `bg-blue-100 text-blue-700` |
| low | `bg-slate-100 text-slate-600` |

### Buttons
| Variant | Classes |
|---------|---------|
| Primary | `bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-md text-sm font-medium transition-colors` |
| Secondary | `bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 px-4 py-2 rounded-md text-sm font-medium` |
| Ghost | `text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-3 py-1.5 rounded-md text-sm` |
| Danger | `bg-red-600 text-white hover:bg-red-700 px-4 py-2 rounded-md text-sm font-medium` |
| Icon | `p-2 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-700` |

## Layout Dimensions

| Element | Value |
|---------|-------|
| Header height | `h-14` (56px) |
| Sidebar width | `w-60` (240px) |
| Content padding | `p-5` (20px) |
| Card border radius | `rounded-lg` (8px) |
| Content offset | `pl-60 pt-14` |

## Wireframes

### 1. Sidebar
```
┌──────────────────────────────┐
│ ◆ Task Scheduler      [≡]   │ h-14, border-b
├──────────────────────────────┤
│ 🏠 Dashboard                 │ Active: bg-blue-700
├──────────────────────────────┤
│ DỰ ÁN                       │ Section label (uppercase)
│ ▼ Project Alpha              │ Expanded
│    📋 Danh sách CV           │ ← Active (blue-400)
│    📊 Kanban                 │
│    📈 Gantt Chart            │
│    👥 Thành viên             │
│    📉 Báo cáo               │
│ ▶ Project Beta               │ Collapsed
│ ▶ Project Gamma              │ Collapsed
│                              │
│                              │
├──────────────────────────────┤
│ 👤 Nguyễn Văn A      [⚙]   │ Bottom user section
└──────────────────────────────┘
w-60, bg-slate-900
```

### 2. Dashboard - PM View
```
┌─ Header ──────────────────────────────────────────────┐
│ ◆ Task Scheduler    [🔔]  👤 Admin                    │
├─ Sidebar ─┬───────────────────────────────────────────┤
│            │  Xin chào, Admin!                         │
│ Dashboard  │                                           │
│            │  ┌────────┐┌────────┐┌────────┐┌────────┐│
│ DỰ ÁN     │  │ Trễ    ││ Đang   ││ Bug    ││Critical││
│ ▶ Alpha   │  │  5     ││ làm 12 ││  3     ││  2     ││
│ ▶ Beta    │  │ 🔴     ││ 🔵     ││ 🟠     ││ 🔴     ││
│            │  └────────┘└────────┘└────────┘└────────┘│
│            │                                           │
│            │  Task đang trễ                            │
│            │  ┌──────────────────────────────────────┐│
│            │  │ Task    │ Project │ Assignee │ Status ││
│            │  │ Fix API │ Alpha   │ Tien     │ doing  ││
│            │  │ Deploy  │ Beta    │ Lan      │ todo   ││
│            │  └──────────────────────────────────────┘│
│            │                                           │
│            │  Bug chưa hoàn thành                      │
│            │  ┌──────────────────────────────────────┐│
│            │  │ Task    │ Project │ Priority │ Status ││
│            │  └──────────────────────────────────────┘│
└────────────┴──────────────────────────────────────────┘
```

### 3. Dashboard - Member View
```
┌─ Header ──────────────────────────────────────────────┐
├─ Sidebar ─┬───────────────────────────────────────────┤
│            │  Xin chào, Tien!                          │
│ Dashboard  │                                           │
│            │  ┌──────────┐┌──────────┐┌──────────┐    │
│ DỰ ÁN     │  │ Tổng CV  ││ Đang làm ││ Chờ       │    │
│ ▶ Alpha   │  │  8       ││  3       ││  2       │    │
│            │  └──────────┘└──────────┘└──────────┘    │
│            │                                           │
│            │  Công việc của tôi                         │
│            │  ┌──────────────────────────────────────┐│
│            │  │ Task     │ Project │ Priority│ Status ││
│            │  │ Fix bug  │ Alpha   │ high    │ doing  ││
│            │  │ Design   │ Alpha   │ medium  │ todo   ││
│            │  │ Test API │ Beta    │ urgent  │ doing  ││
│            │  └──────────────────────────────────────┘│
│            │  ↑ Click row → navigate to project/task   │
└────────────┴──────────────────────────────────────────┘
```

### 4. Project Detail (via sidebar tab)
```
┌─ Header ──────────────────────────────────────────────┐
├─ Sidebar ─┬───────────────────────────────────────────┤
│            │  Project Alpha › Danh sách CV    [+ Thêm]│
│ Dashboard  │  ┌──────────────────────────────────────┐│
│            │  │ Loại│ Task     │ Status│ Priority│ ...││
│ DỰ ÁN     │  │ 🐛 │ Fix API  │ doing │ high    │    ││
│ ▼ Alpha   │  │ ✨ │ New UI   │ todo  │ medium  │    ││
│  📋 CV ←  │  │ 🐛 │ Login err│ review│ urgent  │    ││
│   📊 Kanban│  │ 📄 │ Write doc│ todo  │ low     │    ││
│   📈 Gantt │  └──────────────────────────────────────┘│
│   👥 TV    │                                           │
│   📉 BC    │  ← No project header!                    │
│ ▶ Beta    │     Content starts immediately             │
└────────────┴──────────────────────────────────────────┘
```

## Transition Rules
- All interactive: `transition-colors duration-200`
- Sidebar expand: `transition-all duration-200`
- Card hover: `hover:shadow-sm transition-shadow`
- No transform-based hover (no layout shift)

## Icon System
- Use **Heroicons Outline** (24x24) for navigation, **Heroicons Solid** (20x20) for inline
- Sidebar icons: `w-5 h-5`
- Table/badge icons: `w-4 h-4`
- Don't use emojis as icons in production (wireframes above use them for readability only)
