# NEXUS Office Manager guide

NEXUS turns the month's timesheets into the Project Hours report, the private Directors' Internal Hours report and an approved Employee Viewer.

## Monthly workflow

1. **Open NEXUS** and choose **Admin Processing**. Enter the approved access code for the workstation.
2. **Check the saved information.** Confirm the Employee Register, Current/Previous Hours workbooks, Job Register and optional Third Party Costs workbooks show as ready. Replace a saved workbook only when you have the newer valid copy.
3. **Choose the reporting month and add this month's timesheets.** Upload the individual files or the ZIP, then select **Check files**.
4. **Review only the items NEXUS needs help with.** Work through the single review card shown. Choose the correct project or internal category, Time in Lieu, Unknown Project or Excluded Hours. Use **Skip for now** when you need to check something first.
5. **Create the Project Hours report.** When its card says **Ready**, download it. New data rows begin without commercial colours; apply yellow, orange, green or grey manually as invoicing decisions are made.
6. **Create the Directors' Internal Hours report.** Keep this private management workbook separate from employee information.
7. **Publish and deploy the Employee Viewer.** Create the employee access code, confirm the month is ready and select **Publish Employee Viewer**. Download the generated encrypted `.easpub` file, add it to `public/publications/` in the application repository, commit/push it on the approved release branch and let GitHub Pages deploy. Only after opening the short link in a clean browser with the access code should you send the link and code separately to employees. The application does not claim a link is live before that asset is deployed.

## Month-end maintenance

8. **Replace the latest Hours and TPC workbooks next month.** NEXUS retains the previous financial year for context and uses the newest valid copy for an overlapping month.
9. **When something is Unknown,** use Unknown Project only when the identity genuinely cannot yet be confirmed. The hours remain visible for follow-up without exposing the original private wording to employees.
10. **Old dealt-with history should not return each month.** NEXUS closes carries that were subsequently invoiced and expires carries that were not continued into the next recognised month. Use **Already dealt with — don't carry forward** only for a genuinely ambiguous older item.

Source workbooks are read locally and are never rewritten by NEXUS. The generated `.easpub` asset is encrypted and is the only employee-publication file that belongs in `public/publications/`; never place timesheets, Employee Register data, generated reports, access codes or confidential workbooks in GitHub. Each publication has its own random ID, so deploying September does not alter August.
