# Design QA

## Source visual truth

Mobbin references supplied in the task:

- Visitors People: https://mobbin.com/screens/fc09224a-65b5-4903-aa69-d2c6c5b8f284
- Visitors map: https://mobbin.com/screens/e3a55696-6526-49bc-b345-1b75da8f57d1
- Visitors analytics: https://mobbin.com/screens/e19e0a9a-dbc5-4487-9c54-13a4abfcba78
- Figma editor reference: https://mobbin.com/screens/6f26ce58-d438-4e67-a4db-84d493b94789
- Gallery concept: attached screen supplied with the gallery task, based on the Visitors visual language.
- History concept: attached screen supplied with the history task, based on the Visitors visual language.
- Editor concept: attached screen supplied with the editor task, using Figma's single-panel workspace as the structural reference.
- Login concept: attached screen supplied with the login task, using the same airy workspace language.
- Stores home concept: attached screen supplied with the current home-screen task.

The implementation adapts the composition and rhythm, without copying logos or exact colors.

## Implementation evidence

- Main screen desktop: `/tmp/store-layout-home-desktop.png`, viewport 1440 × 900 CSS px, device scale 1.
- Main screen mobile: `/tmp/store-layout-home-mobile.png`, viewport 390 × 844 CSS px, device scale 1.
- Gallery desktop: `/tmp/store-layout-gallery-desktop.png`, viewport 1440 × 900 CSS px, device scale 1.
- Gallery mobile: `/tmp/store-layout-gallery-mobile.png`, viewport 390 × 844 CSS px, device scale 1.
- History desktop: `/tmp/store-layout-history-initial-desktop.png`, viewport 1440 × 900 CSS px, device scale 1.
- History mobile: `/tmp/store-layout-history-initial-mobile.png`, viewport 390 × 844 CSS px, device scale 1.
- History desktop after the current iteration: `/tmp/store-layout-history-v2-initial-desktop.png`, viewport 1600 × 1000 CSS px, device scale 1.
- History mobile after the current iteration: `/tmp/store-layout-history-v2-initial-mobile.png`, viewport 390 × 844 CSS px, device scale 1.
- Editor desktop: `/tmp/store-layout-editor-new-initial-desktop.png`, viewport 1440 × 900 CSS px, device scale 1.
- Editor mobile: `/tmp/store-layout-editor-new-initial-mobile.png`, viewport 390 × 844 CSS px, device scale 1.
- 3D editor desktop: `/tmp/store-layout-3d-desktop.png`, viewport 1440 × 900 CSS px, device scale 1.
- 3D editor mobile: `/tmp/store-layout-3d-mobile.png`, viewport 390 × 844 CSS px, device scale 1, touch-capable context.
- Login desktop: `/tmp/store-layout-login-desktop.png`, viewport 1440 × 900 CSS px, device scale 1.
- Login mobile: `/tmp/store-layout-login-mobile.png`, viewport 390 × 844 CSS px, device scale 1.
- Stores home desktop after the current iteration: `/tmp/store-layout-home-v2-desktop.png`, viewport 1600 × 1000 CSS px, device scale 1.
- Stores home mobile after the current iteration: `/tmp/store-layout-home-v2-mobile.png`, viewport 390 × 844 CSS px, device scale 1.
- Gallery desktop after the current iteration: `/tmp/store-layout-gallery-v2-desktop.png`, viewport 1600 × 1000 CSS px, device scale 1.
- Gallery mobile after the current iteration: `/tmp/store-layout-gallery-v2-mobile.png`, viewport 390 × 844 CSS px, device scale 1.
- 2D editor desktop after the current iteration: `/tmp/store-layout-editor-v2-desktop.png`, viewport 1600 × 1000 CSS px, device scale 1.
- 2D editor mobile after the current iteration: `/tmp/store-layout-editor-v2-mobile.png`, viewport 390 × 844 CSS px, device scale 1.
- 3D editor desktop after the current iteration: `/tmp/store-layout-editor-3d-desktop.png`, viewport 1600 × 1000 CSS px, device scale 1.
- 3D editor mobile after the current iteration: `/tmp/store-layout-editor-3d-mobile.png`, viewport 390 × 844 CSS px, device scale 1.
- State: authenticated plan with API-backed objects, both 2D and 3D modes tested, and the shared bottom navigation.

The screenshots are full-page captures at the stated CSS viewport sizes and device scale 1; no density normalization was needed.

## Comparison

Full view: the history follows the reference direction with an airy light background, a compact heading, generous whitespace, thin separators, a restrained refresh action, and a dark floating bottom navigation.

Focused history region: each row is driven by the saved version snapshot. The row shows a plan thumbnail, version number, Russian date, author, room dimensions, object count, and a yellow «Текущая» badge only for the current version. Previous rows expose «Восстановить».

Responsive region: desktop uses a wide three-column row (thumbnail, metadata, action); narrow screens use a compact three-column row with a scaled snapshot thumbnail and the restore action kept on the same line, leaving space for the fixed bottom menu.

Focused editor region: the previous split store sidebar and right inspector are replaced by one collapsible «Слои / Инструменты и объекты» panel. The remaining area is the interactive Konva canvas with the room, grid, walls, meter labels, centimeter object properties, zoom controls, fit-to-room action, and the existing yellow active «План» navigation item. The 2D room remains the source of truth for the existing 3D view.

Responsive editor region: desktop gives the canvas most of the width; mobile makes the single panel compact and scrollable, then gives the canvas a bounded area above the fixed navigation. The initial mobile canvas ended at y=775 while the navigation began at y=784, so the room is not hidden behind the menu.

Focused 3D region: the same centimeter-based room and objects are converted to meters in the existing React Three Fiber scene. The scene contains a bounded floor grid, restrained boundary walls, type-specific shelf/checkout/display primitives, a neutral selected object with a yellow contour, and room dimension labels. Camera reset, fit, and button zoom controls sit at the lower right, while the main canvas remains free of permanent panels.

Responsive 3D region: desktop and touch-capable mobile captures keep the room framed within the scene area and preserve the shared navigation. The camera has orbit, wheel/touch zoom, button zoom, pan, polar-angle and distance limits, plus bounded target panning so the scene cannot be taken below the floor or lost indefinitely.

Focused login region: the unauthenticated state now uses a white, open layout with the existing brand mark at the top left, a centered compact form, thin neutral field borders, a yellow «Войти» action, a password visibility control, and the administrator-access note. It does not render the application navigation, editor panels, or public registration controls.

Responsive login region: the form remains within the viewport at desktop and narrow mobile widths, with reduced heading, field, and button sizing on mobile while preserving readable spacing and the same visual hierarchy.

Focused stores home region: the home directory now follows the attached concept with a thin white header, a compact Lucide layout mark, short «Магазины» heading, yellow «Новый магазин» action, real store count, three-column store cards, real plan previews from each layout response, room dimensions, layout counts, and dates derived from `updatedAt`. No demo data was added to the product or database.

Responsive stores home region: desktop keeps the cards and floating menu in the same spacious rhythm as the reference. On mobile the cards become a single readable column and the shared menu is placed after the content so it does not cover a store card.

Focused gallery region: the standalone gallery now follows the attached composition with a compact breadcrumb header, «Галерея» title, yellow «Добавить изображение» action, type tabs, local filters/search, a three-column media grid, thin metadata, and the shared dark navigation with «Галерея» active. Cards remain backed by the existing API media records; no sample media is added to the product.

Responsive gallery region: desktop keeps the 3-column gallery and generous whitespace from the reference. Mobile switches to one readable media column, keeps the add action and filters usable, and places the shared navigation after the content instead of covering a card.

Focused 2D editor region: the plan now uses the reference's 58px white header, centered 2D/3D switch, one 270px «Слои» sidebar, yellow active selection, Lucide tool icons, object visibility markers, and a bottom properties section. The rest of the screen is reserved for the real Konva room, walls, grid, meter labels, objects, measurements, and the shared «План» navigation. The canvas uses centimeter geometry without changing the API model.

Responsive 2D editor region: desktop keeps the room centered with enough breathing room for the floating controls and navigation. On mobile the single sidebar stacks above a bounded canvas without overlapping its object rows or properties; the page remains scrollable when the complete sidebar is taller than the viewport.

Primary interactions tested in the rendered app:

- Opening a layout from a store card and navigating to «История».
- Rendering the API-backed version list in reverse chronological order.
- Verifying four snapshot thumbnails use only each version's saved room and object data.
- Verifying the current row has exactly one «Текущая» badge and no restore action.
- Cancelling the restore confirmation and keeping the list unchanged.
- Restoring an older version and receiving a new current version from the existing API.
- Triggering an expected stale-version `409`, showing the Russian conflict message, and exposing the existing reload action.
- Verifying «История» is active in the shared bottom navigation on desktop and mobile.
- Verifying the editor has no duplicate store sidebar or right inspector and only one collapsible tool/object/properties panel.
- Adding, selecting, moving, rotating, duplicating, deleting, and selecting all objects; confirming text fields do not receive editor shortcuts.
- Zooming with the `− / percentage / +` controls, verifying the wheel does not change zoom, fitting the room from the percentage control, panning the workspace from empty canvas space, and showing Shift measurements without moving objects.
- Verifying valid objects use the green state, invalid geometry uses the red state, saves keep the existing API format, and stale saves retain the existing Russian `409` conflict/reload flow.
- Switching to 3D without changing the selected layout, keeping the selected object visible in yellow and the sidebar selection intact.
- Verifying orbit, wheel zoom, button zoom, «Показать всё», «Сбросить», mobile viewport rendering, and that camera gestures leave the save state unchanged.
- Verifying the unauthenticated login state has no bottom navigation or sidebar, native required field validation, password show/hide behavior, Russian invalid-credentials feedback, disabled loading state, and successful handoff to the existing authenticated home flow.
- Verifying the filled home state with three API-shaped stores, Konva plan previews, date/size metadata, active «Главная» navigation, card-to-editor navigation, store creation with an empty optional address, and creation of a layout with the default valid dimensions.
- Verifying the filled gallery state with API-shaped media, the «Фото магазина» / «Идеи» tabs, «Все изображения» / «Недавно добавленные» filters, local search, yellow add action, active «Галерея» navigation, file upload, external URL add, and confirmed deletion without a page reload.

## Comparison history

1. Initial implementation added the Visitors/Figma shell and editor tools panel.
2. The store directory replaced the old overview cards while retaining the existing editor route/state model.
3. Gallery iteration added a full-screen section, tabs, a compact add dialog, dates, and confirmed deletion while reusing the existing API and media state.
4. History iteration kept the existing restore and conflict flow, added snapshot-backed thumbnails and moved history into a standalone directory-style screen.
5. Browser QA initially showed the fixed mobile menu competing with the lower history rows (P2). The history list now uses compact desktop rows, a narrow mobile row layout, scaled thumbnails, and reserved bottom space; the final captures keep the content accessible above the menu.
6. Browser QA confirmed history navigation, snapshot rendering, confirmation cancellation, successful restore, stale-version conflict handling, and responsive behavior. The browser's single `409 Conflict` console entry was intentionally generated by the conflict test and is not an uncaught application error.
7. Editor browser QA confirmed the unified panel, desktop/mobile layout, object drag, pan, zoom and fit controls, rotation, keyboard actions, Shift measurements, geometry error state, save state, and stale-version conflict handling. The expected browser `409 Conflict` entry was intentionally generated by that test.
8. 3D browser QA confirmed the active 3D switch, API-backed object selection, complete-room framing, orbit, zoom, camera reset/fit controls, no console/page errors, and unchanged save state after camera gestures on desktop and touch-capable mobile.
9. Login browser QA confirmed the new desktop/mobile composition, required fields, password visibility toggle, expected 401 invalid-credentials response translated to Russian, submit loading state, and successful Better Auth callback handoff. The expected 401 console entry was generated by the invalid-login test.
10. Stores home browser QA confirmed the current attached concept at 1600 × 1000 and 390 × 844, no horizontal overflow, real-data previews, yellow primary action, active navigation, opening a plan, optional store address, and layout creation. The QA data was intercepted only in the browser test and was not written to the product database.
11. Gallery browser QA confirmed the current attached concept at 1600 × 1000 and 390 × 844, the topbar breadcrumb/save state, 3-column desktop and single-column mobile layout, tabs, filters, search, file upload, external URL add, deletion confirmation, no horizontal overflow, and no browser errors. The API/media data was intercepted only in the browser test and was not written to the product database.
12. 2D editor browser QA confirmed the attached concept at 1600 × 1000 and 390 × 844, one sidebar with no right inspector, yellow object selection, Lucide tools, object add/select flow, button-only zoom, wheel zoom disabled, fit-to-room, Shift measurements, save state, no horizontal overflow, and no browser errors. The API/layout data was intercepted only in the browser test and was not written to the product database.
13. 3D editor browser QA confirmed the attached concept at 1600 × 1000 and 390 × 844, the 3D switch, type-specific furniture primitives, neutral furniture with a yellow selection contour, room dimensions, bottom-right reset/fit/button-zoom controls, orbit interaction, active «План» navigation, and no browser errors. The API/layout data was intercepted only in the browser test and was not written to the product database.
14. History browser QA confirmed the attached concept at 1600 × 1000 and 390 × 844, the white header/breadcrumb, compact version rows, data-backed snapshot thumbnails, yellow «Текущая» badge, refresh action, restore confirmation, successful restore, stale-version `409` handling, active «История» navigation, and corrected mobile thumbnail scaling. The API/version data was intercepted only in the browser test and was not written to the product database.

## Findings

No actionable P0, P1, or P2 visual findings remain.

Intentional P3 differences: the implementation uses the existing lightweight glyph treatment for navigation, Konva primitives for the 2D editor, and Three.js primitives for the approximate 3D preview; production data supplies the real saved snapshots and room objects. No reference logos or exact colors were copied.

## Final result

final result: passed
