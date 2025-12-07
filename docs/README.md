# GuessWatt Documentation

> Comprehensive documentation for developers, designers, and contributors

This directory contains all project documentation organized by topic. Each document serves a specific purpose and follows industry best practices for technical documentation.

## 📚 Documentation Index

### Core Documentation

| Document | Purpose | When to Read |
|----------|---------|--------------|
| **[CONCEPT.mdc](./CONCEPT.mdc)** | Product vision, user flows, LOVE framework analysis, design principles | When understanding product goals and user experience |
| **[TECH_STACK.mdc](./TECH_STACK.mdc)** | Technology decisions, CSS architecture, JS patterns, accessibility requirements | **Always** - Core technical reference |
| **[DATA_MODEL.mdc](./DATA_MODEL.mdc)** | CSV schemas, calculation formulas, data relationships, ERSE insights structure | When working with data or calculations |
| **[DECISIONS.mdc](./DECISIONS.mdc)** | Architecture Decision Records (ADRs) - technical and product decisions with rationale | **Always** - Understand why decisions were made |
| **[IMPLEMENTATION.mdc](./IMPLEMENTATION.mdc)** | Phase-by-phase implementation plan with tasks, deliverables, and checklists | When planning new features or reviewing implementation status |
| **[COPY.mdc](./COPY.mdc)** | Tone of voice, all UI copy, tooltips, error states, Portuguese glossary | When writing or reviewing user-facing text |
| **[CURSOR_RULES.mdc](./CURSOR_RULES.mdc)** | AI assistant behavior, project context, coding standards | **Always** - Rules for AI-assisted development |
| **[DEVELOPMENT.md](./DEVELOPMENT.md)** | Complete development guide: setup, workflow, testing, debugging | When setting up development environment or contributing |

## 🎯 Quick Navigation

### For New Developers

1. Start with **[TECH_STACK.mdc](./TECH_STACK.mdc)** to understand the architecture
2. Read **[DECISIONS.mdc](./DECISIONS.mdc)** to understand why things are built this way
3. Review **[CURSOR_RULES.mdc](./CURSOR_RULES.mdc)** for coding standards
4. Check **[DATA_MODEL.mdc](./DATA_MODEL.mdc)** when working with calculations

### For Product/Design

1. Read **[CONCEPT.mdc](./CONCEPT.mdc)** for product vision and user flows
2. Review **[COPY.mdc](./COPY.mdc)** for tone of voice and UI copy
3. Check **[IMPLEMENTATION.mdc](./IMPLEMENTATION.mdc)** for feature status

### For Contributors

1. Read **[DEVELOPMENT.md](./DEVELOPMENT.md)** for setup and workflow
2. Read **[CURSOR_RULES.mdc](./CURSOR_RULES.mdc)** for coding standards
3. Review **[DECISIONS.mdc](./DECISIONS.mdc)** before proposing changes
4. Check **[TECH_STACK.mdc](./TECH_STACK.mdc)** for technical constraints

## 📖 Document Details

### CONCEPT.mdc

**Purpose**: Product vision, user experience design, and strategic decisions

**Contents**:
- Mission and core idea
- Feature prioritization (Phase 1-3)
- Domain map (Portuguese energy market)
- Service design blueprint
- LOVE framework analysis (Learn, Onboard, Value, Endorse)
- User flows
- Impact potential
- Success metrics

**When to update**: When product strategy changes or new features are planned

---

### TECH_STACK.mdc

**Purpose**: Technical architecture, patterns, and implementation details

**Contents**:
- Philosophy and core principles
- Stack overview (HTML, CSS, JS, hosting)
- CSS architecture (tokens, typography, spacing, animations)
- JavaScript architecture (modules, patterns, utilities)
- Component patterns (buttons, inputs, modals)
- Accessibility checklist
- Browser support
- Performance budget

**When to update**: When technical decisions change or new patterns are introduced

---

### DATA_MODEL.mdc

**Purpose**: Data structures, schemas, and calculation formulas

**Contents**:
- Data sources (ERSE CSVs)
- CSV schemas (`Precos_ELEGN.csv`, `CondComerciais.csv`)
- Data relationships and join logic
- Calculation formulas (monthly cost, consumption estimation)
- Default values and assumptions
- Data validation rules
- ERSE insights structure
- Provider mapping

**When to update**: When data structure changes or formulas are refined

---

### DECISIONS.mdc

**Purpose**: Architecture Decision Records (ADRs) documenting technical and product decisions

**Contents**:
- ADR-001: Client-Side Only
- ADR-002: Vanilla JS, No Framework
- ADR-003: No Build Step
- ADR-004: ERSE CSVs as Primary Source
- ADR-005: Manual CSV Updates
- ADR-006: ERSE Insights Every 4 Months
- ADR-007: Single €/month Input with PDF Option
- ADR-008: Estimate vs Precise (Two Modes)
- ADR-009: Calculation Formula
- ADR-010: Assumed Defaults
- ADR-011: Loss Framing
- ADR-012: Offer Card with Expandable Details
- ADR-013: Tooltips for Technical Terms
- ADR-014: Top N Offers, Not All
- ADR-015: Real Contacts from CSV
- ADR-016: Calendar: 2 Months Default
- ADR-017: PDF Parsing Client-Side
- ADR-018: URL State for Bookmarks
- ADR-019: Portuguese (PT-PT) Only
- ADR-020: Domestic Segment Only

**When to update**: When making new architectural decisions (create new ADR)

**Format**: Each ADR follows: Context → Options → Decision → Consequences

---

### IMPLEMENTATION.mdc

**Purpose**: Phase-by-phase implementation plan with tasks and deliverables

**Contents**:
- Phase 0: Foundation (tokens, reset, base)
- Phase 1.1: Simplified Input (with PDF option)
- Phase 1.2: Loss-Focused Result with Offer Card
- Phase 1.3: Switching Guide with Real Data
- Phase 1.4: Tooltips & Info Modals
- Phase 2.1: Refine Flow (Manual Input)
- Phase 2.2: Calendar Reminder
- Phase 2.3: Share Functionality
- Phase 3: Offers List
- Phase 4: PDF Parsing
- Phase 5: ERSE Insights Integration
- Phase 6: Polish & Refinement

Each phase includes:
- Goal and deliverables
- Tasks checklist
- Decisions to document
- A11y checklist
- Implementation log template

**When to update**: When phases are completed or new phases are added

---

### COPY.mdc

**Purpose**: Tone of voice, all UI copy, and content guidelines

**Contents**:
- Tone of voice principles
- Rhetorical devices (used with moderation)
- Copy by section (hero, input, result, tooltips, etc.)
- Error states and empty states
- Tooltips content
- Glossary of concepts (energy literacy)
- Social proof (ERSE insights)
- Copy review checklist

**When to update**: When UI copy changes or new sections are added

---

### CURSOR_RULES.mdc

**Purpose**: AI assistant behavior and coding standards

**Contents**:
- Project context
- Role definition
- Code standards (general, CSS, JavaScript)
- File structure
- Accessibility requirements
- Animation philosophy
- Portuguese language guidelines
- Data handling
- Error handling
- Comments guidelines
- Git commit format
- Performance budget
- Quick reference table

**When to update**: When coding standards change or new patterns are established

## 🔄 Documentation Maintenance

### Keeping Documentation Up to Date

1. **Update immediately** when:
   - Architecture decisions change (update DECISIONS.mdc)
   - Technical patterns change (update TECH_STACK.mdc)
   - Data structures change (update DATA_MODEL.mdc)
   - UI copy changes (update COPY.mdc)

2. **Review quarterly**:
   - Check for outdated information
   - Update implementation status
   - Review ADRs for relevance

3. **When adding features**:
   - Document decisions in DECISIONS.mdc
   - Update IMPLEMENTATION.mdc with new phases
   - Add copy to COPY.mdc
   - Update TECH_STACK.mdc if patterns change

## 📝 Documentation Standards

### Format

- **Markdown** (`.md` or `.mdc` files)
- **Clear headings** with hierarchy
- **Code blocks** with language tags
- **Tables** for structured data
- **Examples** for clarity

### Style

- **Concise but complete**: Every detail needed, nothing extra
- **Examples over explanations**: Show, don't just tell
- **Cross-references**: Link between related documents
- **Version awareness**: Note when information applies

### Structure

Each document should have:
1. **Purpose statement**: What this document is for
2. **Table of contents**: For longer documents
3. **Clear sections**: Organized by topic
4. **Examples**: Real code/data examples
5. **References**: Links to related docs

## 🎓 Learning Path

### Week 1: Understanding the Project

1. Read [CONCEPT.mdc](./CONCEPT.mdc) - Understand the product
2. Read [TECH_STACK.mdc](./TECH_STACK.mdc) - Understand the architecture
3. Read [DECISIONS.mdc](./DECISIONS.mdc) - Understand the decisions

### Week 2: Deep Dive

1. Read [DATA_MODEL.mdc](./DATA_MODEL.mdc) - Understand the data
2. Read [IMPLEMENTATION.mdc](./IMPLEMENTATION.mdc) - Understand the roadmap
3. Read [COPY.mdc](./COPY.mdc) - Understand the voice

### Week 3: Contributing

1. Read [CURSOR_RULES.mdc](./CURSOR_RULES.mdc) - Understand the standards
2. Review codebase with documentation in hand
3. Start contributing with documentation as reference

## 🤔 Questions?

If documentation is unclear or missing information:

1. Check if it's covered in another document
2. Review the codebase for implementation details
3. Create an issue to request documentation updates
4. Consider contributing documentation improvements

---

**Remember**: Good documentation is a living document. Keep it updated as the project evolves.
