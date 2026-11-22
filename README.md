# Nexadrop passenger

Branch: `jojo`. Run `bun install` then `bun run start`. Use your computer LAN address for `EXPO_PUBLIC_API_URL` on a physical phone.

The vendored shared packages are a versioned snapshot from nexa-backend, not independent implementations. Refresh with the backend export script. Native app IDs, EAS IDs and legacy device storage keys are retained for account/history continuity. Google Maps native keys and LiveKit calls require development builds; Expo Go cannot provide every native integration.

The API and its separate background worker must both run from nexa-backend. Passenger Metro uses 8081; driver uses 8082. Stop the old Flash API before binding its port 4000, or explicitly configure another API port in each app.
