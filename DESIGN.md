---
name: FluentPath
description: A calm, light-first English study workspace for Vietnamese learners.
colors:
  forest: "#215747"
  forest-hover: "#2a6954"
  forest-soft: "#e8f1ec"
  forest-soft-quiet: "#f2f7f3"
  sage: "#799984"
  amber: "#c08833"
  amber-soft: "#f7f0e3"
  listening-blue: "#6787a2"
  listening-blue-soft: "#eaf1f6"
  danger: "#b5433c"
  danger-soft: "#fceeed"
  paper: "#f7f8f5"
  white: "#fff"
  surface-muted: "#f2f5f1"
  ink: "#17241e"
  ink-secondary: "#33443b"
  text-muted: "#5f7065"
  divider: "#e6ebe5"
typography:
  body:
    fontFamily: "Be Vietnam Pro, sans-serif"
    fontSize: "14px"
    lineHeight: 1.55
  display-accent:
    fontFamily: "Georgia, serif"
    fontSize: "clamp(28px, 3vw, 39px)"
    fontWeight: 400
    lineHeight: 1.18
rounded:
  control: "8px"
  panel: "12px"
spacing:
  control-height: "38px"
  page-gutter-desktop: "48px"
  page-gutter-mobile: "16px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "#fff"
    rounded: "{rounded.control}"
    height: "38px"
    padding: "0 14px"
  button-primary-hover:
    backgroundColor: "{colors.forest-hover}"
  button-ghost:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.control}"
    height: "38px"
    padding: "0 14px"
  card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "19px 22px"
  field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "40px"
    padding: "9px 11px"
---

# Design System: FluentPath

## Overview

**Creative North Star: "The Quiet Study Grove"**

FluentPath is a calm, practical workspace for returning to English study. A warm off-white ground, forest actions, quiet borders, and restrained status colors keep attention on the next useful learning step. Be Vietnam Pro supports Vietnamese explanations and English practice; a Georgia italic accent adds a small human note to display greetings.

The interface uses familiar native controls, clear interaction states, and generous reading space. Light is the default; a complete dark palette preserves the same semantic roles. Motion is brief and functional, with reduced-motion preferences respected.

**Key Characteristics:**
- Paper-like light surfaces with dark ink and forest actions.
- Semantic sage, amber, blue, and red status treatments.
- Quietly rounded controls and lightly layered panels.

## Colors

Forest green carries navigation and primary actions; soft tints distinguish selection and feedback, while muted neutrals protect reading comfort.

### Primary
- **Forest** (`{colors.forest}`): Primary buttons, links, active navigation, and key icons. Hover uses the deeper companion token.

### Secondary
- **Sage** (`{colors.sage}`): Foundations progress and completed learning allocation.
- **Listening blue** (`{colors.listening-blue}`): Listening and reading allocation and related supporting icons.
- **Review amber** (`{colors.amber}`): Review allocation, reminders, and attention states.

### Tertiary
- **Danger red** (`{colors.danger}`): Errors and active recording state; pair it with the soft danger surface.

### Neutral
- **Warm paper** (`{colors.paper}`): Main application background.
- **White surface** (`{colors.white}`) and **muted surface** (`{colors.surface-muted}`): Panels and quiet inset areas.
- **Deep ink** (`{colors.ink}`), **secondary ink** (`{colors.ink-secondary}`), and **muted text** (`{colors.text-muted}`): Primary, supporting, and tertiary text.
- **Soft divider** (`{colors.divider}`): Borders and separators.

Dark mode remaps these semantic roles to neutral green charcoal: background `#131817`, surface `#1d2522`, muted surface `#26312c`, ink `#f0f5f1`, secondary ink `#d2ded6`, muted text `#b0beb5`, divider `#3d4c44`, accent `#91ceb0`, accent hover `#ace0c5`, accent-soft `#273e32`, sage `#9bb7a3`, amber `#e4bd78`, listening blue `#a6c9e2`, and danger `#f1a39c`. Form controls use a separate visible border (`#6d8176` in dark mode, `#819287` in light mode). The `--on-accent` role is dark ink `#14251b` on mint actions and white on light-mode forest actions, including goal-card supporting copy. Selection uses explicit dark ink on a pale green fill; focus outlines use the full accent color.

**The Semantic Color Rule.** Use status colors for their established study meaning; never rely on color alone to communicate a result.

## Typography

**Display Font:** Be Vietnam Pro (self-hosted), with a Georgia italic accent for selected greeting words

**Body Font:** Be Vietnam Pro (sans-serif fallback)

**Character:** Be Vietnam Pro keeps Vietnamese diacritics and English study content clear and consistent. Georgia appears sparingly as an italic display accent, not as a second reading face.

### Hierarchy
- **Display** (600, clamp 28–39px, 1.18 line-height): Main dashboard greeting; its emphasized word uses Georgia at regular weight.
- **Headline** (600, 29px, 1.2): Standard page heading; smaller on narrow screens.
- **Title** (600, 14–17px): Section and panel headings.
- **Body** (400, 14px, 1.55): Default interface and reading copy; practice passages use 16px with 1.8 line-height.
- **Label** (500–700, usually 11–12px): Metadata, controls, and section eyebrows; uppercase eyebrows use expanded tracking.

## Layout

Desktop uses a fixed 224px navigation rail, sticky top bar, and centered content with a 1440px maximum width. Main page gutters are 48px at the standard desktop size and 16px on mobile. Dashboard content pairs its main study queue with a narrow utility column; practice pages use a main column and 250px supporting aside. Panels use compact, consistent internal spacing while reading passages receive more line height.

At 900px the dashboard and settings collapse to a single main column. At 680px the rail becomes a slide-in menu and content becomes single-column; study allocation and roadmap adapt vertically. Practice-specific columns collapse by 760px. At 540px and below, including narrow desktop windows, header search and mentor actions use their existing accessible names with icon-only presentation; primary controls reach 44px, settings groups stack, and practice tabs form a two-column grid. Long account and task text wraps, while data tables retain local horizontal scrolling. Preserve readable text and visible controls down to 320px without hiding page overflow.

## Elevation & Depth

Depth is mostly tonal and structural: thin borders distinguish white panels from the page ground, with very low ambient shadows at rest. Stronger floating shadows identify overlays such as the mentor drawer, command menu, and toast. Hover lift is reserved for the mentor prompt card.

### Shadow Vocabulary
- **Panel ambient** (`0 2px 8px rgba(28, 48, 35, .018)`): Subtle panel separation.
- **Ambient** (`0 12px 35px rgba(35, 57, 45, .06)`): Login surface and hover emphasis.
- **Floating** (`0 24px 70px rgba(20, 33, 26, .2)`): Drawers, dialogs, menus, and toasts; dark mode increases opacity.

## Shapes

Controls use gently rounded corners, while panels and dialogs use a slightly fuller radius. Borders are thin and low contrast. Pills are reserved for badges and counts; circles identify progress dots and compact queue actions. Avoid ornamental geometry that competes with study content.

## Components

### Buttons
- **Shape:** Gently rounded (8px); compact controls may use 7–9px variants.
- **Primary:** Forest fill with white text, 38px minimum height, and horizontal padding (14px). Hover shifts to forest-hover; dark mode uses dark text for contrast.
- **Secondary / Ghost:** Surface fill, divider border, secondary ink; hover introduces a quiet forest tint.
- **Focus / Disabled:** Keyboard focus has a visible 3px accent outline with 2px offset. Disabled controls dim and show a not-allowed cursor.

### Chips
- **Style:** Soft semantic or forest-tinted fill with readable foreground; badges are compact rounded pills.
- **State:** Selected practice options receive an accent border and soft accent surface. Keep selected state visible independently of text.

### Cards / Containers
- **Corner Style:** Panels typically 12px; practice panels 14px.
- **Background:** White surface over paper, with muted or semantic soft surfaces for inset content.
- **Shadow Strategy:** Border-led separation with restrained ambient shadow; floating overlays use the floating shadow.
- **Border:** One-pixel divider, except for intentional selected or semantic treatments.
- **Internal Padding:** Common panel padding is around 17–22px; passage and writing surfaces allow more room.

### Inputs / Fields
- **Style:** Native input, select, and textarea controls share surface background, control border, 8px radius, and inherited type.
- **Focus:** Accent border with a visible accent outline; maintain the browser's clear keyboard focus affordance.
- **Error / Disabled:** Errors use danger text and soft danger background; disabled controls dim.

### Navigation
- **Style:** Fixed desktop rail with text-first links and small icons. Default is muted; hover uses the muted surface; active uses forest text on the soft forest surface plus a leading forest marker. Mobile navigation becomes a dismissible slide-in rail.

### Study Allocation Strip
Three separated, rounded segments represent foundations, listening/reading, and writing/speaking. Each has its own semantic color and a proportional fill for logged minutes; keep the legend and labels alongside the visual progress.

## Do's and Don'ts

### Do:
- **Do** use Be Vietnam Pro for interface and study text so Vietnamese explanations remain legible.
- **Do** reserve Georgia italic for the existing display accent.
- **Do** keep interactive controls semantic, keyboard visible, and clearly stateful.
- **Do** map sage, blue, and amber to the established study allocation categories.

### Don't:
- **Don't** invent additional status colors or use semantic colors as decoration.
- **Don't** use color alone for selection, errors, or progress meaning.
- **Don't** compress practice reading into the denser interface text rhythm.
