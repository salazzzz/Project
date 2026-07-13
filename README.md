# Nova

A small web app. Currently: an animated intro that transitions into a login page.

## Run it

No build step. Just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## What's here

- **Animated intro** — logo draw-in, staggered title, tagline, and a loader bar. Click or press a key to skip.
- **Login page** — email/password with inline validation, show/hide password, "remember me", and a simulated sign-in.

## Next ideas

- Wire the sign-in to a real backend / auth provider
- Add a sign-up flow
- Build the dashboard the login leads into
