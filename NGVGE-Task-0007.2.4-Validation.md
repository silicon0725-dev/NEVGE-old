# NGVGE Task-0007.2.4 Validation

## Root cause

The React 16 portal menu was unmounted by an unconditional native `document.pointerdown` listener before the selected button could receive its `click` event.

## Checks

- PASS — shared dismiss hook exists
- PASS — outside target containment guard exists
- PASS — capture pointer listener exists
- PASS — matching capture cleanup exists
- PASS — old unconditional document pointerdown listener removed
- PASS — node menu uses menu ref (count=2)
- PASS — both menu actions execute before close (count=2)
- PASS — Escape dismissal exists
- PASS — node/root context menu components remain
- PASS — balanced braces ({=368 }=368)
- PASS — balanced parentheses ((=407 )=407)
- PASS — balanced JSX angle tags heuristic (open=4 close=4)
- PASS — patch contains only intended runtime file

## Runtime behavior to test locally

1. Right-click **Entities** and click **Add Node**.
2. Right-click a node and click **Add Child Node**.
3. Test Rename, Duplicate, Enable/Disable, Reparent, Expand, Collapse, and Delete.
4. Confirm outside click, Escape, scroll, and window blur dismiss the menu.

Full Jest, ESLint, and Webpack were not executed in this container because the uploaded source archive does not contain `node_modules`.