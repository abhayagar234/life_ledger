# 📱 APP TESTING SKILL - Complete Testing Framework

**Purpose**: Test import statement and sample statement workflows as a real user (not code review)  
**Principle**: Only report what you OBSERVE, never assume  
**Output**: Structured bug reports + improvement suggestions  

---

## 🎯 WHEN TO USE THIS SKILL

### Invoke in future conversations with:
```
/test-workflows [TYPE] [PARAMS]

Examples:
- /test-workflows import-pdf /path/to/pdf/file.pdf
- /test-workflows sample-statement
- /test-workflows both /path/to/pdf/file.pdf
```

---

## 📋 TESTING PROCEDURE

### PART 1: IMPORT STATEMENT WORKFLOW TEST

**Objective**: Upload real PDF and verify complete flow from upload → home metrics

**Setup Required**:
- Real bank statement PDF file (CSV works too)
- Dev server running: `npm run dev`
- Backend running: `uvicorn app.main:run --reload`
- Browser/Expo client ready

---

#### TEST 1.1: File Upload & Validation

**User Action**: Click "Pick Statement File" button

**Verify** (Record EXACT observations):
- [ ] File picker dialog opens? (YES/NO)
- [ ] Can select PDF? (YES/NO)
- [ ] Upload starts? (YES/NO)
- [ ] "Uploading..." status shows? (YES/NO)
- [ ] Upload completes without error? (YES/NO)
  - If error: What message? (copy exact)
- [ ] Upload speed acceptable? (fast/slow/timeout)

**⚠️ STOP if upload fails** → Report as Bug and skip to next test

---

#### TEST 1.2: Preview Display

**Expected**: File details + transaction preview appear

**Verify** (Record EXACT observations):
- [ ] "Imported File" card appears?
  - If YES: Show file name? (YES/NO)
  - If YES: Show row count? (YES/NO)
  - If YES: Show duplicate count? (YES/NO)

- [ ] "Preview" section appears?
  - If YES: How many rows shown? (count or "blank")
  - If YES: Does each row show: [Date] · [Direction] · [Amount] · [Description]?
  - If YES: Are all fields populated or some blank?
  - If NO: Why not? (check console for errors)

**Observations to Record**:
```
Preview Status: [YES/NO]
Rows Shown: [N or "blank"]
Sample Row: [exact text or "empty"]
Missing Fields: [list which are blank]
Errors: [any visible errors]
```

---

#### TEST 1.3: Recurring Dues Detection

**Expected**: List of automatically detected recurring dues

**Verify** (Record EXACT observations):
- [ ] "Recurring Dues Found" section appears? (YES/NO)
- [ ] Any dues listed? (YES/NO)
  - If YES: How many? (count)
  - If YES: What are they? (list with names and amounts)
  - If YES: Each shows: [Name] · [Amount] · [Frequency] · [Confidence%]?
  
**For EACH detected due, ask**:
- Does it appear multiple times in your PDF? (YES/NO - CHECK PDF)
- Is the frequency correct? (YES/NO - CHECK PDF dates)
- Is the amount correct? (YES/NO - CHECK PDF)
- Would you want to track this? (YES/NO)

**Observations to Record**:
```
Dues Detected: [N or "none"]
List: 
  - [Name]: Rs [Amount], [Frequency], Confidence: [%]
  - [Name]: Rs [Amount], [Frequency], Confidence: [%]

Verification Against PDF:
  ✓ [Name] - appears [N] times, truly recurring
  ✗ [Name] - appears only once, NOT recurring
  ✗ [Name] - NOT in PDF
```

---

#### TEST 1.4: Dues Confirmation

**Expected**: User can select dues and confirm them

**Verify** (Record EXACT observations):
- [ ] Can toggle dues selection? (YES/NO)
- [ ] Can edit due name? (YES/NO)
  - If YES: Can clear and retype? (YES/NO)
  - If YES: Does it update live? (YES/NO)

- [ ] "Confirm Dues" button shows count? (YES/NO)
  - If YES: Does count match selected? (YES/NO)
  
- [ ] Can click "Confirm Dues"? (YES/NO)
  - If YES: Button shows loading? (YES/NO)
  - If YES: Completes without error? (YES/NO)
  - If error: What message? (copy exact)

**Observations to Record**:
```
Confirmation Status: [SUCCESS/FAILED]
Dues Confirmed: [N]
Error Message (if any): [exact text]
Time to confirm: [fast/slow/timeout]
```

---

#### TEST 1.5: Navigation to Home

**Expected**: App navigates to home and shows metrics

**Verify** (Record EXACT observations):
- [ ] Automatic redirect to home? (YES/NO)
- [ ] Manual "Go to Home" button needed? (YES/NO)
- [ ] Home page loads? (YES/NO)
- [ ] Any loading spinner visible? (YES/NO)
- [ ] Page fully loaded or still loading? (fully/partial/stuck)

---

#### TEST 1.6: Home Screen Metrics

**THIS IS CRITICAL** - Check each metric carefully

**Safe to Spend** (Hero Value):
- [ ] Shows a value? (YES/NO)
- [ ] Value > 0? (YES/NO)
  - If YES: How much? (exact amount)
  - If NO: Shows "Rs 0"? (YES/NO)
  - If NO: Shows empty/blank? (YES/NO)
- [ ] Has confidence indicator? (YES/NO - low/medium/high)
- [ ] Makes sense for your PDF? (YES/NO)
  - Why/why not? (explain your reasoning)

**Bank Balance ("Bank Seen")**:
- [ ] Shows a value? (YES/NO)
- [ ] Value > 0? (YES/NO)
  - If YES: How much? (exact amount)
  - If NO: Shows "Rs 0"? (YES/NO)
- [ ] Matches your PDF final balance? (YES/NO)
  - What's in PDF? (exact)
  - What's shown? (exact)

**Cash on Hand ("Cash With You")**:
- [ ] Shows a value? (YES/NO)
- [ ] Shows as "—" (unknown)? (YES/NO)
- [ ] Shows when last updated? (YES/NO)

**Daily Needs Protected**:
- [ ] Shows a value? (YES/NO)
- [ ] Value > 0? (YES/NO)
  - If YES: How much? (exact)
  - If NO: Shows "Rs 0"? (YES/NO)
- [ ] Makes sense? (YES/NO - explain)

**Already Spoken For (Dues)**:
- [ ] Shows a value? (YES/NO)
- [ ] Shows your confirmed dues? (YES/NO)
  - If YES: List them (what you see)
  - If NO: Why not?

**Observations to Record**:
```
METRIC SUMMARY:
Safe to Spend: [amount or "Rs 0" or "blank"]
Bank Balance: [amount or "Rs 0" or "blank"]
Cash on Hand: [amount or "—" or "blank"]
Daily Needs: [amount or "Rs 0" or "blank"]
Dues Total: [amount or "Rs 0" or "blank"]

ACCURACY CHECK:
Bank Balance matches PDF final? [YES/NO]
  PDF says: [amount]
  App shows: [amount]

Daily Needs makes sense? [YES/NO]
  Why: [explain]
```

---

#### TEST 1.7: Interactivity

**Quick Actions** (bottom of home):
- [ ] Can click "Add Cash Received"? (YES/NO)
- [ ] Can click "Update Bank Balance"? (YES/NO)
- [ ] Can click "Add Due"? (YES/NO)
- [ ] Can add new transaction? (YES/NO)
  - If YES: Does safe-to-spend update? (YES/NO)
  - If YES: Updates immediately or after refresh? (immediately/after refresh)

**Refresh Button**:
- [ ] Click refresh button?
- [ ] Values recalculate? (YES/NO)
- [ ] Any new data? (YES/NO)

**Observations to Record**:
```
Interactivity: [WORKING/BROKEN]
Updates: [LIVE/REQUIRES REFRESH/NOT UPDATING]
Issues: [list any bugs observed]
```

---

### PART 2: SAMPLE STATEMENT WORKFLOW TEST

**Objective**: Load sample data and verify complete flow

**Setup**: Start fresh (or use same instance as Part 1)

---

#### TEST 2.1: Load Sample Data

**User Action**: Click "Use Sample" button

**Verify** (Record EXACT observations):
- [ ] Button clickable? (YES/NO)
- [ ] Loading state shows? (YES/NO - "Loading..." spinner)
- [ ] Completes without error? (YES/NO)
- [ ] Alert message appears? (YES/NO)
  - If YES: What does it say? (exact text)
- [ ] Alert confirms data loaded? (YES/NO)
- [ ] Auto-redirects to home? (YES/NO)

**Observations to Record**:
```
Load Status: [SUCCESS/FAILED]
Alert Message: [exact text]
Redirect: [AUTO/MANUAL/NONE]
Errors: [none/list errors]
```

---

#### TEST 2.2: Home Metrics (Sample)

**IMPORTANT**: Compare to Import workflow results

**Check each metric**:
- [ ] Safe to Spend shows value? (YES/NO)
- [ ] Bank Balance shows value? (YES/NO)
- [ ] Cash on Hand shows value? (YES/NO)
- [ ] Daily Needs shows value? (YES/NO)
- [ ] Dues show up? (YES/NO)

**For each metric**:
- Is it > 0? (YES/NO)
- Does it make sense? (YES/NO)
- Reasonable for someone with salary? (YES/NO)

**Observations to Record**:
```
Safe to Spend: [amount]
Bank Balance: [amount]
Cash on Hand: [amount]
Daily Needs: [amount]
Dues: [amount] - [list names]

All metrics populated? [YES/NO]
Values are reasonable? [YES/NO]
```

---

#### TEST 2.3: Data Persistence

**CRITICAL TEST**: Does sample data persist?

**User Action**: Refresh the page

**Verify** (Record EXACT observations):
- [ ] After refresh, sample data still showing? (YES/NO)
- [ ] Metrics still have same values? (YES/NO)
  - If NO: What changed? (list values)
- [ ] Empty/reset? (YES/NO)
- [ ] Must click "Use Sample" again? (YES/NO)

**Observations to Record**:
```
Data Persists After Refresh? [YES/NO]
Metrics Before: [list values]
Metrics After: [list values or "empty"]
Must Reload Sample? [YES/NO]
```

---

#### TEST 2.4: Add Entry & Update

**User Action**: Add an expense or income

**Verify**:
- [ ] Can create entry? (YES/NO)
- [ ] Entry saved? (YES/NO)
- [ ] Home metrics update? (YES/NO)
  - Safe to Spend changes? (YES/NO)
  - Direction correct? (increase/decrease/same)

**Observations to Record**:
```
Entry Created: [YES/NO]
Metrics Updated: [YES/NO]
Safe-to-Spend Before: [amount]
Safe-to-Spend After: [amount]
Change Direction: [correct/wrong]
```

---

## 🐛 BUG REPORT FORMAT

**Use this format for ANY issue observed**:

```markdown
## BUG: [Short title]

**Workflow**: [Import / Sample]  
**Severity**: [CRITICAL / MAJOR / MODERATE / MINOR]  
**Location**: [What screen/button/metric]  
**Reproducibility**: [Always / Sometimes / One-time]

### What I Did (Steps to Reproduce)
1. [Exact step 1]
2. [Exact step 2]
3. [Exact step 3]

### What I Expected
[What should have happened]

### What Actually Happened
[What actually happened - EXACT observations only]

### Screenshots/Evidence
[Any proof or exact values]

### Impact
[How does this affect the user?]

### Related Bugs
[Link to other similar issues if any]
```

---

## 💡 IMPROVEMENT SUGGESTION FORMAT

**Use this format for any improvement ideas**:

```markdown
## SUGGESTION: [Title]

**Category**: [UX / Performance / Accuracy / Feature]  
**Workflow**: [Import / Sample / Both]  
**Priority**: [High / Medium / Low]

### Current Behavior
[What happens now]

### Proposed Behavior
[What could be better]

### Why This Helps
[User impact]

### How to Implement (Optional)
[Technical suggestion if you have ideas]

### Example/Mockup (Optional)
[Show the improvement visually if possible]
```

---

## ✅ TESTING CHECKLIST

### Before Starting
- [ ] Dev server running (`npm run dev`)
- [ ] Backend running
- [ ] Fresh browser tab / clean app state
- [ ] PDF file ready (for import test)
- [ ] No console errors open
- [ ] Network tab available for debugging

### During Testing
- [ ] Only record what you OBSERVE
- [ ] Don't assume anything
- [ ] Check PDF multiple times for verification
- [ ] Copy exact error messages
- [ ] Note timing (fast/slow/timeout)
- [ ] Record all metrics visible

### After Testing
- [ ] All bugs documented in BUG format
- [ ] All improvements documented in SUGGESTION format
- [ ] Comparison between Import vs Sample recorded
- [ ] No assumptions in final report
- [ ] Evidence provided for all claims

---

## 🎯 TESTING OUTPUT TEMPLATE

**Save your test report as**:

```
TEST_REPORT_[DATE]_[WORKFLOW].md

Example:
TEST_REPORT_2026-05-14_IMPORT_PDF.md
TEST_REPORT_2026-05-14_SAMPLE.md
```

**Structure your report**:
```markdown
# Test Report: [Import PDF / Sample Statement]

**Date**: [Date]  
**Tester**: [Your name]  
**PDF Used**: [filename if applicable]  
**Status**: [PASSED / FAILED / PARTIAL]

## Summary
[1-2 sentence overview]

## Test Results
[Go through each test section with YES/NO/observations]

## Bugs Found
[List all bugs using BUG format]

## Suggestions
[List all improvements using SUGGESTION format]

## Metrics Comparison (if testing both)
| Metric | Import | Sample | Notes |
|--------|--------|--------|-------|
| Safe to Spend | [X] | [X] | |
| Bank Balance | [X] | [X] | |
| Daily Needs | [X] | [X] | |

## Overall Assessment
[Your overall experience as a user]
```

---

## 🚀 USING THIS SKILL IN FUTURE

### When You Want to Test
Simply say in chat:
```
/test-workflows import-pdf /path/to/pdf.pdf

or

/test-workflows sample-statement

or

/test-workflows both /path/to/pdf.pdf
```

### What I'll Do
1. Follow this guide exactly
2. Only observe and record facts
3. Check PDF multiple times (no assumptions)
4. Report bugs in structured format
5. Suggest improvements with reasoning
6. Give you actionable findings

### What You Get
- Comprehensive bug report with exact reproduction steps
- Improvement suggestions with reasoning
- Comparison between workflows
- No hallucinations or assumptions
- Metrics comparison tables
- User perspective analysis

---

## 📝 KEY PRINCIPLES

🔴 **NEVER**:
- Assume data is correct without verification
- Mix sample data into import testing
- Report bugs without exact reproduction steps
- Suggest improvements without explaining why
- Skip testing any critical metric

🟢 **ALWAYS**:
- Verify amounts in PDF when checking metrics
- Record EXACT observations (copy error messages)
- Test both workflows separately
- Check if data persists after refresh
- Report what you actually SAW (not what you think happened)

---

## 📞 WHEN TO INVOKE THIS SKILL

Use `/test-workflows` when:
✅ Code changes made to import/home screens  
✅ Backend API updated  
✅ New feature added  
✅ Bug fix applied (verify it's fixed)  
✅ Performance optimization done  
✅ Regular regression testing needed  

---

**Version**: 1.0  
**Last Updated**: May 14, 2026  
**Created By**: Claude Code with User Input  
