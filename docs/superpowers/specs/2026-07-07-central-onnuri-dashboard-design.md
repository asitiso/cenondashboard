# Central Onnuri Dashboard Design

## Goal

Build a first-version internal dashboard for Central Onnuri Pharmacy that helps staff quickly see what needs action today across Firestore collections.

## Product Judgment

The dashboard prioritizes clear operational savings over novelty. Features are included only when they clearly reduce confusion or repeated checking compared with opening several Firestore paths or spreadsheets manually. First-version scope excludes automation that would add maintenance risk without a large immediate time saving.

## Architecture

Use a Vite React TypeScript single-page app. Firebase Web SDK handles email/password sign-in and Firestore `onSnapshot` listeners. When Firebase environment variables are missing, the app runs in mock mode so the UI can be reviewed immediately.

## Data Sources

- `topics`
- `manual_improve`
- `teams/Q1/drugs`
- `teams/Q2/drugs`

Drug data is displayed together where useful, but each normalized item keeps its original Firestore path and team key so later save/update behavior can target the correct source.

## UX

The home screen is an action queue, not a full data dump. It highlights current changes, manual review waiting items, prescription drug expiry risk, OTC expiry risk, overdue items, and long-unhandled work. The main navigation includes Home, Changes, Manual Improvements, Drug Management, and Global Search.

Lists use dense rows, clear status badges, source labels, quick filters, and a readable detail panel. The app avoids complex statistics, external alerting, automatic approval, automatic delete, automatic merge, and official manual auto-editing in the first version.

## Error Handling

Firestore listener errors are shown in a visible error panel. Missing Firebase settings are not treated as fatal; the app switches to mock mode and clearly labels that state.

## Testing

Normalization and home-summary logic are tested because those are the parts most likely to cause staff confusion if source fields differ.
