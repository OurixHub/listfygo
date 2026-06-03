---
name: listfygo
description: Use this skill for ALL development tasks on the ListfyGo project — a React Native + Expo + Supabase household shopping coordination app. Triggers whenever the user mentions ListfyGo, shoplist-app, shared_lists, shopper screen, guest session, applyGuestSession, finishShopping, Alert Writer/Owner, invite.js, or any file under C:\Users\loure\shoplist-app. ALWAYS consult this skill before touching any file in the project — it contains critical architecture decisions, protected patterns, and rules that MUST be respected to avoid regressions.
---

# ListfyGo — Lead Agent Skill

## What ListfyGo is

ListfyGo is a **household shopping coordination platform** — not a shopping list app.
Multiple people coordinate a shopping session through defined roles.

## Project location

```
C:\Users\loure\shoplist-app
```

## Tech stack

- React Native + Expo + Expo Router
- Supabase (database + auth)
- Vercel (hosting)
- GitHub (source control)
- Test devices: iPhone Safari + Desktop Chrome

---

## File structure

```
app/
├── (tabs)/
│   ├── index.js           ← ENTIRE app lives here (owner + guest/shopper views)
│   ├── index_FREEZE_V1.js ← frozen backup, never touch
│   └── _layout.tsx
├── invite.js              ← accept invite landing screen
├── modal.tsx
└── _layout.tsx
lib/
└── supabase.js
i18n.js                    ← language support (EN / PT / ES)
```

**Critical:** There is no separate shopper screen file. Everything renders conditionally inside `index.js` based on `guestSession` and `mockRole` state.

---

## Role system (frozen — do not change)

| Role | Permissions |
|------|-------------|
| Owner | Full control. Creates location, invites, monitors activity |
| Writer | Creates/edits/moves sections and items |
| Shopper | Adds items to cart, sets prices, marks missing, alerts, finishes |
| Viewer | Read only |

---

## Supabase tables (existing — use these, do not create new ones)

| Table | Purpose |
|-------|---------|
| `shared_lists` | Locations — the only table with real data today |
| `sectors` | Sections within a location |
| `items` | Items within a sector |
| `item_events` | Shopping events (cart, missing, alert, finished) |
| `receipts` | Completed shopping sessions |
| `receipt_items` | Individual items in a receipt |
| `households` | User household grouping |
| `household_members` | Members of a household |
| `list_members` | Members with access to a shared_list |
| `profiles` | User profiles |
| `reminders` | (not in active use) |

**The `shared_lists` table is the single source of truth. All other tables use `shared_list_id` as the foreign key.**

---

## Current state of the app

### What works
- Owner creates locations → saved to `shared_lists` ✓
- Share link generation ✓
- Invite + accept invite flow ✓
- Guest session (Shopper opens link, sees list) ✓
- Cart total calculation ✓
- Unit/price per item ✓
- Mark as missing ✓
- Alert Writer/Owner button (UI only) ✓
- Finish Shopping (local only) ✓
- Activity feed (local only, bottom of screen) ✓
- Language switcher EN/PT/ES ✓

### What is broken / not connected
- Sectors and items are **local state only** — not saved to Supabase
- Shopper loads `shared_lists` but NOT `sectors`/`items` from Supabase
- "Alert Writer/Owner" does not persist — local vibration only
- `finishShopping` does not save to `receipts`/`receipt_items`
- Owner does not see Shopper activity from Supabase

### Known bugs to fix
1. DEBUG blocks visible in Shopper view — remove completely
2. `sectionlabel` template literal not resolving — renders as raw code
3. Missing item has no visual distinction from cart item
4. `Test Role` switcher visible in Profile — debug tool, remove before launch

---

## Key functions in index.js

| Function | Location | Status |
|----------|----------|--------|
| `applyGuestSession` | lines 302–377 | Fetches `shared_lists` only — needs sectors+items |
| `finishShopping` | lines 835–875 | Local only — needs Supabase save |
| Alert button handler | lines 1276–1303 | Local only — needs `item_events` insert |
| Guest render gates | lines 885–933 | Working |
| Activity feed | bottom of screen | Local only |

---

## The 4 Supabase connections needed (priority order)

### 1. Save sectors and items
- On section create → upsert `sectors` (`shared_list_id`, `name`, `position`)
- On item create/edit → upsert `items` (`sector_id`, `shared_list_id`, `name`, `qty`, `price`, `unit`, `status`)

### 2. Shopper loads real data
- In `applyGuestSession`, after fetching `shared_lists`, fetch `sectors` + `items` where `shared_list_id` matches
- Map into existing locations state structure — do not change state shape

### 3. Alert persists
- Alert button → insert into `item_events` (`shared_list_id`, `item_id`, `event_type: 'missing_alert'`, `created_by_role: 'shopper'`)
- Owner activity feed → poll `item_events` on mount

### 4. Finish Shopping saves
- Insert into `receipts` (`shared_list_id`, `total`, `created_at`)
- Insert each item into `receipt_items` (`receipt_id`, `item_name`, `status`, `price`)
- Then clear state as today

---

## Shopper flow (complete, correct)

```
Owner creates Location
    ↓
Owner/Writer adds sections + items
    ↓
Owner invites Shopper via link
    ↓
Shopper opens link → sees list (read only structure)
    ↓
Shopper: adds items to cart + sets price per item
    ↓
Shopper: marks item as Missing if not found
    ↓
Missing → "Alert Writer/Owner" button appears
    ↓
Owner/Writer sees alert → suggests alternative item
    ↓
Shopper receives response → swaps item
    ↓
Shopper: Finish Shopping → saves receipt → list archived
```

---

## Development rules (mandatory)

1. **Do not rewrite anything.** Connect existing functions to Supabase.
2. **Do not change the UI** unless fixing a listed bug.
3. **Do not create new files** unless absolutely necessary.
4. **Do not change routing** — Expo Router structure is frozen.
5. **Do not touch `index_FREEZE_V1.js`** — ever.
6. **Test on iPhone Safari after every step.** Code analysis is not proof it works.
7. **Show plan before writing code.** Never start coding without approval.
8. **One step at a time.** Complete and validate before moving to next.

---

## What NOT to do

- Do not redesign the app
- Do not introduce new state management
- Do not add new dependencies without strong justification
- Do not create fake/mock data that simulates Supabase
- Do not rebuild the sharing system
- Do not add realtime/websocket infrastructure yet
- Do not chase theoretical improvements

---

## Launch definition

ListfyGo is launch-ready when:
1. Owner creates location + list → saved to Supabase
2. Writer builds the list → saved to Supabase
3. Shopper opens link → sees real list from Supabase
4. Shopper marks cart/missing/alert → persisted to Supabase
5. Owner sees activity → from Supabase
6. Finish Shopping → saved to receipts
7. No DEBUG blocks visible anywhere
8. Works on iPhone Safari end-to-end
