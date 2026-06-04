# Workout Tracker v5

Full stack — HTML/CSS/JS frontend + Node/Express backend + MySQL database.

## Project structure

```
workout-tracker-v5/       ← frontend (open index.html in browser)
├── index.html
├── style.css
├── app.js
└── README.md

workout-api/              ← backend (run with node server.js)
├── server.js
├── .env
├── schema.sql
└── package.json
```

## Running locally

### 1. Start the backend
```bash
cd workout-api
node server.js
```
Should print:
```
✅ Connected to MySQL database
🚀 Server running at http://localhost:3000
```

### 2. Open the frontend
Double-click `index.html` — or open it in your browser.
The app fetches data from `http://localhost:3000` automatically on load.

## API routes

| Method | Route | What it does |
|---|---|---|
| GET | /workouts | Fetch all workouts |
| POST | /workouts | Save a new workout |
| DELETE | /workouts/:id | Delete a workout |

## Stack

| Layer | Tech |
|---|---|
| Frontend | HTML, CSS, Vanilla JS |
| Backend | Node.js + Express |
| Database | MySQL |
| Charts | Chart.js |
| Icons | Tabler Icons |

## Next steps

- Deploy backend to Railway or Render
- Add user authentication
- Add Gemini AI suggestions
