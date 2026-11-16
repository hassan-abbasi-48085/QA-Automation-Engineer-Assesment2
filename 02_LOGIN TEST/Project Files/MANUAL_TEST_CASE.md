# Manual Test Cases: Login

| Field | Value |
|---|---|
| Test case | TC-LOGIN: Login with username and password |
| Application under test | Practice Test Automation, "Test login" page |
| URL | https://practicetestautomation.com/practice-test-login/ |
| Documented test credentials | Username `student`, Password `Password123` (published on the page) |
| Browser | Google Chrome / Chromium, latest stable, desktop viewport |
| Priority | High |

> **Gherkin version:** the same eight cases are written in Gherkin (Given / When / Then) in `features/login.feature`. Each scenario is tagged with its ID (for example `@TC-LOGIN-01`), and that file is what the automation runs. TC-LOGIN-02 to 05 share one Scenario Outline with one `Examples` block per case.

## Common preconditions

1. The tester has network access to `practicetestautomation.com`.
2. The browser has no session for the site (use a fresh or private window).
3. The login page is open and shows the **Username** field, the **Password** field and the **Submit** button.

---

## TC-LOGIN-01: Successful login with valid credentials

**Preconditions:** Common preconditions 1–3.

**Test data**

| Field | Value |
|---|---|
| Username | `student` |
| Password | `Password123` |

**Steps**

1. Open `https://practicetestautomation.com/practice-test-login/`.
2. Type `student` into the **Username** field.
3. Type `Password123` into the **Password** field.
4. Click **Submit**.

**Expected results**

1. The browser navigates to `https://practicetestautomation.com/logged-in-successfully/`.
2. The page shows the heading **Logged In Successfully**.
3. The page shows the text **Congratulations student. You successfully logged in!**
4. A **Log out** control is visible.
5. No error message is shown.

**Automated:** Yes, `features/login.feature`, tag `@TC-LOGIN-01`.

---

## TC-LOGIN-02: Valid username with an incorrect password

**Preconditions:** Common preconditions 1–3.

**Test data**

| Field | Value |
|---|---|
| Username | `student` |
| Password | `incorrectPassword` |

**Steps**

1. Open `https://practicetestautomation.com/practice-test-login/`.
2. Type `student` into the **Username** field.
3. Type `incorrectPassword` into the **Password** field.
4. Click **Submit**.

**Expected results**

1. The browser stays on `/practice-test-login/` (no navigation to `/logged-in-successfully/`).
2. An error message is displayed with the text **Your password is invalid!**
3. No **Log out** control is shown and the user is not signed in.

**Automated:** Yes, `features/login.feature`, tag `@TC-LOGIN-02`.

---

## TC-LOGIN-03: Submit with both fields blank

**Preconditions:** Common preconditions 1–3, and both fields are empty.

**Test data**

| Field | Value |
|---|---|
| Username | *(empty)* |
| Password | *(empty)* |

**Steps**

1. Open `https://practicetestautomation.com/practice-test-login/`.
2. Leave the **Username** field empty.
3. Leave the **Password** field empty.
4. Click **Submit**.

**Expected results**

1. The browser stays on `/practice-test-login/`.
2. An error message is displayed with the text **Your username is invalid!** (the page validates the username before the password, so a blank username is reported first).
3. No **Log out** control is shown and the user is not signed in.

**Automated:** Yes, `features/login.feature`, tag `@TC-LOGIN-03`.

---

## TC-LOGIN-04: Invalid username with a valid password

**Preconditions:** Common preconditions 1–3.

**Test data**

| Field | Value |
|---|---|
| Username | `incorrectUser` |
| Password | `Password123` |

**Steps**

1. Open `https://practicetestautomation.com/practice-test-login/`.
2. Type `incorrectUser` into the **Username** field.
3. Type `Password123` into the **Password** field.
4. Click **Submit**.

**Expected results**

1. The browser stays on `/practice-test-login/`.
2. An error message is displayed with the text **Your username is invalid!**
3. The user is not signed in.

**Automated:** Yes, `features/login.feature`, tag `@TC-LOGIN-04`.

---

## TC-LOGIN-05: Valid username with a blank password

**Preconditions:** Common preconditions 1–3.

**Test data**

| Field | Value |
|---|---|
| Username | `student` |
| Password | *(empty)* |

**Steps**

1. Open `https://practicetestautomation.com/practice-test-login/`.
2. Type `student` into the **Username** field.
3. Leave the **Password** field empty.
4. Click **Submit**.

**Expected results**

1. The browser stays on `/practice-test-login/`.
2. An error message is displayed with the text **Your password is invalid!**
3. The user is not signed in.

**Automated:** Yes, `features/login.feature`, tag `@TC-LOGIN-05`.

---

## TC-LOGIN-06: Password field masks the typed value

**Preconditions:** Common preconditions 1–3.

**Test data**

| Field | Value |
|---|---|
| Password | `Password123` |

**Steps**

1. Open `https://practicetestautomation.com/practice-test-login/`.
2. Type `Password123` into the **Password** field.
3. Look at the **Password** field.

**Expected results**

1. The typed characters are shown as masking dots, not as plain text (the input is `type="password"`).
2. The field still holds the typed value, so it can be submitted.

**Automated:** Yes, `features/login.feature`, tag `@TC-LOGIN-06`.

---

## TC-LOGIN-07: Log out returns to the login page

**Preconditions:** Common preconditions 1–3.

**Test data**

| Field | Value |
|---|---|
| Username | `student` |
| Password | `Password123` |

**Steps**

1. Open `https://practicetestautomation.com/practice-test-login/`.
2. Log in with `student` / `Password123` and click **Submit**.
3. On the **Logged In Successfully** page, click **Log out**.

**Expected results**

1. After step 2, the **Logged In Successfully** page is shown with a **Log out** control.
2. After step 3, the browser returns to `/practice-test-login/`.
3. The **Username** and **Password** fields and the **Submit** button are shown again.

**Automated:** Yes, `features/login.feature`, tag `@TC-LOGIN-07`.

---

## TC-LOGIN-08: Valid login succeeds after a failed attempt

**Preconditions:** Common preconditions 1–3.

**Test data**

| Field | Value |
|---|---|
| 1st attempt | `student` / `incorrectPassword` |
| 2nd attempt | `student` / `Password123` |

**Steps**

1. Open `https://practicetestautomation.com/practice-test-login/`.
2. Type `student` and `incorrectPassword`, then click **Submit**.
3. Clear both fields, type `student` and `Password123`, then click **Submit**.

**Expected results**

1. After step 2, the error **Your password is invalid!** is displayed.
2. After step 3, the browser navigates to `/logged-in-successfully/`.
3. The page shows **Logged In Successfully**, the text **Congratulations student. You successfully logged in!** and a **Log out** control.

**Automated:** Yes, `features/login.feature`, tag `@TC-LOGIN-08`.

---

> **Verification note:** All eight scenarios were run against the live site on 2026-11-14 by the Gherkin suite (`playwright-bdd` 9.2.1 on Playwright 1.65.0): 8 passed in Chromium. TC-LOGIN-01 to 03 were also observed manually on 2026-11-12.
>
> **Note for automating the negative cases:** the error element `#error` is always in the page and already contains "Your username is invalid!" before Submit, hidden only by `opacity: 0`. The site reveals it by adding the class `show`. Playwright's `toBeVisible()` ignores opacity, so assert `toHaveClass(/show/)` before checking the text.

---

## Execution record

| ID | Date | Executed by | Browser / version | Actual result | Status |
|---|---|---|---|---|---|
| TC-LOGIN-01 | 2026-11-14 | Playwright + playwright-bdd | Chromium 158.0.8127.18 | Redirected to `/logged-in-successfully/`; heading, congratulations text and Log out shown | Pass |
| TC-LOGIN-02 | 2026-11-14 | Playwright + playwright-bdd | Chromium 158.0.8127.18 | Stayed on login page; "Your password is invalid!" shown | Pass |
| TC-LOGIN-03 | 2026-11-14 | Playwright + playwright-bdd | Chromium 158.0.8127.18 | Stayed on login page; "Your username is invalid!" shown | Pass |
| TC-LOGIN-04 | 2026-11-14 | Playwright + playwright-bdd | Chromium 158.0.8127.18 | Stayed on login page; "Your username is invalid!" shown | Pass |
| TC-LOGIN-05 | 2026-11-14 | Playwright + playwright-bdd | Chromium 158.0.8127.18 | Stayed on login page; "Your password is invalid!" shown | Pass |
| TC-LOGIN-06 | 2026-11-14 | Playwright + playwright-bdd | Chromium 158.0.8127.18 | Input is `type="password"` before and after typing; value retained | Pass |
| TC-LOGIN-07 | 2026-11-14 | Playwright + playwright-bdd | Chromium 158.0.8127.18 | Log out returned to login page with form visible | Pass |
| TC-LOGIN-08 | 2026-11-14 | Playwright + playwright-bdd | Chromium 158.0.8127.18 | Error after 1st attempt; 2nd attempt logged in | Pass |
