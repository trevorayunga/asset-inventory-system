# AssetTrack: Asset & Inventory Management System

AssetTrack is a front-end web app for tracking an organisation's equipment and stock. It manages **items**, **categories** and **stock movements** (assign, return, issue, restock, receive) against a REST API built with [JSON Server](https://github.com/typicode/json-server). It is written in vanilla JavaScript (ES modules), semantic HTML and plain CSS, with no front-end framework.

> **Live demo:** `<add your deployed URL>` | **API:** `<add your deployed JSON Server URL>`

---

## Table of contents

1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [Project structure](#project-structure)
4. [Getting started](#getting-started)
5. [Configuration](#configuration)
6. [REST API and HTTP methods](#rest-api-and-http-methods)
7. [Data model](#data-model)
8. [Business rules](#business-rules)
9. [Architecture](#architecture)
10. [Testing](#testing)
11. [Accessibility](#accessibility)
12. [Git workflow](#git-workflow)
13. [Deployment notes](#deployment-notes)
14. [Roadmap](#roadmap)
15. [Author and licence](#author-and-licence)

---

## Features

**Dashboard (`index.html`)**
- Live KPI cards: total units, total stock value (KES), low-stock count, assigned assets.
- Low-stock alerts with a one-click **Restock** action.
- Five most recent movements.
- Summary band: assets and accessories, available to assign, components and consumables, next action.

**Items (`items.html`)**
- Table of all items with category, group, quantity and a calculated status badge.
- Search by name or SKU, filter by category, group and status, and sort (name, quantity, unit cost).
- Pagination with a "Showing X-Y of Z" count.
- Add, edit and delete items through accessible modal dialogs.
- Record movements (assign, restock and so on) from each row.

**Item detail (`item-detail.html?id=`)**
- Full facts for one item: SKU, quantity, availability, unit cost, total value.
- Complete movement history for that item.
- Edit, record movement, receive stock and delete.

**Movements (`movements.html`)**
- Full history across all items.
- Search by item, person or note; filter by action and date range; paginated.

**Catalogue import (`catalogue.html`)**
- Imports products from the public DummyJSON catalogue, converting prices from USD to KES. *(In progress; see [Roadmap](#roadmap).)*

**Quality features**
- Loading, error (with Retry) and empty states on every data view.
- Inline form validation with clear messages; toast notifications.
- Rollback if a movement's history entry fails to save, so stock and history never disagree.

---

## Tech stack

| Layer | Technology |
|---|---|
| Markup | Semantic HTML5 |
| Styling | CSS3 (custom properties, grid, flexbox), Inter font |
| Logic | Vanilla JavaScript (ES modules, `fetch`, async/await) |
| API | JSON Server (REST, backed by `db.json`) |
| Testing | Jest (pure-function unit tests) |
| Version control | Git and GitHub (feature branches, pull requests) |

---

## Project structure

```
asset-inventory-system/
├── index.html              # Dashboard
├── items.html              # Items list, filters, add/edit/delete
├── item-detail.html        # Single item and its movement history
├── movements.html          # All movements, filters, pager
├── catalogue.html          # Catalogue import (Step 11)
├── db.json                 # JSON Server data: categories, items, movements
├── server.js               # Starts the API server
├── package.json
├── css/
│   ├── base.css            # Reset, tokens (colours, spacing), typography
│   ├── layout.css          # Page grids: sidebar, stat grid, filters, two-column
│   └── components.css      # Buttons, cards, badges, tables, modals, toasts
├── js/
│   ├── config.js           # API URL, page size, exchange rate
│   ├── api.js              # fetch wrapper: get/post/put/patch/del, ApiError
│   ├── itemService.js      # Item API calls (GET, POST, PUT, PATCH, DELETE)
│   ├── movementService.js  # Movement API calls and recordMovement()
│   ├── stock.js            # Business rules (pure)
│   ├── validators.js       # Form validation (pure)
│   ├── filters.js          # Search, filter, sort, paginate (pure)
│   ├── ui.js               # Rendering helpers, states, toasts, formatters
│   ├── dialogs.js          # Modal and confirm dialogs, form helpers
│   ├── itemForm.js         # Add / edit item dialog
│   ├── movementDialog.js   # Record movement dialog
│   └── pages/
│       ├── dashboard.js
│       ├── items.js
│       ├── itemDetail.js
│       └── movements.js
└── tests/                  # Jest unit tests
```

### Where to find things

| I want to change... | Look in |
|---|---|
| The API URL or page size | `js/config.js` |
| What counts as low stock | `js/stock.js` → `isLowStock` |
| The status badge text | `js/stock.js` → `displayStatus` |
| Dashboard totals | `js/stock.js` → `summariseInventory` |
| What a movement does to stock | `js/stock.js` → `applyMovement` |
| Validation messages | `js/validators.js` |
| Search and filter logic | `js/filters.js` |
| Table row HTML | `js/ui.js` → `renderItemRow` |
| Currency and date formatting | `js/ui.js` |

---

## Getting started

### Prerequisites
- [Node.js](https://nodejs.org/) 18 or later
- Git
- A static file server for the front end, such as the VS Code **Live Server** extension (the project uses port `5500`)

### Install and run

```bash
# 1. Clone
git clone https://github.com/<your-username>/asset-inventory-system.git
cd asset-inventory-system

# 2. Install dependencies
npm install

# 3. Start the API (http://localhost:3000)
node server.js

# 4. Serve the front end (http://localhost:5500)
#    In VS Code: right-click index.html → "Open with Live Server"
```

Open <http://localhost:5500/index.html>.

> If `package.json` defines an npm script for the API (for example `npm run api`), use that instead of `node server.js`.

The API must be running before you open any page; otherwise each page shows an error state with a **Retry** button.

---

## Configuration

All settings live in `js/config.js`:

| Constant | Default | Purpose |
|---|---|---|
| `API_BASE_URL` | `http://localhost:3000` | JSON Server URL. Change this to your deployed API before deploying the front end |
| `CATALOGUE_BASE_URL` | `https://dummyjson.com` | Public catalogue used by the import page |
| `USD_TO_KES` | `129` | Exchange rate for imported prices. Check the current rate before presenting |
| `PAGE_SIZE` | `8` | Rows per page on Items and Movements |

---

## REST API and HTTP methods

| Method | Endpoint | Used for | Where |
|---|---|---|---|
| `GET` | `/items?_expand=category&_sort=name` | List items with their category | `itemService.getItems` |
| `GET` | `/items/:id?_expand=category` | One item | `itemService.getItem` |
| `GET` | `/categories` | Category list and filter options | `itemService.getCategories` |
| `GET` | `/movements?_expand=item&_sort=date&_order=desc` | All movements, newest first | `movementService.getMovements` |
| `GET` | `/movements?itemId=:id` | One item's history | `movementService.getItemMovements` |
| `POST` | `/items` | Add an item | `itemService.createItem` |
| `POST` | `/movements` | Add a history entry | `movementService.createMovement` |
| `PUT` | `/items/:id` | Full edit of an item (edit dialog) | `itemService.updateItem` |
| `PATCH` | `/items/:id` | Change stock numbers after a movement | `itemService.patchItem` |
| `DELETE` | `/items/:id?_dependent=movements` | Delete an item and its history | `itemService.deleteItem` |

`PUT` replaces the whole record, so the edit dialog merges the existing stored fields (such as `assignedQuantity`) with the form values before sending.

---

## Data model

```json
{
  "categories": [{ "id": 1, "name": "Laptop", "group": "asset" }],
  "items": [{
    "id": 1,
    "name": "Dell Latitude 5420",
    "sku": "LAP-001",
    "categoryId": 1,
    "quantity": 6,
    "assignedQuantity": 2,
    "unitCost": 95000,
    "reorderLevel": 2,
    "status": "active"
  }],
  "movements": [{
    "id": 2,
    "itemId": 1,
    "action": "assign",
    "quantity": 2,
    "person": "Maya Patel",
    "note": "",
    "date": "2026-10-14T09:15:00.000Z"
  }]
}
```

Relationships: `items.categoryId → categories.id` and `movements.itemId → items.id`. JSON Server's `_expand` joins them on read, and `_dependent=movements` removes an item's history when the item is deleted.

**Groups** come from the category: `asset`, `accessory`, `component`, `consumable`.
**Item status** is stored as `active`, `maintenance` or `retired`. The badge shown (Available, Low stock, N assigned) is **calculated**, never stored.

---

## Business rules

| Group | Allowed actions | Effect |
|---|---|---|
| Asset, Accessory | `assign`, `return`, `receive` | assign/return change `assignedQuantity`; receive adds to `quantity` |
| Component, Consumable | `issue`, `restock`, `receive` | issue subtracts from `quantity`; restock and receive add to it |

- **Available units** = `quantity − assignedQuantity`.
- **Low stock** applies only to components and consumables that are not retired, when `quantity ≤ reorderLevel`.
- Items in maintenance or retired cannot be assigned or issued.
- You cannot assign more than are available, return more than are assigned, or issue more than are in stock.
- Assigning requires a person.
- On edit, quantity cannot drop below the units already assigned, and an item with assigned units must stay in an asset or accessory category.
- SKUs must be unique (case-insensitive) and use only letters, numbers, dots, dashes and underscores.
- Recording a movement validates twice: once against the page's data, then again against a fresh copy from the server.

---

## Architecture

```
page script  →  service (fetch)  →  stock / filters / validators (rules)  →  ui (HTML strings)  →  DOM
```

- **Page scripts** (`js/pages/`) are glue: load data, call helpers, attach listeners.
- **Services** are the only place that talk to the API.
- **`stock.js`, `validators.js`, `filters.js`** are pure functions with no DOM and no network, so they are fast to unit-test.
- **`ui.js`** returns HTML strings and escapes all user data with `escapeHtml`.
- Event delegation is used for table rows because rows are redrawn after every change.
- `recordMovement` PATCHes the item, then POSTs the history entry. If the POST fails, the PATCH is reverted.

---

## Testing

The pure modules are covered with Jest.

```bash
npx jest --coverage
```

Suggested targets: `validators.js`, `filters.js`, and the logic in `stock.js` (`applyMovement`, `isLowStock`, `displayStatus`, `summariseInventory`, `formatMovementQty`).

Keep a screenshot or the HTML coverage report as evidence.

### Manual test checklist
- [ ] Dashboard cards match `db.json` (75 units, KES 987,200, 2 low-stock, 14 assigned).
- [ ] Restock from a low-stock alert updates the cards and clears the alert.
- [ ] Items: search, group/status filters, sort, pager and "Clear filters" all work.
- [ ] Add, edit and delete an item; changes persist after reload.
- [ ] Item detail: Edit, Assign/Return, Restock/Issue, Receive and Delete (redirects to Items).
- [ ] Movements: search, action filter, date range, pager, Clear.
- [ ] Stop the API and confirm each page shows an error with Retry.

---

## Accessibility

- Semantic landmarks (`header`, `nav`, `main`, `footer`) and a skip link.
- Every form control has a label; errors use `aria-invalid` and `aria-describedby`.
- Native `<dialog>` for modals: focus is trapped, Esc closes, focus returns to the opener.
- Status messages use `role="status"` and `role="alert"`; toasts use `aria-live`.
- Tables use `scope` on headers; the current page and nav item use `aria-current`.

---

## Git workflow

- `main` is always working. Work happens on feature branches, merged by pull request.
- Branch names: `feat/<name>`, `fix/<name>`, `test/<name>`.
- Commit style: [Conventional Commits](https://www.conventionalcommits.org/), for example:

```
feat: add items filter bar with search, group, status and sort
feat: add dashboard, item detail and movements pages
fix: keep filter controls inside the form
test: add validator and filter unit tests
docs: write README
```

---

## Deployment notes

- **Front end:** any static host (GitHub Pages, Netlify, Vercel). Set `API_BASE_URL` in `js/config.js` to the deployed API first.
- **API:** JSON Server writes to `db.json`. Free tiers such as Render use an **ephemeral filesystem**, so writes can reset on restart or redeploy. To satisfy "data persists between reloads", host the API somewhere with a persistent disk, or verify persistence before submitting.
- Allow CORS from your front-end origin if the API and front end are on different domains.

---

## Roadmap

- [ ] Catalogue import from DummyJSON with USD → KES conversion (`catalogue.html`)
- [ ] Unit tests with coverage report
- [ ] Overdue and audit views
- [ ] Authentication and user roles
- [ ] Export movements to CSV

---

## Author and licence

`Ombaso Trevor Ayunga` 

Released under the licence in [`LICENSE`](LICENSE).
