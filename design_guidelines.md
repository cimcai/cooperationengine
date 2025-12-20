# Cooperation Engine - Design Guidelines

## Design Approach
**System Selected:** Fluent Design + Dashboard Patterns  
**Rationale:** This is a productivity tool for AI response analysis requiring clear data organization, efficient workflows, and information density. The design prioritizes usability over visual flair.

## Core Design Elements

### Typography
- **Primary Font:** Inter (Google Fonts)
- **Headings:** 600 weight, sizes: text-2xl (page titles), text-lg (section headers)
- **Body:** 400 weight, text-base for content, text-sm for labels/metadata
- **Code/Responses:** Mono font (JetBrains Mono) at text-sm for AI outputs

### Layout System
**Spacing:** Use Tailwind units of 2, 4, 6, and 8 for consistent rhythm (p-4, gap-6, mb-8)
- 2-unit: Tight spacing within components
- 4-unit: Standard component padding
- 6-unit: Section separation
- 8-unit: Major layout divisions

**Grid Structure:** 
- Main layout: Sidebar (280px fixed) + fluid content area
- Response comparison: Equal-width columns with max 4 columns visible

### Component Library

**Navigation Sidebar:**
- Fixed left sidebar with primary actions
- Sections: New Chat, History, Settings
- Icon + label pattern throughout

**Prompt Input Area:**
- Large textarea (min-h-40) with clear labels
- Format helper text below input
- "Add Prompt" button to build sequences
- Prompt sequence displayed as numbered, removable cards

**Chatbot Selection:**
- Checkbox grid layout (grid-cols-2 md:grid-cols-4)
- Each option: Logo + name + status indicator
- "Select All" / "Clear All" helpers

**Send Controls:**
- Prominent "Send to All" primary button
- Secondary "Save as Template" option
- Progress indicator during sending

**Response Display:**
- Tabbed or side-by-side column layout
- Each response card: Chatbot name header, timestamp, response content in code block
- Export buttons (JSON, CSV, Copy to Clipboard)
- Diff highlighting for comparing responses

**Data Table (History):**
- Sortable columns: Date, Prompt Preview, Chatbots Used, Status
- Row actions: View, Re-run, Delete
- Pagination footer

### Interaction Patterns
- Auto-save prompt drafts
- Real-time status updates during API calls
- Toast notifications for success/error states
- Keyboard shortcuts (Cmd+Enter to send)

### Icons
**Library:** Heroicons (via CDN)
- Use outline style for navigation
- Use solid style for actions/status

### Images
**No hero image required** - this is a tool-focused application prioritizing function over visual marketing.

---

**Critical Features:**
- Split-view comparison is the primary interaction
- Efficient prompt management workflow
- Clear visual separation between different chatbot responses
- Export and analysis capabilities front and center