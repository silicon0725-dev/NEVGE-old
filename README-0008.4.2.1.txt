NGVGE Task-0008.4.2.1 Scene Restore Version Fix

Fixes: "Unable to verify Scratch Project version." during scene snapshot restore.

Apply:
1. Stop the development server.
2. Copy this package over the project root.
3. Restart the editor.
4. Capture a fresh snapshot, modify the project, then call restoreScene(sceneId).
