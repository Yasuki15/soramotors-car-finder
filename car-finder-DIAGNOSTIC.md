# Car Finder – How to diagnose “won’t go to result screen”

Use this **before** changing any code, to see what’s actually failing.

---

## Step 1: Get the real error (browser console)

1. Open your Car Finder page in the browser.
2. Open **Developer Tools**:
   - **Chrome/Edge**: `F12` or `Ctrl+Shift+J` (Windows) / `Cmd+Option+J` (Mac)
   - **Firefox**: `F12` or `Ctrl+Shift+K` / `Cmd+Option+K`
3. Go to the **Console** tab.
4. Clear the console (trash icon or “Clear console”).
5. Reproduce the issue:
   - Answer the questions until the last one (“Are you looking for a special type of vehicle?”).
   - Select at least one option.
   - Click **“Next Question”** (the button that should show results).
6. In the console, look for **red error messages** and the **stack trace** (the lines under the error showing file names and line numbers).

**Write down or screenshot:**
- The **exact error message** (e.g. `car.tags.filter is not a function`).
- The **first file and line number** in the stack (e.g. `car-finder.js line 534`).

That tells us *where* it breaks and *what* operation failed.

---

## Step 2: What the error usually means

| What you see in console | Likely cause |
|-------------------------|--------------|
| `xxx.filter is not a function` or `xxx.map is not a function` | `tags` or `features` from Supabase are **not arrays** (e.g. they’re strings or `null`). Very common after new/edited data. |
| `Cannot read property 'car' of undefined` | Result of matching is in an unexpected shape (e.g. raw car list vs `{ car, matchCount, ... }`). |
| `Cannot read property 'X' of undefined` (e.g. `name`, `price`, `imageExterior`) | A car row from Supabase is **missing a field** the code expects, or the column name in Supabase doesn’t match (e.g. `price_range` vs `price`). |
| No red error, but screen doesn’t change | Logic/flow issue (e.g. condition that prevents calling the results screen). Less common than the ones above. |

So: **wrong or missing data from Supabase (tags/features/columns) can definitely cause this.** The console error will confirm.

---

## Step 3: Check your Supabase data (tags and columns)

### Tags must match question option values exactly

The app expects **exact** tag values. If even one character is different, that tag won’t match.

**Valid tag examples (from your questions):**

- Budget: `budget_low`, `budget_medium`, `budget_high`, `budget_premium`
- Seats: `seats_small`, `seats_medium`, `seats_large`
- Fuel: `fuel_petrol`, `fuel_diesel`, `fuel_hybrid`, `fuel_electric`, `fuel_phv`
- Terrain: `terrain_city`, `terrain_highway`, `terrain_rural`, `terrain_offroad`
- Priorities: `priorities_family`, `priorities_performance`, `priorities_comfort`, `priorities_efficiency`
- Engine: `engine_small`, `engine_medium`, `engine_large`
- Boot: `boot_small`, `boot_medium`, `boot_large`
- Tech: `tech_none`, `tech_basic`, `tech_advanced`
- Year: `year_new`, `year_1_2`, `year_2_5`, `year_5_10`, `year_10_15`, `year_15_20`, `year_20_plus`
- Special type: `special_welcab`, `special_campervan`, `special_work`, `special_normal`

**In Supabase, for each new/edited row, check:**

1. **Column name**: Is it `tags`? (Not `tag` or something else.)
2. **Type**: Is `tags` stored as a **Postgres array** or **JSON/JSONB**? (Not a plain string like `"budget_low, seats_medium"` unless the app is explicitly parsing that.)
3. **Values**: No typos (e.g. `budget_low` not `budget low` or `Budget_Low`). No extra spaces.

Same idea for **features**: the code expects an **array** (or something that can be turned into one). A single long string can cause `.map` errors.

---

## Step 4: Quick data check from the browser console

After the app has loaded (and ideally after you’ve seen the error once), you can run this in the **Console** to inspect what the app actually has:

```javascript
// Run this in the browser console (after the page has loaded)
const db = window.carFinder?.carDatabase || [];
console.log('Number of cars loaded:', db.length);
if (db.length > 0) {
  const first = db[0];
  console.log('First car name:', first?.name);
  console.log('First car tags:', first?.tags);
  console.log('First car tags type:', typeof first?.tags, Array.isArray(first?.tags) ? '(array)' : '(NOT array)');
  console.log('First car features:', first?.features);
  console.log('First car features type:', typeof first?.features, Array.isArray(first?.features) ? '(array)' : '(NOT array)');
  // Check for any car with non-array tags
  const badTags = db.filter(c => !Array.isArray(c.tags));
  const badFeatures = db.filter(c => c.features != null && !Array.isArray(c.features));
  if (badTags.length) console.warn('Cars with tags that are NOT arrays:', badTags.length, badTags.map(c => ({ name: c.name, tags: c.tags })));
  if (badFeatures.length) console.warn('Cars with features that are NOT arrays:', badFeatures.length, badFeatures.map(c => ({ name: c.name, features: c.features })));
}
```

**Note:** Your app creates a global `carFinder` when it loads, so you can also type `carFinder.carDatabase` in the console to inspect the loaded cars. If the page hasn’t loaded yet or the variable isn’t there, rely on **Step 1** (the red error and stack trace) and **Step 3** (Supabase table and tag values).

---

## Step 5: Summary – how to diagnose

1. **Reproduce the issue** with the Console open and **capture the exact error and stack trace** (Step 1).
2. **Match the error** to the table in Step 2 (tags/features not arrays, missing field, wrong structure).
3. **In Supabase**, check **column names**, **types**, and **tag spelling** for new/changed rows (Step 3).
4. Optionally run the **console snippet** (Step 4) to see tags/features types and which cars look wrong.

Once you have the **exact error message** and (if possible) a note on whether `tags`/`features` are arrays or not, you’ll know whether the cause is wrong tags, wrong data types, or something else. Then we can make the right fix.
