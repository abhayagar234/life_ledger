# 🎯 TESTING SKILL - QUICK REFERENCE

## 📱 How to Use This Skill

### Basic Commands

```bash
# Test import workflow with a PDF
/test-workflows import-pdf /path/to/statement.pdf

# Test sample statement
/test-workflows sample-statement

# Test both workflows
/test-workflows both /path/to/statement.pdf

# Test with CSV instead of PDF
/test-workflows import-csv /path/to/statement.csv

# Test with specific user profile
/test-workflows import-pdf /path/to/statement.pdf --profile daily_wage

# Run quick sanity check
/test-workflows quick-check
```

---

## 🔍 What Gets Tested Automatically

### Import Workflow Test (7 sections)
- [ ] File upload and validation
- [ ] Preview display and row count
- [ ] Recurring dues detection
- [ ] Dues confirmation
- [ ] Navigation to home
- [ ] Home screen metrics (6 metrics checked)
- [ ] Interactivity and updates

### Sample Workflow Test (4 sections)
- [ ] Sample data loading
- [ ] Home metrics population
- [ ] Data persistence (refresh test)
- [ ] Entry creation and updates

### Comparison Test
- Side-by-side metric comparison
- Accuracy verification
- Data persistence difference

---

## 📊 What You Get in Report

✅ **Bug Report**
- Exact reproduction steps
- Screenshots/evidence
- Impact analysis
- Severity level

✅ **Improvement Suggestions**
- Why it helps
- Implementation hints
- Priority level

✅ **Metrics Comparison**
- Import vs Sample
- Accuracy check
- Persistence check

✅ **No Assumptions**
- All claims verified against PDF
- Exact values recorded
- Only observations reported

---

## 🎯 Expected Report Structure

```
TEST_REPORT_[DATE]_[WORKFLOW].md

Contents:
├── Summary
├── Test Results (7+ sections with YES/NO)
├── Bugs Found (with full details)
├── Suggestions (prioritized)
├── Metrics Comparison Table
└── Overall Assessment
```

---

## 🚨 When Bugs Are Found

The report will show:

```
## BUG: [Title]

**Severity**: [Level]
**Location**: [Screen/Button]

### Steps to Reproduce
1. [Exact step]
2. [Exact step]
3. [Exact step]

### Expected
[What should happen]

### Actual
[What actually happened - exact values]

### Evidence
PDF value: Rs X
App showed: Rs Y
```

---

## 💡 When Improvements Are Suggested

The report will show:

```
## SUGGESTION: [Title]

**Category**: [UX/Performance/Accuracy/Feature]
**Priority**: [High/Medium/Low]

### Current
[How it works now]

### Proposed
[How it could be better]

### Why Helps
[User impact]
```

---

## ✨ Key Features of This Skill

🔹 **NO ASSUMPTIONS**
- Verifies every claim against PDF
- Records exact values
- Shows evidence

🔹 **USER PERSPECTIVE**
- Tests like a real user would
- Checks all interactive elements
- Notes UX issues

🔹 **STRUCTURED OUTPUT**
- Reproducible bug reports
- Actionable suggestions
- Comparison tables

🔹 **COMPREHENSIVE**
- Tests both workflows
- Checks data persistence
- Verifies accuracy

🔹 **REUSABLE**
- Same format every time
- Easy to track progress
- Can be automated later

---

## 📋 Checklist Before Invoking

- [ ] Dev server running: `npm run dev`
- [ ] Backend running: `uvicorn app.main:reload`
- [ ] PDF file ready (for import test)
- [ ] Fresh app state (no cached data)
- [ ] Console open for error checking
- [ ] Network stable

---

## 🎬 Example Usage

### Scenario 1: Testing New Import Feature
```
User: /test-workflows import-pdf /Downloads/statement.pdf

Claude: Tests all 7 import sections, records exact metrics,
        compares to PDF, reports bugs with reproduction steps
        
Output: Complete bug report + suggestions
```

### Scenario 2: Regression Testing After Fix
```
User: /test-workflows both /Downloads/statement.pdf

Claude: Tests import AND sample, compares results,
        verifies if previous bugs are fixed
        
Output: Before/after comparison, confirmation of fixes
```

### Scenario 3: Quick Health Check
```
User: /test-workflows quick-check

Claude: Runs sample only, checks key metrics load correctly
        
Output: Quick pass/fail status
```

---

## 📞 Integration with Development

### After Each Code Change
```
1. Make code change
2. Say: /test-workflows import-pdf /path/to/pdf.pdf
3. Review bug report
4. Fix issues
5. Test again
```

### For CI/CD (Future)
```
Can automate this skill to:
- Run on every commit
- Generate test reports
- Track metrics over time
- Alert on regressions
```

---

## 🎓 What Makes This Different

| Traditional Testing | This Skill |
|---|---|
| Manual clicking | Systematic checklist |
| Notes scattered | Structured report |
| Assumptions | PDF-verified facts |
| Easy to miss issues | All paths tested |
| Hard to reproduce | Step-by-step reproduction |
| No before/after | Comparison included |

---

## 🔄 Continuous Improvement

As you use this skill:
1. Results are stored in `/TESTING_REPORTS/`
2. Can compare across versions
3. Track which bugs get fixed
4. Monitor metric accuracy over time
5. See improvement suggestions implemented

---

## 📞 Support

### If PDF won't upload
```
/test-workflows import-pdf /path/file.pdf --debug
```

### If you want specific profile testing
```
/test-workflows import-pdf /path/file.pdf --profile salaried
/test-workflows import-pdf /path/file.pdf --profile daily_wage
/test-workflows import-pdf /path/file.pdf --profile business_owner
```

### If you want comparison with previous test
```
/test-workflows import-pdf /path/file.pdf --compare [previous_report.md]
```

---

## 📌 Remember

✅ **This skill**:
- Never assumes
- Always verifies
- Provides evidence
- Suggests improvements
- Is reproducible

❌ **This skill does NOT**:
- Hallucinate issues
- Mix sample into import test
- Skip verification steps
- Make unfounded claims
- Leave room for ambiguity

---

**Skill Version**: 1.0  
**Status**: Ready to Use  
**Location**: `/Users/Abhay/life-ledger/TESTING_SKILL_GUIDE.md`

---

## 🚀 START TESTING

Just say in any conversation:

```
/test-workflows import-pdf /path/to/your/pdf.pdf
```

And detailed testing begins!
