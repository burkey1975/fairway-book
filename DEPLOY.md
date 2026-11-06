# Putting Fairway Book online

There are three pieces. Each has a free plan to start with:

| Piece | What it does | Where |
|---|---|---|
| **GitHub** | Stores the code | github.com |
| **Supabase** | Database, sign-in, live leaderboards, course search | supabase.com |
| **Vercel** | Hosts the app as a website your group opens on their phones | vercel.com |

Once it's live, your mates open a link (e.g. `https://fairway-book.vercel.app`) and add it to their home screen. No App Store needed. Real App Store / Play Store apps are optional (Part 5).

---

## Part 1: Upload to GitHub

**Option A: in the browser (no command line)**

1. Unzip `fairway-book.zip`.
2. Go to <https://github.com/new>. Name the repository `fairway-book`, choose **Private**, and click **Create repository**.
3. On the empty repo page, click **uploading an existing file**.
4. Open the unzipped `fairway-book` folder, select **everything inside it** (not the folder itself) and drag it onto the page.
   - Files starting with a dot (`.gitignore`, `.npmrc`, `.env.example`) are hidden by default. On a Mac press <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>.</kbd> in Finder to show them. On Windows tick **View → Hidden items**. Upload them too.
5. Click **Commit changes**.

**Option B: with git**

```bash
cd fairway-book
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/fairway-book.git
git push -u origin main
```

> Never upload your `.env` file. It is already excluded by `.gitignore`. Your keys go into Vercel instead (Part 3).

---

## Part 2: Set up Supabase (once)

Follow **Setup → 1. Backend** in `README.md`. In short: create a project, run `npx supabase db push`, set your `GOLFCOURSEAPI_KEY` secret, deploy the `course-search` function, and add `{{ .Token }}` to the Magic Link email template.

Then copy two values from **Project Settings → API**:
- the **Project URL**
- the **anon / publishable key** (this one is safe to use in the app; never use the `service_role` key)

---

## Part 3: Host the website on Vercel

1. Sign up at <https://vercel.com> with your GitHub account.
2. Click **Add New… → Project** and **Import** the `fairway-book` repository.
3. Leave **Framework Preset** as **Other**. The included `vercel.json` already sets the build.
4. Open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `EXPO_PUBLIC_SUPABASE_URL` | your Supabase Project URL |
   | `EXPO_PUBLIC_SUPABASE_KEY` | your anon / publishable key |

5. Click **Deploy**. After a few minutes you get a link like `https://fairway-book-xxxx.vercel.app`.
6. Every time you push a change to GitHub, Vercel rebuilds and updates the site automatically.

Optional: use your own domain under **Project → Settings → Domains**.

---

## Part 4: Put it on your phones

Send the link to your group. Each person opens it and signs in with their email code. To get an app icon on the home screen:

- **iPhone (Safari):** tap **Share → Add to Home Screen**
- **Android (Chrome):** tap **⋮ → Add to Home screen** (or **Install app**)

---

## Part 5 (optional): App Store and Play Store apps

The same code builds real iOS and Android apps with Expo's build service (EAS):

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android     # or: --platform ios
eas submit --platform android    # uploads to the store
```

You'll need a Google Play developer account and/or an Apple Developer Program membership (both paid). Before your first store build, change `ios.bundleIdentifier` and `android.package` in `app.json` from `com.example.fairwaybook` to your own (e.g. `com.yourname.fairwaybook`).

---

## Test locally first (recommended)

Before your first deploy, check that the website builds on your computer:

```bash
cp .env.example .env              # fill in your Supabase URL and key
npm install
npx expo install --fix            # pins package versions that match the Expo SDK
npx expo start --web              # opens the app in your browser
```

If it works, commit the updated `package.json` and the new `package-lock.json` to GitHub. Vercel then installs exactly the versions you tested.

## Good to know

- Vercel's free **Hobby** plan is for personal, non-commercial use. If you charge people or run it as a business, you'd need a paid plan.
- Free Supabase projects are paused after a period of no use. You can restore one from the Supabase dashboard.
- If the Vercel build fails, open the build log in Vercel. Most failures are package versions, and the local test above catches those.
